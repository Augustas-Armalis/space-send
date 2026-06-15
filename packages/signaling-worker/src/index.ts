/**
 * Space Send — Signaling Worker
 *
 * A tiny Cloudflare Worker + Durable Object that brokers WebRTC SDP/ICE between
 * peers for a Beam. NO FILE BYTES EVER PASS THROUGH HERE — only offers, answers,
 * and ICE candidates. Each Beam id maps to one Durable Object "room"; peers join
 * over a WebSocket and the room relays messages, targeted (by `to`) or broadcast.
 *
 * Client contract (see apps/web src/transfer/signaling.ts):
 *   wss://<worker>/beam/<beamId>?self=<peerId>
 *   messages are JSON SignalMsg: { kind, beam, from, to?, sdp?, candidate? }
 *
 * Deploy:  wrangler deploy
 * Then set NEXT_PUBLIC_SIGNAL_URL=wss://<your-worker-subdomain>.workers.dev in the web app.
 */

export interface Env {
  BEAM_ROOMS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight / health
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/" || url.pathname === "/health") {
      return cors(new Response(JSON.stringify({ ok: true, service: "space-send-signaling" }), json()));
    }

    const match = url.pathname.match(/^\/beam\/([A-Za-z0-9_-]+)$/);
    if (!match) return cors(new Response("Not found", { status: 404 }));

    const beamId = match[1];
    const id = env.BEAM_ROOMS.idFromName(beamId);
    const room = env.BEAM_ROOMS.get(id);
    return room.fetch(request);
  },
};

function json() {
  return { headers: { "content-type": "application/json" } };
}
function cors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  return res;
}

/** One room per Beam. Relays signaling messages between connected peers. */
export class BeamRoom {
  private peers = new Map<string, WebSocket>();

  constructor(
    _state: DurableObjectState,
    _env: Env,
  ) {}

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
        // Targeted relay (offer/answer/ice)
        const target = this.peers.get(msg.to);
        if (target && target.readyState === 1) target.send(raw);
      } else {
        // Broadcast (hello/join/bye) to everyone except the sender
        for (const [peerId, ws] of this.peers) {
          if (peerId !== self && ws.readyState === 1) ws.send(raw);
        }
      }
    });

    const cleanup = () => {
      this.peers.delete(self);
      // Let the rest of the room know this peer left.
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
