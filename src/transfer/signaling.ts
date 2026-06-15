import type { SignalMsg } from "./types";
import { SIGNAL_URL, HAS_CLOUD, TURN_URL, TURN_USER, TURN_CRED } from "@/lib/config";

/* ============================================================================
   Signaling transport — brokers SDP/ICE between peers. No file bytes ever pass
   through here. Two implementations behind one interface:

   • BroadcastChannelSignaling — zero-infra, same-origin cross-tab. Powers the
     local two-tab Beam demo with real RTCPeerConnections.
   • WebSocketSignaling — points at the Cloudflare Worker (packages/signaling-
     worker) for cross-device Beams. Activated when NEXT_PUBLIC_SIGNAL_URL is set.
   ========================================================================== */

export interface Signaling {
  send(msg: SignalMsg): void;
  onMessage(cb: (msg: SignalMsg) => void): void;
  close(): void;
  readonly ready: Promise<void>;
}

class BroadcastChannelSignaling implements Signaling {
  private bc: BroadcastChannel;
  private selfId: string;
  private cb: ((msg: SignalMsg) => void) | null = null;
  readonly ready = Promise.resolve();

  constructor(beamId: string, selfId: string) {
    this.selfId = selfId;
    this.bc = new BroadcastChannel(`ss-beam-${beamId}`);
    this.bc.onmessage = (e: MessageEvent) => {
      const env = e.data as { _from: string; msg: SignalMsg };
      if (!env || env._from === this.selfId) return; // ignore our own echoes
      this.cb?.(env.msg);
    };
  }

  send(msg: SignalMsg) {
    this.bc.postMessage({ _from: this.selfId, msg });
  }
  onMessage(cb: (msg: SignalMsg) => void) {
    this.cb = cb;
  }
  close() {
    try {
      this.bc.close();
    } catch {
      /* noop */
    }
  }
}

class WebSocketSignaling implements Signaling {
  private ws: WebSocket;
  private cb: ((msg: SignalMsg) => void) | null = null;
  private queue: SignalMsg[] = [];
  readonly ready: Promise<void>;

  constructor(url: string, beamId: string, private selfId: string) {
    const full = `${url.replace(/\/$/, "")}/beam/${beamId}?self=${encodeURIComponent(selfId)}`;
    this.ws = new WebSocket(full);
    this.ready = new Promise((resolve) => {
      this.ws.onopen = () => {
        for (const m of this.queue) this.ws.send(JSON.stringify(m));
        this.queue = [];
        resolve();
      };
    });
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as SignalMsg;
        if ((msg as { from?: string }).from === this.selfId) return;
        this.cb?.(msg);
      } catch {
        /* ignore malformed */
      }
    };
  }
  send(msg: SignalMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }
  onMessage(cb: (msg: SignalMsg) => void) {
    this.cb = cb;
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* noop */
    }
  }
}

/** True when a Worker URL is configured — i.e. cross-device Beams work. With
 *  the hardcoded config this is always true; only a blank override disables it,
 *  in which case signaling falls back to BroadcastChannel (same browser only). */
export const HAS_CLOUD_SIGNALING: boolean = HAS_CLOUD;

export function createSignaling(beamId: string, selfId: string): Signaling {
  if (SIGNAL_URL && typeof WebSocket !== "undefined") {
    try {
      return new WebSocketSignaling(SIGNAL_URL, beamId, selfId);
    } catch {
      /* fall through to local */
    }
  }
  return new BroadcastChannelSignaling(beamId, selfId);
}

/** ICE configuration. STUN is enough for same-machine + many home networks;
    TURN (set in src/lib/config.ts) is the fallback for hostile NATs. */
export const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(TURN_URL
      ? [{ urls: TURN_URL, username: TURN_USER, credential: TURN_CRED } as RTCIceServer]
      : []),
  ],
};
