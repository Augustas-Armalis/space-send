import { createSignaling, ICE_CONFIG, type Signaling } from "./signaling";
import type { BeamManifest, BeamRecipient, DataMsg, FileMeta, SignalMsg } from "./types";
import { sha256Hex } from "@/lib/hash";

/* ============================================================================
   The Beam engine — a custom multi-lane WebRTC file transfer. The HOST device
   IS the server: it keeps the selected File handles in memory and streams their
   bytes peer-to-peer (DTLS-encrypted) to every viewer. No bytes touch any cloud.

   What makes it fast:
   • A control channel (ordered) carries JSON framing. N DATA channels
     ("lanes", UNORDERED + reliable) carry the bytes. Unordered delivery means a
     single lost/late packet never head-of-line-blocks the whole stream — a huge
     win on Wi-Fi and mobile.
   • Every binary chunk is offset-framed ([8-byte position][payload]) so the
     receiver writes each chunk straight to its exact spot — order doesn't
     matter, lanes run in parallel, and the receiver can write to disk directly.
   • Because the control channel and data lanes are separate streams, "file-end"
     can arrive before the last bytes — so completion is detected by
     bytes-received == size, never by the control message alone.
   • Overdrive cranks lanes + buffer + chunk size to trade RAM/CPU for speed.
   ========================================================================== */

const TARGET_CHUNK = 256 * 1024;       // payload size per message (clamped to maxMessageSize)
const HIGH_WATER = 64 * 1024 * 1024;   // total in-flight buffer before pausing
const READ_BLOCK = 16 * 1024 * 1024;   // read the file 16 MB at a time
const STREAM_TO_DISK_MIN = 64 * 1024 * 1024; // use the save-picker for files ≥ 64 MB
// A few unordered lanes avoid per-stream send stalls without flooding the
// single SCTP association (which shares one congestion window — more lanes past
// a handful just add overhead, as measured). The real throughput/robustness win
// is the UNORDERED + offset-framed delivery, which kills head-of-line blocking.
const NORMAL_LANES = 4;
const TURBO_LANES = 4; // keep lanes constant — extra lanes measured slower
const HEADER = 8; // bytes of offset header prefixing each binary chunk

// Overdrive cranks the in-flight buffer, read size, and (where the browser
// allows large messages, e.g. Firefox) the chunk size — it never adds lanes.
const TURBO_CHUNK = 1024 * 1024;
const TURBO_HIGH_WATER = 128 * 1024 * 1024;
const TURBO_READ_BLOCK = 32 * 1024 * 1024;

export interface HostFile {
  meta: FileMeta;
  file: File;
}

/** Live host-side telemetry, emitted ~1 Hz while a Beam is broadcasting. */
export interface BeamHostStats {
  connected: number;
  active: number;
  completed: number;
  aggSpeed: number;
  bufferedBytes: number;
  load: number;
}

export interface HostCallbacks {
  onRecipientJoin?: (r: BeamRecipient) => void;
  onRecipientUpdate?: (id: string, patch: Partial<BeamRecipient>) => void;
  onRecipientLeave?: (id: string) => void;
  onAggregateSpeed?: (bytesPerSec: number) => void;
  onStats?: (s: BeamHostStats) => void;
  onSpark?: (id: string) => void;
}

interface PeerState {
  pc: RTCPeerConnection;
  ctrl: RTCDataChannel;
  lanes: RTCDataChannel[];
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

function regionFromGeo(geo?: { country?: string; city?: string }): string | undefined {
  if (!geo) return undefined;
  if (geo.city && geo.country) return `${geo.city}, ${geo.country}`;
  return geo.country || geo.city || undefined;
}

function waitOpen(ch: RTCDataChannel, timeoutMs = 8000): Promise<boolean> {
  if (ch.readyState === "open") return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      ch.removeEventListener("open", onOpen);
      clearTimeout(t);
      resolve(v);
    };
    const onOpen = () => done(true);
    ch.addEventListener("open", onOpen);
    const t = setTimeout(() => done(ch.readyState === "open"), timeoutMs);
  });
}

export class BeamHost {
  private sig: Signaling;
  private peers = new Map<string, PeerState>();
  private throttle = 0;
  private turbo = false;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private beamId: string,
    private selfId: string,
    private files: HostFile[],
    private manifest: BeamManifest,
    private cb: HostCallbacks = {},
  ) {
    this.sig = createSignaling(beamId, selfId);
    this.sig.onMessage((m) => this.onSignal(m));
    void this.sig.ready.then(() => this.sig.send({ kind: "hello", beam: beamId, from: selfId }));
    this.startSpeedLoop();
  }

  addFiles(more: HostFile[]) {
    this.files.push(...more);
    this.manifest = {
      ...this.manifest,
      files: this.files.map((f) => ({ id: f.meta.id, name: f.meta.name, size: f.meta.size, mime: f.meta.mime, hash: f.meta.hash })),
      totalSize: this.files.reduce((a, f) => a + f.meta.size, 0),
    };
    this.peers.forEach((p) => {
      if (p.ctrl.readyState === "open") this.sendCtrl(p.ctrl, { t: "manifest", manifest: this.manifest });
    });
  }

  fileCount() {
    return this.files.length;
  }

  /** Overdrive: more lanes + buffer + chunk size. Lanes apply to peers that
   *  connect after the toggle; buffer/chunk apply live. */
  setTurbo(on: boolean) {
    this.turbo = on;
  }

  setThrottle(bytesPerSec: number) {
    this.throttle = Math.max(0, bytesPerSec);
  }

  kick(recipientId: string) {
    const p = this.peers.get(recipientId);
    if (p) {
      try {
        p.ctrl.close();
        p.lanes.forEach((l) => l.close());
        p.pc.close();
      } catch {
        /* noop */
      }
      this.peers.delete(recipientId);
      this.cb.onRecipientLeave?.(recipientId);
    }
  }

  private async onSignal(m: SignalMsg & { geo?: { country?: string; city?: string } }) {
    if (m.beam !== this.beamId) return;
    if (m.kind === "join") {
      await this.createPeer(m.from, regionFromGeo(m.geo));
    } else if (m.kind === "answer" && m.to === this.selfId) {
      const p = this.peers.get(m.from);
      if (p) await p.pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
    } else if (m.kind === "ice" && m.to === this.selfId) {
      const p = this.peers.get(m.from);
      if (p && m.candidate) {
        try {
          await p.pc.addIceCandidate(new RTCIceCandidate(m.candidate));
        } catch {
          /* late candidate */
        }
      }
    } else if (m.kind === "bye") {
      this.kick(m.from);
    }
  }

  private async createPeer(remoteId: string, region?: string) {
    if (this.peers.has(remoteId)) return;
    const pc = new RTCPeerConnection(ICE_CONFIG);

    // Control channel (ordered, reliable) for JSON framing.
    const ctrl = pc.createDataChannel("ctrl", { ordered: true });
    ctrl.binaryType = "arraybuffer";

    // Data lanes (unordered, reliable) — created BEFORE the offer so they ride
    // the initial SDP with no renegotiation.
    const laneCount = this.turbo ? TURBO_LANES : NORMAL_LANES;
    const lanes: RTCDataChannel[] = [];
    for (let i = 0; i < laneCount; i++) {
      const dc = pc.createDataChannel(`data-${i}`, { ordered: false });
      dc.binaryType = "arraybuffer";
      lanes.push(dc);
    }

    const recipient: BeamRecipient = {
      id: remoteId,
      region,
      signal: 4,
      progress: 0,
      speed: 0,
      status: "reading",
      startedAt: Date.now(),
    };
    const state: PeerState = { pc, ctrl, lanes, recipient, lastBytes: 0, lastTime: Date.now() };
    this.peers.set(remoteId, state);
    this.cb.onRecipientJoin?.(recipient);

    pc.onicecandidate = (e) => {
      if (e.candidate)
        this.sig.send({ kind: "ice", beam: this.beamId, from: this.selfId, to: remoteId, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.cb.onRecipientUpdate?.(remoteId, { status: "disconnected" });
      }
    };
    ctrl.onopen = () => {
      this.cb.onSpark?.(remoteId);
      this.sendCtrl(ctrl, { t: "manifest", manifest: this.manifest });
    };
    ctrl.onmessage = (e) => this.onChannelMsg(remoteId, e.data);

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
    if (!p) return;
    // Wait for the data lanes to open, then stream across the open ones.
    await Promise.all(p.lanes.map((l) => waitOpen(l)));
    const lanes = p.lanes.filter((l) => l.readyState === "open");
    if (lanes.length === 0) return;

    const maxMsg = (p.pc.sctp?.maxMessageSize as number | undefined) || TARGET_CHUNK;
    const chunkTarget = this.turbo ? TURBO_CHUNK : TARGET_CHUNK;
    const highWater = this.turbo ? TURBO_HIGH_WATER : HIGH_WATER;
    const readBlock = this.turbo ? TURBO_READ_BLOCK : READ_BLOCK;
    // Payload must leave room for the 8-byte header within the max message size.
    const payloadSize = Math.max(16 * 1024, Math.min(chunkTarget, maxMsg - HEADER));
    const perLaneHigh = Math.max(1 * 1024 * 1024, Math.floor(highWater / lanes.length));
    lanes.forEach((l) => (l.bufferedAmountLowThreshold = Math.floor(perLaneHigh / 2)));

    const wanted = this.files.filter((f) => fileIds.includes(f.meta.id));

    for (const { meta, file } of wanted) {
      if (this.closed) return;
      this.sendCtrl(p.ctrl, { t: "file-begin", id: meta.id, name: meta.name, size: meta.size, mime: meta.mime });
      let offset = 0;
      let laneIdx = 0;
      let lastThrottleTs = Date.now();
      let sentSinceThrottle = 0;

      while (offset < file.size) {
        if (this.closed) return;
        const block = await file.slice(offset, Math.min(offset + readBlock, file.size)).arrayBuffer();
        let bp = 0;
        while (bp < block.byteLength) {
          if (this.closed) return;
          const payloadLen = Math.min(payloadSize, block.byteLength - bp);
          const absOffset = offset + bp;
          // Frame: [8-byte Float64 offset][payload]. Float64 is exact to 2^53
          // bytes (~9 PB) — far beyond any real file.
          const framed = new Uint8Array(HEADER + payloadLen);
          new DataView(framed.buffer).setFloat64(0, absOffset);
          framed.set(new Uint8Array(block, bp, payloadLen), HEADER);

          const lane = lanes[laneIdx % lanes.length];
          if (lane.readyState !== "open") return;
          if (lane.bufferedAmount > perLaneHigh) await this.waitDrain(lane);

          if (this.throttle > 0) {
            sentSinceThrottle += payloadLen;
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
            lane.send(framed);
          } catch {
            return;
          }
          bp += payloadLen;
          laneIdx++;
        }
        offset += block.byteLength;
      }

      // Drain every lane before announcing the end, so the file-end (on the
      // separate ordered control channel) doesn't beat the last bytes out.
      await Promise.all(lanes.map((l) => this.drainFully(l)));
      this.sendCtrl(p.ctrl, { t: "file-end", id: meta.id, hash: meta.hash });
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

  private drainFully(channel: RTCDataChannel): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.closed || channel.readyState !== "open" || channel.bufferedAmount === 0) return resolve();
        setTimeout(check, 30);
      };
      check();
    });
  }

  private startSpeedLoop() {
    const tick = () => {
      if (this.closed) return;
      let agg = 0;
      let connected = 0;
      let active = 0;
      let completed = 0;
      let bufferedBytes = 0;
      this.peers.forEach((p) => {
        if (p.ctrl.readyState === "open") connected += 1;
        if (p.recipient.status === "extracting") {
          active += 1;
          agg += p.recipient.speed;
        }
        if (p.recipient.status === "complete") completed += 1;
        p.lanes.forEach((l) => (bufferedBytes += l.bufferedAmount));
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
      const bufferLoad = Math.min(1, bufferedBytes / (HIGH_WATER * Math.max(1, active)));
      const peerLoad = Math.min(1, active / 6);
      const load = Math.min(1, bufferLoad * 0.6 + peerLoad * 0.4);
      this.cb.onStats?.({ connected, active, completed, aggSpeed: agg, bufferedBytes, load });
      this.timer = setTimeout(tick, 1000);
    };
    this.timer = setTimeout(tick, 1000);
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.sig.send({ kind: "bye", beam: this.beamId, from: this.selfId });
    this.peers.forEach((p) => {
      try {
        p.ctrl.close();
        p.lanes.forEach((l) => l.close());
        p.pc.close();
      } catch {
        /* noop */
      }
    });
    this.peers.clear();
    this.sig.close();
  }
}

/* ============================================================================
   Viewer side.
   ========================================================================== */

export interface ReceiverCallbacks {
  onManifest?: (m: BeamManifest) => void;
  onConnecting?: () => void;
  onConnected?: () => void;
  onFileProgress?: (id: string, received: number, total: number, speed: number) => void;
  onFileComplete?: (id: string, verified: boolean) => void;
  onSignal?: (bars: number) => void;
  onError?: (e: Error) => void;
  onHostGone?: () => void;
}

/** A seekable place to put incoming bytes — a streaming disk writer (File
 *  System Access API) or an in-memory buffer that becomes a Blob. Chunks can
 *  arrive out of order, so every write is positioned. */
interface Sink {
  writeAt(offset: number, chunk: Uint8Array): Promise<void> | void;
  finish(): Promise<Blob | null>;
  abort(): void;
  hash: boolean;
}

function makeBlobSink(mime: string, size: number): Sink {
  const buf = new Uint8Array(size);
  return {
    writeAt(offset, chunk) {
      buf.set(chunk, offset);
    },
    async finish() {
      return new Blob([buf], { type: mime });
    },
    abort() {
      /* buffer is GC'd with the sink */
    },
    hash: true,
  };
}

async function makeDiskSink(name: string): Promise<Sink | null> {
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<unknown> }).showSaveFilePicker;
  if (!picker) return null;
  try {
    const handle = (await picker({ suggestedName: name })) as {
      createWritable: () => Promise<{ write: (d: unknown) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }>;
    };
    const writable = await handle.createWritable();
    return {
      async writeAt(offset, chunk) {
        await writable.write({ type: "write", position: offset, data: chunk });
      },
      async finish() {
        await writable.close();
        return null;
      },
      abort() {
        void writable.abort?.();
      },
      hash: false,
    };
  } catch {
    return null;
  }
}

interface ActiveDownload {
  fileId: string;
  size: number;
  received: number;
  sink: Sink;
  expectedHash?: string;
  ended: boolean;
  finished: boolean;
  onDone: () => void;
  reject: (e: Error) => void;
}

export class BeamReceiver {
  private sig: Signaling;
  private pc: RTCPeerConnection;
  private ctrl: RTCDataChannel | null = null;
  private manifest: BeamManifest | null = null;
  private hostId: string | null = null;
  private closed = false;
  private connected = false;

  private active: ActiveDownload | null = null;
  private queue: (() => void)[] = [];

  private lastBytes = 0;
  private lastTime = Date.now();
  private emaSpeed = 0;
  private lastProgressSent = 0;

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
    void this.sig.ready.then(() => this.sig.send({ kind: "join", beam: beamId, from: selfId }));
  }

  get isConnected() {
    return this.connected;
  }

  private wirePc() {
    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.hostId)
        this.sig.send({ kind: "ice", beam: this.beamId, from: this.selfId, to: this.hostId, candidate: e.candidate.toJSON() });
    };
    this.pc.ondatachannel = (e) => {
      const ch = e.channel;
      ch.binaryType = "arraybuffer";
      if (ch.label === "ctrl") {
        this.ctrl = ch;
        ch.onopen = () => {
          this.connected = true;
          this.cb.onConnected?.();
        };
        ch.onmessage = (ev) => this.onCtrl(ev.data);
        ch.onclose = () => {
          if (this.active && !this.active.finished) {
            this.active.reject(new Error("Connection closed mid-transfer"));
            this.active = null;
          }
        };
      } else {
        // A data lane.
        ch.onmessage = (ev) => this.onBinary(ev.data);
      }
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === "failed") this.cb.onError?.(new Error("Beam connection failed"));
    };
  }

  private async onSignal(m: SignalMsg) {
    if (m.beam !== this.beamId) return;
    if (m.kind === "hello") {
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
      if (!this.closed) this.cb.onHostGone?.();
    }
  }

  private send(msg: DataMsg) {
    if (this.ctrl && this.ctrl.readyState === "open") {
      try {
        this.ctrl.send(JSON.stringify(msg));
      } catch {
        /* noop */
      }
    }
  }

  /** Download one file. opts.save=false skips the browser save (used by the
   *  in-page self-test). MUST be called from a user gesture for the picker. */
  async download(
    file: { id: string; name: string; size: number; mime: string; hash?: string },
    opts: { save?: boolean } = {},
  ): Promise<void> {
    const save = opts.save !== false;
    let sink: Sink | null = null;
    if (save && file.size >= STREAM_TO_DISK_MIN) sink = await makeDiskSink(file.name);
    if (!sink) sink = makeBlobSink(file.mime, file.size);
    const chosen = sink;

    await new Promise<void>((resolve, reject) => {
      const start = () => {
        this.active = {
          fileId: file.id,
          size: file.size,
          received: 0,
          sink: chosen,
          ended: false,
          finished: false,
          onDone: resolve,
          reject,
        };
        this.lastBytes = 0;
        this.lastTime = Date.now();
        this.emaSpeed = 0;
        this.send({ t: "extract", fileIds: [file.id] });
      };
      if (this.active) this.queue.push(start);
      else start();
    }).finally(() => {
      const next = this.queue.shift();
      if (next) next();
    });

    // Finalize: disk sinks return null (already on disk); blob sinks return a
    // Blob we verify (if a hash was sent) and optionally hand to the browser.
    const blob = await chosen.finish();
    let verified = true;
    if (blob) {
      if (file.hash) {
        try {
          verified = (await sha256Hex(await blob.arrayBuffer())) === file.hash;
        } catch {
          verified = false;
        }
      }
      if (save) triggerDownload(blob, file.name);
    }
    this.cb.onFileComplete?.(file.id, verified);
  }

  private onCtrl(data: unknown) {
    if (typeof data !== "string") return;
    let msg: DataMsg;
    try {
      msg = JSON.parse(data) as DataMsg;
    } catch {
      return;
    }
    if (msg.t === "manifest") {
      this.manifest = msg.manifest;
      this.cb.onManifest?.(msg.manifest);
    } else if (msg.t === "file-end") {
      const a = this.active;
      if (a) {
        a.expectedHash = msg.hash;
        a.ended = true;
        this.maybeFinish();
      }
    } else if (msg.t === "signal") {
      this.cb.onSignal?.(msg.bars);
    }
  }

  private onBinary(data: unknown) {
    const a = this.active;
    if (!a) return;
    const ab = data instanceof ArrayBuffer ? data : null;
    if (!ab || ab.byteLength <= HEADER) return;
    const offset = new DataView(ab).getFloat64(0);
    const payload = new Uint8Array(ab, HEADER);
    void a.sink.writeAt(offset, payload);
    a.received += payload.byteLength;

    this.cb.onFileProgress?.(a.fileId, a.received, a.size, this.instSpeed(a.received));
    const now = Date.now();
    if (now - this.lastProgressSent > 200) {
      this.lastProgressSent = now;
      this.send({ t: "progress", id: a.fileId, received: a.received });
    }
    // Completion is driven by bytes received, not the control message — the
    // file-end can arrive before the last bytes (separate streams).
    if (a.received >= a.size) this.maybeFinish();
  }

  /** Finish once all bytes are in. Idempotent. */
  private maybeFinish() {
    const a = this.active;
    if (!a || a.finished) return;
    if (a.received < a.size) return;
    a.finished = true;
    this.active = null;
    this.send({ t: "progress", id: a.fileId, received: a.size });
    a.onDone();
  }

  private instSpeed(received: number): number {
    const now = Date.now();
    const dt = (now - this.lastTime) / 1000;
    if (dt < 0.25) return this.emaSpeed;
    const speed = (received - this.lastBytes) / dt;
    this.lastBytes = received;
    this.lastTime = now;
    this.emaSpeed = speed * 0.4 + this.emaSpeed * 0.6;
    return this.emaSpeed;
  }

  close() {
    this.closed = true;
    if (this.active && !this.active.finished) this.active.sink.abort();
    try {
      this.ctrl?.close();
      this.pc.close();
    } catch {
      /* noop */
    }
    this.sig.send({ kind: "bye", beam: this.beamId, from: this.selfId });
    this.sig.close();
  }
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
