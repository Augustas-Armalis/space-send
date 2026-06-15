/**
 * Space Send — one Cloudflare Worker, four jobs.
 *
 *  1. BEAM signaling (WebRTC). A Durable Object holds one "room" per Beam id;
 *     peers join over a WebSocket and the room relays SDP/ICE between them.
 *     NO FILE BYTES pass through — Beam transfers go browser→browser directly.
 *     The room also stamps each peer's rough geo (Cloudflare edge) so the host
 *     can see who's connected.
 *
 *  2. DROP storage (R2). Cloud transfers that persist behind an unguessable
 *     link. Manifest + file bytes live in R2; openable from any device.
 *
 *  3. POOL storage (R2). A shared drop-folder: anyone with the link can upload
 *     and download. Same 10 GB budget as Drops.
 *
 *  4. USAGE accounting + WIPE. A Durable Object tracks total bytes so we stay
 *     under R2's 10 GB free tier; /wipe nukes everything in one call.
 *
 * Endpoints
 *   WS     /beam/<id>?self=<peer>          — Beam signaling
 *   PUT    /drop/<id>/manifest             — store Drop manifest JSON
 *   GET    /drop/<id>/manifest             — read Drop manifest
 *   PUT    /drop/<id>/file/<fid>           — store Drop file bytes
 *   GET    /drop/<id>/file/<fid>           — stream Drop file
 *   DELETE /drop/<id>                      — purge a Drop
 *   GET    /list                           — all Drop manifests (shared vault)
 *   PUT    /pool/<id>/file/<fid>           — upload into a Pool (x-file-name hdr)
 *   GET    /pool/<id>                      — list a Pool's files
 *   GET    /pool/<id>/file/<fid>           — download a Pool file
 *   DELETE /pool/<id>/file/<fid>           — remove one Pool file
 *   GET    /usage                          — { bytes, max, drops }
 *   POST   /wipe                           — delete ALL R2 objects, reset usage
 */

export interface Env {
  BEAM_ROOMS: DurableObjectNamespace;
  USAGE: DurableObjectNamespace;
  DROPS: R2Bucket;
}

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

const BUCKET_LIMIT_BYTES = 9 * GB;   // 9 GB — 1 GB margin under R2's 10 GB free tier
const MAX_FILE_BYTES = 95 * MB;      // per single-PUT file (Workers free body limit ~100 MB)
const MAX_DROP_BYTES = 4 * GB;       // per Drop (large files go via multipart, in 90 MB parts)
const MAX_MANIFEST_BYTES = 512 * KB;

const USAGE_KEY = "global";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cf = (request as unknown as { cf?: { country?: string; city?: string } }).cf;

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/" || url.pathname === "/health") {
      return cors(jsonResp({ ok: true, service: "space-send" }, 200));
    }

    // ---- Usage telemetry (reconstruct DO response — its headers are immutable) ----
    if (url.pathname === "/usage" && request.method === "GET") {
      const stub = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      const r = await stub.fetch("https://usage/read");
      return cors(new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } }));
    }

    // ---- Wipe everything ----
    if (url.pathname === "/wipe" && (request.method === "DELETE" || request.method === "POST")) {
      let cursor: string | undefined;
      let deleted = 0;
      do {
        const page: R2Objects = await env.DROPS.list({ cursor, limit: 1000 });
        if (page.objects.length) {
          await Promise.all(page.objects.map((o) => env.DROPS.delete(o.key)));
          deleted += page.objects.length;
        }
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      await usage.fetch("https://usage/reset", { method: "POST" });
      return cors(jsonResp({ ok: true, deleted }, 200));
    }

    // ---- Beam signaling ----
    const beamMatch = url.pathname.match(/^\/beam\/([A-Za-z0-9_-]+)$/);
    if (beamMatch) {
      const room = env.BEAM_ROOMS.get(env.BEAM_ROOMS.idFromName(beamMatch[1]));
      return room.fetch(request);
    }

    // ---- Drop manifest ----
    const manifestMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/manifest$/);
    if (manifestMatch) {
      const key = `manifest/${manifestMatch[1]}.json`;
      if (request.method === "PUT") {
        const body = await request.arrayBuffer();
        if (body.byteLength > MAX_MANIFEST_BYTES) return cors(jsonResp({ error: "manifest_too_large" }, 413));
        await env.DROPS.put(key, body, { httpMetadata: { contentType: "application/json" } });
        return cors(jsonResp({ ok: true }, 200));
      }
      if (request.method === "GET") {
        const obj = await env.DROPS.get(key);
        if (!obj) return cors(new Response("Not found", { status: 404 }));
        return cors(new Response(await obj.text(), { headers: { "content-type": "application/json" } }));
      }
      return cors(new Response("Method not allowed", { status: 405 }));
    }

    // ---- Drop file bytes ----
    // ---- Drop file: R2 multipart upload (for large files / videos) ----
    // create:   POST /drop/<id>/file/<fid>/mpu       (x-total-size, x-file-name)
    // part:     PUT  /drop/<id>/file/<fid>/mpu/<uploadId>/<partNo>
    // complete: POST /drop/<id>/file/<fid>/mpu/<uploadId>/complete  body {parts}
    // abort:    DELETE /drop/<id>/file/<fid>/mpu/<uploadId>
    const mpuCreate = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)\/mpu$/);
    if (mpuCreate && request.method === "POST") {
      const [, dropId, fileId] = mpuCreate;
      const key = `blob/${dropId}/${fileId}`;
      const total = Number(request.headers.get("x-total-size") || "0");
      if (total > MAX_DROP_BYTES) return cors(jsonResp({ error: "file_too_large", max: MAX_DROP_BYTES }, 413));
      // Reserve the whole declared size up front so concurrent uploads respect the cap.
      const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      const reserve = await usage.fetch("https://usage/reserve", { method: "POST", body: JSON.stringify({ dropId, fileId, bytes: total }) });
      if (reserve.status !== 200) return cors(new Response(await reserve.text(), { status: reserve.status, headers: { "content-type": "application/json" } }));
      const mpu = await env.DROPS.createMultipartUpload(key, {
        httpMetadata: { contentType: request.headers.get("x-content-type") || "application/octet-stream" },
        customMetadata: { name: decodeURIComponent(request.headers.get("x-file-name") || fileId) },
      });
      return cors(jsonResp({ uploadId: mpu.uploadId }, 200));
    }
    const mpuPart = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)\/mpu\/([^/]+)\/(\d+)$/);
    if (mpuPart && request.method === "PUT") {
      const [, dropId, fileId, uploadId, partNo] = mpuPart;
      const key = `blob/${dropId}/${fileId}`;
      if (!request.body) return cors(new Response("No body", { status: 400 }));
      const mpu = env.DROPS.resumeMultipartUpload(key, uploadId);
      const part = await mpu.uploadPart(Number(partNo), request.body);
      return cors(jsonResp({ partNumber: part.partNumber, etag: part.etag }, 200));
    }
    const mpuComplete = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)\/mpu\/([^/]+)\/complete$/);
    if (mpuComplete && request.method === "POST") {
      const [, dropId, fileId, uploadId] = mpuComplete;
      const key = `blob/${dropId}/${fileId}`;
      const { parts } = await request.json<{ parts: { partNumber: number; etag: string }[] }>();
      const mpu = env.DROPS.resumeMultipartUpload(key, uploadId);
      await mpu.complete(parts);
      return cors(jsonResp({ ok: true }, 200));
    }
    const mpuAbort = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)\/mpu\/([^/]+)$/);
    if (mpuAbort && request.method === "DELETE") {
      const [, dropId, fileId, uploadId] = mpuAbort;
      const key = `blob/${dropId}/${fileId}`;
      try {
        const mpu = env.DROPS.resumeMultipartUpload(key, uploadId);
        await mpu.abort();
      } catch {
        /* already gone */
      }
      const head = await env.DROPS.head(key).catch(() => null);
      // Release whatever we reserved (best effort — we don't know the exact size here, so caller passes it).
      const total = Number(url.searchParams.get("size") || head?.size || "0");
      if (total) {
        const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
        await usage.fetch("https://usage/release", { method: "POST", body: JSON.stringify({ dropId, fileId, bytes: total }) });
      }
      return cors(jsonResp({ ok: true }, 200));
    }

    const fileMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)$/);
    if (fileMatch) {
      const [, dropId, fileId] = fileMatch;
      const key = `blob/${dropId}/${fileId}`;
      if (request.method === "PUT") return cors(await storeBlob(env, key, dropId, fileId, request, {
        name: decodeURIComponent(request.headers.get("x-file-name") || fileId),
        mime: request.headers.get("x-content-type") || "application/octet-stream",
      }));
      if (request.method === "GET") return cors(await readBlob(env, key, true));
      return cors(new Response("Method not allowed", { status: 405 }));
    }

    // ---- Drop purge ----
    const purgeMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)$/);
    if (purgeMatch && request.method === "DELETE") {
      const dropId = purgeMatch[1];
      await env.DROPS.delete(`manifest/${dropId}.json`);
      const list = await env.DROPS.list({ prefix: `blob/${dropId}/` });
      await Promise.all(list.objects.map((o) => env.DROPS.delete(o.key)));
      const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      await usage.fetch("https://usage/release-drop", { method: "POST", body: JSON.stringify({ dropId }) });
      return cors(jsonResp({ ok: true }, 200));
    }

    // ---- Shared Drop catalog ----
    if (url.pathname === "/list" && request.method === "GET") {
      const list = await env.DROPS.list({ prefix: "manifest/" });
      const manifests = await Promise.all(
        list.objects.map(async (o) => {
          try {
            const m = await env.DROPS.get(o.key);
            return m ? JSON.parse(await m.text()) : null;
          } catch {
            return null;
          }
        }),
      );
      return cors(jsonResp({ drops: manifests.filter(Boolean) }, 200));
    }

    // ---- Pool: list contents ----
    const poolListMatch = url.pathname.match(/^\/pool\/([A-Za-z0-9_-]+)$/);
    if (poolListMatch && request.method === "GET") {
      const poolId = poolListMatch[1];
      const list = await env.DROPS.list({ prefix: `pool/${poolId}/`, include: ["customMetadata"] });
      const files = list.objects.map((o) => ({
        id: o.key.split("/").pop(),
        name: o.customMetadata?.name || o.key.split("/").pop(),
        size: o.size,
        mime: o.customMetadata?.mime || "application/octet-stream",
        uploader: o.customMetadata?.uploader || "anon",
        ts: Number(o.customMetadata?.ts || 0),
      }));
      return cors(jsonResp({ id: poolId, files }, 200));
    }

    // ---- Pool: file upload / download / delete ----
    const poolFileMatch = url.pathname.match(/^\/pool\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)$/);
    if (poolFileMatch) {
      const [, poolId, fileId] = poolFileMatch;
      const key = `pool/${poolId}/${fileId}`;
      if (request.method === "PUT") {
        const meta = {
          name: decodeURIComponent(request.headers.get("x-file-name") || fileId),
          mime: request.headers.get("x-content-type") || "application/octet-stream",
          uploader: decodeURIComponent(request.headers.get("x-uploader") || "anon"),
          ts: String(Date.now()),
        };
        return cors(await storeBlob(env, key, poolId, fileId, request, meta));
      }
      if (request.method === "GET") return cors(await readBlob(env, key, true));
      if (request.method === "DELETE") {
        const head = await env.DROPS.head(key);
        await env.DROPS.delete(key);
        if (head?.size) {
          const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
          await usage.fetch("https://usage/release", { method: "POST", body: JSON.stringify({ dropId: poolId, fileId, bytes: head.size }) });
        }
        return cors(jsonResp({ ok: true }, 200));
      }
      return cors(new Response("Method not allowed", { status: 405 }));
    }

    return cors(new Response("Not found", { status: 404 }));

    void cf;
  },
};

/** Reserve bytes through the usage DO, then stream the body into R2. */
async function storeBlob(
  env: Env,
  key: string,
  groupId: string,
  fileId: string,
  request: Request,
  custom?: Record<string, string>,
): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (!contentLength) return jsonResp({ error: "content_length_required" }, 411);
  if (contentLength > MAX_FILE_BYTES) return jsonResp({ error: "file_too_large", max: MAX_FILE_BYTES }, 413);
  if (!request.body) return new Response("No body", { status: 400 });

  const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
  const reserve = await usage.fetch("https://usage/reserve", {
    method: "POST",
    body: JSON.stringify({ dropId: groupId, fileId, bytes: contentLength }),
  });
  if (reserve.status !== 200) {
    return new Response(await reserve.text(), { status: reserve.status, headers: { "content-type": "application/json" } });
  }

  try {
    await env.DROPS.put(key, request.body, {
      httpMetadata: { contentType: custom?.mime || request.headers.get("x-content-type") || "application/octet-stream" },
      customMetadata: custom,
    });
  } catch (e) {
    await usage.fetch("https://usage/release", { method: "POST", body: JSON.stringify({ dropId: groupId, fileId, bytes: contentLength }) });
    return new Response(`Storage error: ${e}`, { status: 502 });
  }
  return jsonResp({ ok: true }, 200);
}

async function readBlob(env: Env, key: string, forceDownload = false): Promise<Response> {
  const obj = await env.DROPS.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("content-type", obj.httpMetadata?.contentType || "application/octet-stream");
  if (obj.size) headers.set("content-length", String(obj.size));
  // Force a real download instead of letting the browser render images/videos
  // inline. The download attribute alone doesn't work cross-origin, so the
  // server must say "attachment".
  if (forceDownload) {
    const name = (obj.customMetadata?.name || key.split("/").pop() || "file").replace(/["\\\r\n]/g, "_");
    headers.set("content-disposition", `attachment; filename="${name}"`);
  }
  return new Response(obj.body, { headers });
}

function jsonResp(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function cors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  res.headers.set("Access-Control-Expose-Headers", "content-length, content-type");
  return res;
}

/* ============================================================================
   UsageCounter — Durable Object holding the bucket-wide byte total so
   concurrent uploads can't race past the 9 GB cap.
   ========================================================================== */
export class UsageCounter {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/read") {
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const drops = (await this.state.storage.list<number>({ prefix: "drop:" })).size;
      return jsonResp({ bytes: total, max: BUCKET_LIMIT_BYTES, drops, maxFileBytes: MAX_FILE_BYTES, maxDropBytes: MAX_DROP_BYTES }, 200);
    }

    if (url.pathname === "/reserve") {
      const { dropId, fileId, bytes } = await request.json<{ dropId: string; fileId: string; bytes: number }>();
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const dropKey = `drop:${dropId}`;
      const dropTotal = (await this.state.storage.get<number>(dropKey)) ?? 0;
      if (total + bytes > BUCKET_LIMIT_BYTES) {
        return jsonResp({ error: "bucket_full", message: "Shared storage is full — wipe some files or use Beam.", bytes: total, max: BUCKET_LIMIT_BYTES }, 507);
      }
      if (dropTotal + bytes > MAX_DROP_BYTES) {
        return jsonResp({ error: "drop_too_large", message: `A single transfer can't exceed ${Math.round(MAX_DROP_BYTES / MB)} MB on Drop. Use Beam.`, max: MAX_DROP_BYTES }, 413);
      }
      const fileKey = `file:${dropId}:${fileId}`;
      const existing = (await this.state.storage.get<number>(fileKey)) ?? 0;
      await this.state.storage.put({ total: total - existing + bytes, [dropKey]: dropTotal - existing + bytes, [fileKey]: bytes });
      return jsonResp({ ok: true, bytes: total - existing + bytes, max: BUCKET_LIMIT_BYTES }, 200);
    }

    if (url.pathname === "/release") {
      const { dropId, fileId, bytes } = await request.json<{ dropId: string; fileId: string; bytes: number }>();
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const dropKey = `drop:${dropId}`;
      const dropTotal = (await this.state.storage.get<number>(dropKey)) ?? 0;
      await this.state.storage.put("total", Math.max(0, total - bytes));
      const newDrop = Math.max(0, dropTotal - bytes);
      if (newDrop === 0) await this.state.storage.delete(dropKey);
      else await this.state.storage.put(dropKey, newDrop);
      await this.state.storage.delete(`file:${dropId}:${fileId}`);
      return jsonResp({ ok: true }, 200);
    }

    if (url.pathname === "/reset") {
      await this.state.storage.deleteAll();
      return jsonResp({ ok: true }, 200);
    }

    if (url.pathname === "/release-drop") {
      const { dropId } = await request.json<{ dropId: string }>();
      const dropKey = `drop:${dropId}`;
      const dropTotal = (await this.state.storage.get<number>(dropKey)) ?? 0;
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const files = await this.state.storage.list({ prefix: `file:${dropId}:` });
      await this.state.storage.put("total", Math.max(0, total - dropTotal));
      await this.state.storage.delete(dropKey);
      const keys: string[] = [];
      for (const k of files.keys()) keys.push(k);
      if (keys.length) await this.state.storage.delete(keys);
      return jsonResp({ ok: true }, 200);
    }

    return new Response("Not found", { status: 404 });
  }
}

/* ============================================================================
   BeamRoom — WebRTC signaling relay, one per Beam id. Also stamps each peer's
   rough geo (from the Cloudflare edge) onto the join/hello it relays, so the
   host can show who's connected without any IP ever reaching the client.
   ========================================================================== */
export class BeamRoom {
  private peers = new Map<string, WebSocket>();
  private geo = new Map<string, { country?: string; city?: string }>();

  constructor(_state: DurableObjectState, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const self = url.searchParams.get("self");
    if (request.headers.get("Upgrade") !== "websocket" || !self) {
      return new Response("Expected a WebSocket with ?self=", { status: 426 });
    }

    const cf = (request as unknown as { cf?: { country?: string; city?: string } }).cf;
    this.geo.set(self, { country: cf?.country, city: cf?.city });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.peers.set(self, server);

    server.addEventListener("message", (event: MessageEvent) => {
      let msg: { kind?: string; from?: string; to?: string } | null = null;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (!msg) return;
      let raw = typeof event.data === "string" ? event.data : "";

      // Stamp geo on join/hello so the host can label connected peers.
      if ((msg.kind === "join" || msg.kind === "hello") && msg.from) {
        const g = this.geo.get(msg.from);
        if (g) {
          try {
            raw = JSON.stringify({ ...msg, geo: g });
          } catch {
            /* keep raw */
          }
        }
      }

      if (msg.to) {
        const target = this.peers.get(msg.to);
        if (target && target.readyState === 1) target.send(raw);
      } else {
        for (const [peerId, ws] of this.peers) {
          if (peerId !== self && ws.readyState === 1) ws.send(raw);
        }
      }
    });

    const cleanup = () => {
      this.peers.delete(self);
      this.geo.delete(self);
      const bye = JSON.stringify({ kind: "bye", beam: url.pathname.split("/").pop(), from: self });
      for (const [, ws] of this.peers) {
        if (ws.readyState === 1) ws.send(bye);
      }
    };
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }
}
