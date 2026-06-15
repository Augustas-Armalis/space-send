var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var KB = 1024;
var MB = 1024 * KB;
var GB = 1024 * MB;
var BUCKET_LIMIT_BYTES = 9 * GB;
var MAX_FILE_BYTES = 50 * MB;
var MAX_DROP_BYTES = 1 * GB;
var MAX_MANIFEST_BYTES = 64 * KB;
var USAGE_KEY = "global";
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/" || url.pathname === "/health") {
      return cors(new Response(JSON.stringify({ ok: true, service: "space-send" }), json()));
    }
    if (url.pathname === "/usage" && request.method === "GET") {
      const stub = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      return cors(await stub.fetch("https://usage/read"));
    }
    const beamMatch = url.pathname.match(/^\/beam\/([A-Za-z0-9_-]+)$/);
    if (beamMatch) {
      const beamId = beamMatch[1];
      const id = env.BEAM_ROOMS.idFromName(beamId);
      const room = env.BEAM_ROOMS.get(id);
      return room.fetch(request);
    }
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
        if (!obj)
          return cors(new Response("Not found", { status: 404 }));
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
        if (!contentLength)
          return cors(new Response("content-length required", { status: 411 }));
        if (contentLength > MAX_FILE_BYTES) {
          return cors(jsonResp({ error: "file_too_large", max: MAX_FILE_BYTES }, 413));
        }
        if (!request.body)
          return cors(new Response("No body", { status: 400 }));
        const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
        const reserve = await usage.fetch("https://usage/reserve", {
          method: "POST",
          body: JSON.stringify({ dropId, fileId, bytes: contentLength })
        });
        if (reserve.status !== 200) {
          const body = await reserve.text();
          return cors(new Response(body, { status: reserve.status, headers: { "content-type": "application/json" } }));
        }
        const ct = request.headers.get("x-content-type") || "application/octet-stream";
        try {
          await env.DROPS.put(key, request.body, { httpMetadata: { contentType: ct } });
        } catch (e) {
          await usage.fetch("https://usage/release", {
            method: "POST",
            body: JSON.stringify({ dropId, fileId, bytes: contentLength })
          });
          return cors(new Response(`Storage error: ${e}`, { status: 502 }));
        }
        return cors(new Response(JSON.stringify({ ok: true }), json()));
      }
      if (request.method === "GET") {
        const obj = await env.DROPS.get(key);
        if (!obj)
          return cors(new Response("Not found", { status: 404 }));
        const headers = new Headers();
        headers.set("content-type", obj.httpMetadata?.contentType || "application/octet-stream");
        if (obj.size)
          headers.set("content-length", String(obj.size));
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
      const usage = env.USAGE.get(env.USAGE.idFromName(USAGE_KEY));
      await usage.fetch("https://usage/release-drop", {
        method: "POST",
        body: JSON.stringify({ dropId })
      });
      return cors(new Response(JSON.stringify({ ok: true }), json()));
    }
    return cors(new Response("Not found", { status: 404 }));
  }
};
function json() {
  return { headers: { "content-type": "application/json" } };
}
__name(json, "json");
function jsonResp(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
__name(jsonResp, "jsonResp");
function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  res.headers.set("Access-Control-Expose-Headers", "content-length, content-type");
  return res;
}
__name(cors, "cors");
var UsageCounter = class {
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/read") {
      const total = await this.state.storage.get("total") ?? 0;
      const drops = (await this.state.storage.list({ prefix: "drop:" })).size;
      return new Response(JSON.stringify({
        bytes: total,
        max: BUCKET_LIMIT_BYTES,
        drops,
        maxFileBytes: MAX_FILE_BYTES,
        maxDropBytes: MAX_DROP_BYTES
      }), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/reserve") {
      const { dropId, fileId, bytes } = await request.json();
      const total = await this.state.storage.get("total") ?? 0;
      const dropKey = `drop:${dropId}`;
      const dropTotal = await this.state.storage.get(dropKey) ?? 0;
      if (total + bytes > BUCKET_LIMIT_BYTES) {
        return jsonResp({
          error: "bucket_full",
          message: "Shared storage is full \u2014 try again later or use Beam (live P2P).",
          bytes: total,
          max: BUCKET_LIMIT_BYTES
        }, 507);
      }
      if (dropTotal + bytes > MAX_DROP_BYTES) {
        return jsonResp({
          error: "drop_too_large",
          message: `A single Drop can't exceed ${Math.round(MAX_DROP_BYTES / MB)} MB. Use Beam for larger sets.`,
          max: MAX_DROP_BYTES
        }, 413);
      }
      const fileKey = `file:${dropId}:${fileId}`;
      const existing = await this.state.storage.get(fileKey) ?? 0;
      const newTotal = total - existing + bytes;
      const newDropTotal = dropTotal - existing + bytes;
      await this.state.storage.put({
        total: newTotal,
        [dropKey]: newDropTotal,
        [fileKey]: bytes
      });
      return jsonResp({ ok: true, bytes: newTotal, max: BUCKET_LIMIT_BYTES }, 200);
    }
    if (url.pathname === "/release") {
      const { dropId, fileId, bytes } = await request.json();
      const total = await this.state.storage.get("total") ?? 0;
      const dropKey = `drop:${dropId}`;
      const dropTotal = await this.state.storage.get(dropKey) ?? 0;
      const fileKey = `file:${dropId}:${fileId}`;
      await this.state.storage.put("total", Math.max(0, total - bytes));
      const newDrop = Math.max(0, dropTotal - bytes);
      if (newDrop === 0)
        await this.state.storage.delete(dropKey);
      else
        await this.state.storage.put(dropKey, newDrop);
      await this.state.storage.delete(fileKey);
      return jsonResp({ ok: true }, 200);
    }
    if (url.pathname === "/release-drop") {
      const { dropId } = await request.json();
      const dropKey = `drop:${dropId}`;
      const dropTotal = await this.state.storage.get(dropKey) ?? 0;
      const total = await this.state.storage.get("total") ?? 0;
      const files = await this.state.storage.list({ prefix: `file:${dropId}:` });
      const updates = /* @__PURE__ */ new Map();
      updates.set("total", Math.max(0, total - dropTotal));
      for (const k of files.keys())
        updates.set(k, void 0);
      updates.set(dropKey, void 0);
      await this.state.storage.put("total", Math.max(0, total - dropTotal));
      await this.state.storage.delete(dropKey);
      const keys = [];
      for (const k of files.keys())
        keys.push(k);
      if (keys.length)
        await this.state.storage.delete(keys);
      return jsonResp({ ok: true }, 200);
    }
    return new Response("Not found", { status: 404 });
  }
};
__name(UsageCounter, "UsageCounter");
var BeamRoom = class {
  peers = /* @__PURE__ */ new Map();
  constructor(_state, _env) {
  }
  async fetch(request) {
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
    server.addEventListener("message", (event) => {
      let msg = null;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (!msg)
        return;
      const raw = typeof event.data === "string" ? event.data : "";
      if (msg.to) {
        const target = this.peers.get(msg.to);
        if (target && target.readyState === 1)
          target.send(raw);
      } else {
        for (const [peerId, ws] of this.peers) {
          if (peerId !== self && ws.readyState === 1)
            ws.send(raw);
        }
      }
    });
    const cleanup = /* @__PURE__ */ __name(() => {
      this.peers.delete(self);
      const bye = JSON.stringify({ kind: "bye", beam: url.pathname.split("/").pop(), from: self });
      for (const [, ws] of this.peers) {
        if (ws.readyState === 1)
          ws.send(bye);
      }
    }, "cleanup");
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);
    return new Response(null, { status: 101, webSocket: client });
  }
};
__name(BeamRoom, "BeamRoom");
export {
  BeamRoom,
  UsageCounter,
  src_default as default
};
//# sourceMappingURL=index.js.map
