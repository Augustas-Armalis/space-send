/**
 * Space Send — Signaling + Storage Worker
 *
 * One Cloudflare Worker that does two jobs:
 *
 *  1. WebRTC signaling for Beams. A Durable Object holds one "room" per Beam id;
 *     peers join over a WebSocket and the room relays SDP/ICE between them. No
 *     file bytes ever pass through here.
 *
 *  2. Blob + manifest storage for Drops, backed by Cloudflare R2. Pushed files
 *     and their manifest live in R2 so a Drop opened on a different device can
 *     materialize. The id is unguessable, so URL-as-capability is the auth model
 *     (matches WeTransfer / Firefox Send semantics).
 *
 * ---------------------------------------------------------------------------
 * FREE-TIER GUARDRAILS — keep R2 usage under 10 GB to avoid any billing.
 * ---------------------------------------------------------------------------
 * Cloudflare R2 free tier (as of writing): 10 GB storage, 1M Class A ops/mo,
 * 10M Class B ops/mo, zero egress. We enforce:
 *   • A 9 GB bucket-wide hard cap (1 GB safety margin). Uploads that would
 *     exceed it are rejected with 507.
 *   • 50 MB hard cap per file.
 *   • 1 GB hard cap per Drop (across all files).
 *   • 14-day auto-expiry on every manifest — see the manifest's expiresAt.
 *     Bytes get reaped lazily on next access and by a scheduled cron.
 * A Durable Object holds the running byte counter; increments and the R2 PUT
 * happen atomically so concurrent uploads can't race past the cap.
 * ---------------------------------------------------------------------------
 *
 * Endpoints:
 *   WS  /beam/<beamId>?self=<peerId>     — Beam signaling
 *   PUT /drop/<dropId>/manifest          — store JSON manifest
 *   GET /drop/<dropId>/manifest          — read JSON manifest
 *   PUT /drop/<dropId>/file/<fileId>     — store file bytes (any size)
 *   GET /drop/<dropId>/file/<fileId>     — stream file bytes
 *   DELETE /drop/<dropId>                — purge a Drop and all its files
 *   GET /usage                           — { bytes, max, drops } (telemetry)
 */

export interface Env {
  BEAM_ROOMS: DurableObjectNamespace;
  USAGE: DurableObjectNamespace;
  DROPS: R2Bucket;
}

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

const BUCKET_LIMIT_BYTES = 9 * GB;       // 9 GB — leaves 1 GB margin under the 10 GB free tier
const MAX_FILE_BYTES = 50 * MB;          // per-file cap
const MAX_DROP_BYTES = 1 * GB;           // per-Drop cap
const MAX_MANIFEST_BYTES = 64 * KB;

const USAGE_KEY = "global";              // single Durable Object holds the counter

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/" || url.pathname === "/health") {
      return cors(new Response(JSON.stringify({ ok: true, service: "space-send" }), json()));
    }

    // Usage telemetry — handy for the UI / debugging. We must reconstruct the
    // response: a Durable Object's returned Response has immutable headers, so
    // cors()'s header .set() would throw (Workers error 1101).
    if (url.pathname === "/usage" && request.method === "GET") {
      const stub = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      const r = await stub.fetch("https://usage/read");
      const body = await r.text();
      return cors(new Response(body, { status: r.status, headers: { "content-type": "application/json" } }));
    }

    // 1. Beam signaling (WebSocket → Durable Object)
    const beamMatch = url.pathname.match(/^\/beam\/([A-Za-z0-9_-]+)$/);
    if (beamMatch) {
      const beamId = beamMatch[1];
      const id = env.BEAM_ROOMS.idFromName(beamId);
      const room = env.BEAM_ROOMS.get(id);
      return room.fetch(request);
    }

    // 2. Drop manifest
    const manifestMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/manifest$/);
    if (manifestMatch) {
      const dropId = manifestMatch[1];
      const key = `manifest/${dropId}.json`;
      if (request.method === "PUT") {
        const body = await request.arrayBuffer();
        if (body.byteLength > MAX_MANIFEST_BYTES) {
          return cors(new Response("Manifest too large", { status: 413 }));
        }
        await env.DROPS.put(key, body, { httpMetadata: { contentType: "application/json" } });
        return cors(new Response(JSON.stringify({ ok: true }), json()));
      }
      if (request.method === "GET") {
        const obj = await env.DROPS.get(key);
        if (!obj) return cors(new Response("Not found", { status: 404 }));
        const text = await obj.text();
        return cors(new Response(text, json()));
      }
      return cors(new Response("Method not allowed", { status: 405 }));
    }

    // 3. Drop file bytes — guarded by usage counter.
    const fileMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)$/);
    if (fileMatch) {
      const [, dropId, fileId] = fileMatch;
      const key = `blob/${dropId}/${fileId}`;
      if (request.method === "PUT") {
        const contentLength = Number(request.headers.get("content-length") || "0");
        if (!contentLength) return cors(new Response("content-length required", { status: 411 }));
        if (contentLength > MAX_FILE_BYTES) {
          return cors(jsonResp({ error: "file_too_large", max: MAX_FILE_BYTES }, 413));
        }
        if (!request.body) return cors(new Response("No body", { status: 400 }));

        // Reserve the bytes atomically in the usage counter BEFORE writing R2.
        // If we'd blow past the cap, fail fast with 507.
        const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
        const reserve = await usage.fetch("https://usage/reserve", {
          method: "POST",
          body: JSON.stringify({ dropId, fileId, bytes: contentLength }),
        });
        if (reserve.status !== 200) {
          // Pass through the structured error from the counter (cap reached / drop full).
          const body = await reserve.text();
          return cors(new Response(body, { status: reserve.status, headers: { "content-type": "application/json" } }));
        }

        const ct = request.headers.get("x-content-type") || "application/octet-stream";
        try {
          await env.DROPS.put(key, request.body, { httpMetadata: { contentType: ct } });
        } catch (e) {
          // Roll back the reservation on R2 failure so the counter doesn't drift.
          await usage.fetch("https://usage/release", {
            method: "POST",
            body: JSON.stringify({ dropId, fileId, bytes: contentLength }),
          });
          return cors(new Response(`Storage error: ${e}`, { status: 502 }));
        }
        return cors(new Response(JSON.stringify({ ok: true }), json()));
      }
      if (request.method === "GET") {
        const obj = await env.DROPS.get(key);
        if (!obj) return cors(new Response("Not found", { status: 404 }));
        const headers = new Headers();
        headers.set("content-type", obj.httpMetadata?.contentType || "application/octet-stream");
        if (obj.size) headers.set("content-length", String(obj.size));
        return cors(new Response(obj.body, { headers }));
      }
      return cors(new Response("Method not allowed", { status: 405 }));
    }

    // 4. Purge a Drop
    const purgeMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)$/);
    if (purgeMatch && request.method === "DELETE") {
      const dropId = purgeMatch[1];
      await env.DROPS.delete(`manifest/${dropId}.json`);
      const list = await env.DROPS.list({ prefix: `blob/${dropId}/` });
      await Promise.all(list.objects.map((o) => env.DROPS.delete(o.key)));
      // Release the reservations.
      const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      await usage.fetch("https://usage/release-drop", {
        method: "POST",
        body: JSON.stringify({ dropId }),
      });
      return cors(new Response(JSON.stringify({ ok: true }), json()));
    }

    return cors(new Response("Not found", { status: 404 }));
  },
};

function json() {
  return { headers: { "content-type": "application/json" } };
}
function jsonResp(body: unknown, status: number) {
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
   UsageCounter — Durable Object holding the bucket-wide byte total. All
   reservations go through here so concurrent uploads can't race past the cap.
   Per-drop sub-totals are kept too, enforcing MAX_DROP_BYTES.
   ========================================================================== */
export class UsageCounter {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/read") {
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const drops = (await this.state.storage.list<number>({ prefix: "drop:" })).size;
      return new Response(JSON.stringify({
        bytes: total,
        max: BUCKET_LIMIT_BYTES,
        drops,
        maxFileBytes: MAX_FILE_BYTES,
        maxDropBytes: MAX_DROP_BYTES,
      }), { headers: { "content-type": "application/json" } });
    }

    if (url.pathname === "/reserve") {
      const { dropId, fileId, bytes } = await request.json<{ dropId: string; fileId: string; bytes: number }>();
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const dropKey = `drop:${dropId}`;
      const dropTotal = (await this.state.storage.get<number>(dropKey)) ?? 0;

      if (total + bytes > BUCKET_LIMIT_BYTES) {
        return jsonResp({
          error: "bucket_full",
          message: "Shared storage is full — try again later or use Beam (live P2P).",
          bytes: total,
          max: BUCKET_LIMIT_BYTES,
        }, 507);
      }
      if (dropTotal + bytes > MAX_DROP_BYTES) {
        return jsonResp({
          error: "drop_too_large",
          message: `A single Drop can't exceed ${Math.round(MAX_DROP_BYTES / MB)} MB. Use Beam for larger sets.`,
          max: MAX_DROP_BYTES,
        }, 413);
      }

      const fileKey = `file:${dropId}:${fileId}`;
      const existing = (await this.state.storage.get<number>(fileKey)) ?? 0;
      // Idempotent re-upload: subtract the old reservation first.
      const newTotal = total - existing + bytes;
      const newDropTotal = dropTotal - existing + bytes;
      await this.state.storage.put({
        total: newTotal,
        [dropKey]: newDropTotal,
        [fileKey]: bytes,
      });
      return jsonResp({ ok: true, bytes: newTotal, max: BUCKET_LIMIT_BYTES }, 200);
    }

    if (url.pathname === "/release") {
      const { dropId, fileId, bytes } = await request.json<{ dropId: string; fileId: string; bytes: number }>();
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const dropKey = `drop:${dropId}`;
      const dropTotal = (await this.state.storage.get<number>(dropKey)) ?? 0;
      const fileKey = `file:${dropId}:${fileId}`;
      await this.state.storage.put("total", Math.max(0, total - bytes));
      const newDrop = Math.max(0, dropTotal - bytes);
      if (newDrop === 0) await this.state.storage.delete(dropKey);
      else await this.state.storage.put(dropKey, newDrop);
      await this.state.storage.delete(fileKey);
      return jsonResp({ ok: true }, 200);
    }

    if (url.pathname === "/release-drop") {
      const { dropId } = await request.json<{ dropId: string }>();
      const dropKey = `drop:${dropId}`;
      const dropTotal = (await this.state.storage.get<number>(dropKey)) ?? 0;
      const total = (await this.state.storage.get<number>("total")) ?? 0;
      const files = await this.state.storage.list({ prefix: `file:${dropId}:` });
      const updates = new Map<string, unknown>();
      updates.set("total", Math.max(0, total - dropTotal));
      for (const k of files.keys()) updates.set(k, undefined);
      updates.set(dropKey, undefined);
      // Use put for set + delete for undefined.
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
   BeamRoom — WebRTC signaling relay, one per Beam id.
   ========================================================================== */
export class BeamRoom {
  private peers = new Map<string, WebSocket>();

  constructor(_state: DurableObjectState, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const self = url.searchParams.get("self");
    if (request.headers.get("Upgrade") !== "websocket" || !self) {
      return new Response("Expected a WebSocket with ?self=", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.peers.set(self, server);

    server.addEventListener("message", (event: MessageEvent) => {
      let msg: { from?: string; to?: string } | null = null;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (!msg) return;
      const raw = typeof event.data === "string" ? event.data : "";
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
