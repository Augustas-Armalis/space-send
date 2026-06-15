import { createSignaling, ICE_CONFIG, type Signaling } from "./signaling";
import type { BeamManifest, BeamRecipient, DataMsg, FileMeta, SignalMsg } from "./types";
import { sha256Hex } from "@/lib/hash";

/* ============================================================================
   The Beam engine — real WebRTC data-channel file transfer. Your device IS the
   server. Bytes go peer-to-peer (DTLS-encrypted). Works between two browser
   tabs out of the box (BroadcastChannel signaling) and across devices when a
   signaling Worker URL is configured.
   ========================================================================== */

const CHUNK = 64 * 1024; // 64 KB — safe across browsers
const HIGH_WATER = 8 * 1024 * 1024; // pause streaming above 8 MB buffered
const LOW_WATER = 1 * 1024 * 1024;

export interface HostFile {
  meta: FileMeta;
  file: File;
}

export interface HostCallbacks {
  onRecipientJoin?: (r: BeamRecipient) => void;
  onRecipientUpdate?: (id: string, patch: Partial<BeamRecipient>) => void;
  onRecipientLeave?: (id: string) => void;
  onAggregateSpeed?: (bytesPerSec: number) => void;
  onSpark?: (id: string) => void;
}

interface PeerState {
  pc: RTCPeerConnection;
  channel?: RTCDataChannel;
  recipient: BeamRecipient;
  lastBytes: number;
  lastTime: number;
}

function bars(rtt: number): number {
  if (rtt < 40) return 5;
  if (rtt < 90) return 4;
  if (rtt < 160) return 3;
  if (rtt < 300) return 2;
  return 1;
}

export class BeamHost {
  private sig: Signaling;
  private peers = new Map<string, PeerState>();
  private throttle = 0; // bytes/sec, 0 = unlimited
  private closed = false;

  constructor(
    private beamId: string,
    private selfId: string,
    private files: HostFile[],
    private manifest: BeamManifest,
    private cb: HostCallbacks = {},
  ) {
    this.sig = createSignaling(beamId, selfId);
    this.sig.onMessage((m) => this.onSignal(m));
    // Announce we're live and invite anyone already waiting.
    this.sig.send({ kind: "hello", beam: beamId, from: selfId });
    this.startSpeedLoop();
  }

  setThrottle(bytesPerSec: number) {
    this.throttle = Math.max(0, bytesPerSec);
  }

  kick(recipientId: string) {
    const p = this.peers.get(recipientId);
    if (p) {
      try {
        p.channel?.close();
        p.pc.close();
      } catch {
        /* noop */
      }
      this.peers.delete(recipientId);
      this.cb.onRecipientLeave?.(recipientId);
    }
  }

  private async onSignal(m: SignalMsg) {
    if (m.beam !== this.beamId) return;
    if (m.kind === "join") {
      await this.createPeer(m.from);
    } else if (m.kind === "answer" && m.to === this.selfId) {
      const p = this.peers.get(m.from);
      if (p) await p.pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
    } else if (m.kind === "ice" && m.to === this.selfId) {
      const p = this.peers.get(m.from);
      if (p && m.candidate) {
        try {
          await p.pc.addIceCandidate(new RTCIceCandidate(m.candidate));
        } catch {
          /* ignore late candidates */
        }
      }
    } else if (m.kind === "bye") {
      this.kick(m.from);
    }
  }

  private async createPeer(remoteId: string) {
    if (this.peers.has(remoteId)) return;
    const pc = new RTCPeerConnection(ICE_CONFIG);
    const channel = pc.createDataChannel("beam", { ordered: true });
    channel.binaryType = "arraybuffer";

    const recipient: BeamRecipient = {
      id: remoteId,
      signal: 4,
      progress: 0,
      speed: 0,
      status: "reading",
      startedAt: Date.now(),
    };
    const state: PeerState = { pc, channel, recipient, lastBytes: 0, lastTime: Date.now() };
    this.peers.set(remoteId, state);
    this.cb.onRecipientJoin?.(recipient);

    pc.onicecandidate = (e) => {
      if (e.candidate)
        this.sig.send({
          kind: "ice",
          beam: this.beamId,
          from: this.selfId,
          to: remoteId,
          candidate: e.candidate.toJSON(),
        });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.cb.onRecipientUpdate?.(remoteId, { status: "disconnected" });
      }
    };
    channel.onopen = () => {
      this.cb.onSpark?.(remoteId);
      this.sendCtrl(channel, { t: "manifest", manifest: this.manifest });
    };
    channel.onmessage = (e) => this.onChannelMsg(remoteId, e.data);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sig.send({ kind: "offer", beam: this.beamId, from: this.selfId, to: remoteId, sdp: offer });
  }

  private onChannelMsg(remoteId: string, data: unknown) {
    if (typeof data !== "string") return;
    let msg: DataMsg;
    try {
      msg = JSON.parse(data) as DataMsg;
    } catch {
      return;
    }
    const p = this.peers.get(remoteId);
    if (!p) return;
    if (msg.t === "extract") {
      p.recipient.status = "extracting";
      this.cb.onRecipientUpdate?.(remoteId, { status: "extracting", startedAt: Date.now() });
      void this.streamTo(remoteId, msg.fileIds);
    } else if (msg.t === "progress") {
      const total = this.manifest.totalSize || 1;
      const frac = Math.min(1, msg.received / total);
      const now = Date.now();
      const dt = (now - p.lastTime) / 1000;
      const speed = dt > 0 ? (msg.received - p.lastBytes) / dt : p.recipient.speed;
      p.lastBytes = msg.received;
      p.lastTime = now;
      p.recipient.progress = frac;
      p.recipient.speed = speed > 0 ? speed : p.recipient.speed;
      this.cb.onRecipientUpdate?.(remoteId, { progress: frac, speed: p.recipient.speed });
    } else if (msg.t === "complete") {
      p.recipient.status = "complete";
      p.recipient.progress = 1;
      p.recipient.completedAt = Date.now();
      this.cb.onRecipientUpdate?.(remoteId, { status: "complete", progress: 1, completedAt: Date.now() });
    }
  }

  private sendCtrl(channel: RTCDataChannel, msg: DataMsg) {
    try {
      channel.send(JSON.stringify(msg));
    } catch {
      /* channel closing */
    }
  }

  private async streamTo(remoteId: string, fileIds: string[]) {
    const p = this.peers.get(remoteId);
    if (!p || !p.channel) return;
    const channel = p.channel;
    channel.bufferedAmountLowThreshold = LOW_WATER;
    const wanted = this.files.filter((f) => fileIds.includes(f.meta.id));

    for (const { meta, file } of wanted) {
      if (this.closed) return;
      this.sendCtrl(channel, { t: "file-begin", id: meta.id, name: meta.name, size: meta.size, mime: meta.mime });
      let offset = 0;
      let lastThrottleTs = Date.now();
      let sentSinceThrottle = 0;
      while (offset < file.size) {
        if (this.closed || channel.readyState !== "open") return;
        const slice = file.slice(offset, Math.min(offset + CHUNK, file.size));
        const buf = await slice.arrayBuffer();
        // Backpressure
        if (channel.bufferedAmount > HIGH_WATER) await this.waitDrain(channel);
        // Optional throttle
        if (this.throttle > 0) {
          sentSinceThrottle += buf.byteLength;
          const elapsed = (Date.now() - lastThrottleTs) / 1000;
          const allowed = this.throttle * elapsed;
          if (sentSinceThrottle > allowed) {
            const waitMs = ((sentSinceThrottle - allowed) / this.throttle) * 1000;
            await new Promise((r) => setTimeout(r, Math.min(250, waitMs)));
          }
          if (elapsed > 1) {
            lastThrottleTs = Date.now();
            sentSinceThrottle = 0;
          }
        }
        try {
          channel.send(buf);
        } catch {
          return;
        }
        offset += buf.byteLength;
      }
      this.sendCtrl(channel, { t: "file-end", id: meta.id, hash: meta.hash });
    }
  }

  private waitDrain(channel: RTCDataChannel): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        channel.removeEventListener("bufferedamountlow", handler);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", handler);
    });
  }

  private startSpeedLoop() {
    const tick = () => {
      if (this.closed) return;
      let agg = 0;
      this.peers.forEach((p) => {
        if (p.recipient.status === "extracting") agg += p.recipient.speed;
        // Refresh signal from RTT when available.
        p.pc.getStats?.().then((stats) => {
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime != null) {
              const b = bars(report.currentRoundTripTime * 1000);
              if (b !== p.recipient.signal) {
                p.recipient.signal = b;
                this.cb.onRecipientUpdate?.(p.recipient.id, { signal: b });
              }
            }
          });
        });
      });
      this.cb.onAggregateSpeed?.(agg);
      this.timer = setTimeout(tick, 1000);
    };
    this.timer = setTimeout(tick, 1000);
  }
  private timer: ReturnType<typeof setTimeout> | null = null;

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.sig.send({ kind: "bye", beam: this.beamId, from: this.selfId });
    this.peers.forEach((p) => {
      try {
        p.channel?.close();
        p.pc.close();
      } catch {
        /* noop */
      }
    });
    this.peers.clear();
    this.sig.close();
  }
}

/* ---------------------------------------------------------------------------- */

export interface ReceiverCallbacks {
  onManifest?: (m: BeamManifest) => void;
  onConnecting?: () => void;
  onConnected?: () => void;
  onFileProgress?: (id: string, received: number, total: number, speed: number) => void;
  onFileComplete?: (id: string, blob: Blob, verified: boolean) => void;
  onAllComplete?: () => void;
  onSignal?: (bars: number) => void;
  onError?: (e: Error) => void;
  onSevered?: (atFraction: number) => void;
}

interface IncomingFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  received: number;
  chunks: Uint8Array[];
  expectedHash?: string;
}

export class BeamReceiver {
  private sig: Signaling;
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private incoming = new Map<string, IncomingFile>();
  private current: IncomingFile | null = null;
  private manifest: BeamManifest | null = null;
  private totalReceived = 0;
  private lastBytes = 0;
  private lastTime = Date.now();
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private hostId: string | null = null;
  private closed = false;

  constructor(
    private beamId: string,
    private selfId: string,
    private cb: ReceiverCallbacks = {},
  ) {
    this.sig = createSignaling(beamId, selfId);
    this.pc = new RTCPeerConnection(ICE_CONFIG);
    this.cb.onConnecting?.();
    this.wirePc();
    this.sig.onMessage((m) => this.onSignal(m));
    // Announce presence; host will offer.
    void this.sig.ready.then(() => {
      this.sig.send({ kind: "join", beam: beamId, from: selfId });
    });
  }

  private wirePc() {
    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.hostId)
        this.sig.send({
          kind: "ice",
          beam: this.beamId,
          from: this.selfId,
          to: this.hostId,
          candidate: e.candidate.toJSON(),
        });
    };
    this.pc.ondatachannel = (e) => {
      this.channel = e.channel;
      this.channel.binaryType = "arraybuffer";
      this.channel.onopen = () => {
        this.cb.onConnected?.();
        this.send({ t: "ready" });
        this.startProgressLoop();
      };
      this.channel.onmessage = (ev) => this.onData(ev.data);
      this.channel.onclose = () => {
        if (!this.closed && this.manifest && this.totalReceived < (this.manifest.totalSize || 1)) {
          this.cb.onSevered?.(this.totalReceived / (this.manifest.totalSize || 1));
        }
      };
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === "failed") this.cb.onError?.(new Error("Beam severed"));
    };
  }

  private async onSignal(m: SignalMsg) {
    if (m.beam !== this.beamId) return;
    if (m.kind === "hello") {
      // Host came online after us — re-announce.
      this.sig.send({ kind: "join", beam: this.beamId, from: this.selfId });
    } else if (m.kind === "offer" && (m.to === this.selfId || !m.to)) {
      this.hostId = m.from;
      await this.pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.sig.send({ kind: "answer", beam: this.beamId, from: this.selfId, to: m.from, sdp: answer });
    } else if (m.kind === "ice" && m.to === this.selfId) {
      if (m.candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(m.candidate));
        } catch {
          /* ignore */
        }
      }
    } else if (m.kind === "bye") {
      if (!this.closed) this.cb.onError?.(new Error("Host left"));
    }
  }

  private send(msg: DataMsg) {
    if (this.channel && this.channel.readyState === "open") {
      try {
        this.channel.send(JSON.stringify(msg));
      } catch {
        /* noop */
      }
    }
  }

  startExtract(fileIds: string[]) {
    this.send({ t: "extract", fileIds });
  }

  private onData(data: unknown) {
    if (typeof data === "string") {
      let msg: DataMsg;
      try {
        msg = JSON.parse(data) as DataMsg;
      } catch {
        return;
      }
      if (msg.t === "manifest") {
        this.manifest = msg.manifest;
        this.cb.onManifest?.(msg.manifest);
      } else if (msg.t === "file-begin") {
        this.current = {
          id: msg.id,
          name: msg.name,
          size: msg.size,
          mime: msg.mime,
          received: 0,
          chunks: [],
        };
        this.incoming.set(msg.id, this.current);
      } else if (msg.t === "file-end") {
        void this.finishFile(msg.id, msg.hash);
      } else if (msg.t === "signal") {
        this.cb.onSignal?.(msg.bars);
      }
      return;
    }
    // Binary chunk
    if (!this.current) return;
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : null;
    if (!buf) return;
    this.current.chunks.push(buf);
    this.current.received += buf.byteLength;
    this.totalReceived += buf.byteLength;
    const total = this.manifest?.totalSize || this.current.size;
    this.cb.onFileProgress?.(this.current.id, this.current.received, this.current.size, this.instSpeed());
    void total;
  }

  private instSpeed(): number {
    const now = Date.now();
    const dt = (now - this.lastTime) / 1000;
    if (dt < 0.25) return this._lastSpeed;
    const speed = (this.totalReceived - this.lastBytes) / dt;
    this.lastBytes = this.totalReceived;
    this.lastTime = now;
    this._lastSpeed = speed * 0.4 + this._lastSpeed * 0.6; // EMA
    return this._lastSpeed;
  }
  private _lastSpeed = 0;

  private async finishFile(id: string, expectedHash?: string) {
    const f = this.incoming.get(id);
    if (!f) return;
    const blob = new Blob(f.chunks as BlobPart[], { type: f.mime });
    let verified = true;
    if (expectedHash) {
      try {
        const got = await sha256Hex(await blob.arrayBuffer());
        verified = got === expectedHash;
      } catch {
        verified = false;
      }
    }
    f.chunks = []; // free memory
    this.cb.onFileComplete?.(id, blob, verified);
    this.current = null;
    // All done?
    if (this.manifest && this.incoming.size >= this.manifest.files.length) {
      const allDone = this.manifest.files.every((mf) => {
        const inc = this.incoming.get(mf.id);
        return inc && inc.received >= inc.size;
      });
      if (allDone) {
        this.send({ t: "complete" });
        this.cb.onAllComplete?.();
        this.stopProgressLoop();
      }
    }
  }

  private startProgressLoop() {
    // Bilateral telemetry: report received bytes to the host at 4 Hz.
    this.progressTimer = setInterval(() => {
      if (this.current) this.send({ t: "progress", id: this.current.id, received: this.totalReceived });
    }, 250);
  }
  private stopProgressLoop() {
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.progressTimer = null;
  }

  close() {
    this.closed = true;
    this.stopProgressLoop();
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      /* noop */
    }
    this.sig.send({ kind: "bye", beam: this.beamId, from: this.selfId });
    this.sig.close();
  }
}
