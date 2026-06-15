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
 * Endpoints:
 *   WS  /beam/<beamId>?self=<peerId>     — Beam signaling
 *   PUT /drop/<dropId>/manifest          — store JSON manifest
 *   GET /drop/<dropId>/manifest          — read JSON manifest
 *   PUT /drop/<dropId>/file/<fileId>     — store file bytes (any size)
 *   GET /drop/<dropId>/file/<fileId>     — stream file bytes
 *   DELETE /drop/<dropId>                — purge a Drop and all its files
 *
 * Deploy:  wrangler deploy
 * Then set NEXT_PUBLIC_SIGNAL_URL=wss://<your-worker-subdomain>.workers.dev in the web app.
 * (HTTPS endpoints derive from the same host — see src/lib/site.ts in apps/web.)
 */

export interface Env {
  BEAM_ROOMS: DurableObjectNamespace;
  DROPS: R2Bucket;
}

// 25 MB hard limit per file — well within Workers' free-tier request limits and
// generous enough for normal sharing. Bump on a paid plan if you need more.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/" || url.pathname === "/health") {
      return cors(new Response(JSON.stringify({ ok: true, service: "space-send" }), json()));
    }

    // 1. Beam signaling (WebSocket → Durable Object)
    const beamMatch = url.pathname.match(/^\/beam\/([A-Za-z0-9_-]+)$/);
    if (beamMatch) {
      const beamId = beamMatch[1];
      const id = env.BEAM_ROOMS.idFromName(beamId);
      const room = env.BEAM_ROOMS.get(id);
      return room.fetch(request);
    }

    // 2. Drop blob storage (R2)
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

    const fileMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)\/file\/([A-Za-z0-9_-]+)$/);
    if (fileMatch) {
      const [, dropId, fileId] = fileMatch;
      const key = `blob/${dropId}/${fileId}`;
      if (request.method === "PUT") {
        const contentLength = Number(request.headers.get("content-length") || "0");
        if (contentLength > MAX_FILE_BYTES) {
          return cors(new Response("File too large", { status: 413 }));
        }
        const ct = request.headers.get("x-content-type") || "application/octet-stream";
        // Stream to R2 — no full buffering in worker memory for large files.
        if (!request.body) return cors(new Response("No body", { status: 400 }));
        await env.DROPS.put(key, request.body, { httpMetadata: { contentType: ct } });
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

    const purgeMatch = url.pathname.match(/^\/drop\/([A-Za-z0-9_-]+)$/);
    if (purgeMatch && request.method === "DELETE") {
      const dropId = purgeMatch[1];
      await env.DROPS.delete(`manifest/${dropId}.json`);
      const list = await env.DROPS.list({ prefix: `blob/${dropId}/` });
      await Promise.all(list.objects.map((o) => env.DROPS.delete(o.key)));
      return cors(new Response(JSON.stringify({ ok: true }), json()));
    }

    return cors(new Response("Not found", { status: 404 }));
  },
};

function json() {
  return { headers: { "content-type": "application/json" } };
}
function cors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  res.headers.set("Access-Control-Expose-Headers", "content-length, content-type");
  return res;
}

/** One room per Beam. Relays signaling messages between connected peers. */
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
