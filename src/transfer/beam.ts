import { createSignaling, ICE_CONFIG, type Signaling } from "./signaling";
import type { BeamManifest, BeamRecipient, DataMsg, FileMeta, SignalMsg } from "./types";
import { sha256Hex } from "@/lib/hash";

/* ============================================================================
   The Beam engine — real WebRTC data-channel file transfer. The HOST device IS
   the server: it keeps the selected File handles in memory and streams their
   bytes peer-to-peer (DTLS-encrypted) to every viewer who opens the link. No
   bytes touch any cloud — Cloudflare only relays the WebRTC handshake.

   • One host, many simultaneous viewers (a peer + data channel each).
   • Host can add files at any time → manifest re-broadcasts to all viewers.
   • Viewers SEE the file list and choose what to download. Large files stream
     straight to disk via the File System Access API when available, so a 10 GB
     transfer never has to fit in RAM.
   ========================================================================== */

// Throughput tuning. The old 64 KB chunks + 8 MB buffer left the pipe starved.
// We now send big chunks (clamped to the SCTP max-message-size per connection),
// read the file in large blocks (one arrayBuffer() per 16 MB instead of per
// chunk), and keep up to 64 MB in flight before pausing. On a fast LAN/Wi-Fi
// this is several times faster.
const TARGET_CHUNK = 256 * 1024;       // desired per-message size (clamped below)
const HIGH_WATER = 64 * 1024 * 1024;   // keep up to 64 MB buffered before pausing
const LOW_WATER = 16 * 1024 * 1024;    // resume once it drains under 16 MB
const READ_BLOCK = 16 * 1024 * 1024;   // read the file 16 MB at a time
const STREAM_TO_DISK_MIN = 64 * 1024 * 1024; // use the save-picker for files ≥ 64 MB

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

function regionFromGeo(geo?: { country?: string; city?: string }): string | undefined {
  if (!geo) return undefined;
  if (geo.city && geo.country) return `${geo.city}, ${geo.country}`;
  return geo.country || geo.city || undefined;
}

export class BeamHost {
  private sig: Signaling;
  private peers = new Map<string, PeerState>();
  private throttle = 0;
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

  /** Add files to a live Beam and push the new manifest to every viewer. */
  addFiles(more: HostFile[]) {
    this.files.push(...more);
    this.manifest = {
      ...this.manifest,
      files: this.files.map((f) => ({ id: f.meta.id, name: f.meta.name, size: f.meta.size, mime: f.meta.mime, hash: f.meta.hash })),
      totalSize: this.files.reduce((a, f) => a + f.meta.size, 0),
    };
    this.peers.forEach((p) => {
      if (p.channel && p.channel.readyState === "open") this.sendCtrl(p.channel, { t: "manifest", manifest: this.manifest });
    });
  }

  fileCount() {
    return this.files.length;
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
    const channel = pc.createDataChannel("beam", { ordered: true });
    channel.binaryType = "arraybuffer";

    const recipient: BeamRecipient = {
      id: remoteId,
      region,
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
        this.sig.send({ kind: "ice", beam: this.beamId, from: this.selfId, to: remoteId, candidate: e.candidate.toJSON() });
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
    // Send the largest message the SCTP transport allows (clamped to our
    // target). Bigger messages = far less per-chunk overhead.
    const maxMsg = (p.pc.sctp?.maxMessageSize as number | undefined) || TARGET_CHUNK;
    const chunkSize = Math.max(16 * 1024, Math.min(TARGET_CHUNK, maxMsg));
    const wanted = this.files.filter((f) => fileIds.includes(f.meta.id));

    for (const { meta, file } of wanted) {
      if (this.closed || channel.readyState !== "open") return;
      this.sendCtrl(channel, { t: "file-begin", id: meta.id, name: meta.name, size: meta.size, mime: meta.mime });
      let offset = 0;
      let lastThrottleTs = Date.now();
      let sentSinceThrottle = 0;
      // Read the file one big block at a time, then fire many large chunks from
      // that in-memory block with no per-chunk await for disk I/O.
      while (offset < file.size) {
        if (this.closed || channel.readyState !== "open") return;
        const block = await file.slice(offset, Math.min(offset + READ_BLOCK, file.size)).arrayBuffer();
        let bp = 0;
        while (bp < block.byteLength) {
          if (this.closed || channel.readyState !== "open") return;
          const buf = block.slice(bp, Math.min(bp + chunkSize, block.byteLength));
          if (channel.bufferedAmount > HIGH_WATER) await this.waitDrain(channel);
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
          bp += buf.byteLength;
          offset += buf.byteLength;
        }
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
      let connected = 0;
      let active = 0;
      let completed = 0;
      let bufferedBytes = 0;
      this.peers.forEach((p) => {
        if (p.channel && p.channel.readyState === "open") connected += 1;
        if (p.recipient.status === "extracting") {
          active += 1;
          agg += p.recipient.speed;
        }
        if (p.recipient.status === "complete") completed += 1;
        if (p.channel) bufferedBytes += p.channel.bufferedAmount;
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

/** A place to put incoming bytes for one file — either a streaming disk writer
 *  (File System Access API) or an in-memory chunk buffer that becomes a Blob. */
interface Sink {
  write(chunk: Uint8Array): Promise<void> | void;
  finish(): Promise<Blob | null>;
  abort(): void;
  hash: boolean; // whether we can hash (only the in-memory path verifies)
}

function makeBlobSink(mime: string): Sink {
  const chunks: Uint8Array[] = [];
  return {
    write(chunk) {
      chunks.push(chunk);
    },
    async finish() {
      return new Blob(chunks as BlobPart[], { type: mime });
    },
    abort() {
      chunks.length = 0;
    },
    hash: true,
  };
}

async function makeDiskSink(name: string): Promise<Sink | null> {
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<unknown> }).showSaveFilePicker;
  if (!picker) return null;
  try {
    const handle = (await picker({ suggestedName: name })) as { createWritable: () => Promise<{ write: (d: unknown) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }> };
    const writable = await handle.createWritable();
    return {
      async write(chunk) {
        await writable.write(chunk);
      },
      async finish() {
        await writable.close();
        return null; // already written to disk
      },
      abort() {
        void writable.abort?.();
      },
      hash: false,
    };
  } catch {
    return null; // user cancelled the picker
  }
}

interface ActiveDownload {
  fileId: string;
  size: number;
  received: number;
  sink: Sink;
  onEnd: (hash?: string) => void;
  reject: (e: Error) => void;
}

export class BeamReceiver {
  private sig: Signaling;
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private manifest: BeamManifest | null = null;
  private hostId: string | null = null;
  private closed = false;
  private connected = false;

  private active: ActiveDownload | null = null;
  private queue: (() => void)[] = [];

  private lastBytes = 0;
  private lastTime = Date.now();
  private emaSpeed = 0;

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
      this.channel = e.channel;
      this.channel.binaryType = "arraybuffer";
      this.channel.onopen = () => {
        this.connected = true;
        this.cb.onConnected?.();
      };
      this.channel.onmessage = (ev) => this.onData(ev.data);
      this.channel.onclose = () => {
        if (this.active) {
          this.active.reject(new Error("Connection closed mid-transfer"));
          this.active = null;
        }
      };
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
    if (this.channel && this.channel.readyState === "open") {
      try {
        this.channel.send(JSON.stringify(msg));
      } catch {
        /* noop */
      }
    }
  }

  /** Download one file. Opens a disk writer (large files) or builds a Blob.
   *  MUST be called from a user gesture so the save-picker is allowed. */
  async download(file: { id: string; name: string; size: number; mime: string; hash?: string }): Promise<void> {
    // Pick the sink up-front (inside the click gesture) before queueing.
    let sink: Sink | null = null;
    if (file.size >= STREAM_TO_DISK_MIN) sink = await makeDiskSink(file.name);
    if (!sink) sink = makeBlobSink(file.mime);
    const chosen = sink;

    let expectedHash: string | undefined;
    await new Promise<void>((resolve, reject) => {
      const start = () => {
        this.active = {
          fileId: file.id,
          size: file.size,
          received: 0,
          sink: chosen,
          onEnd: (h) => {
            expectedHash = h;
            resolve();
          },
          reject,
        };
        this.lastBytes = 0;
        this.lastTime = Date.now();
        this.emaSpeed = 0;
        this.send({ t: "extract", fileIds: [file.id] });
      };
      // Serialize: one active download at a time so chunk framing stays clean.
      if (this.active) this.queue.push(start);
      else start();
    }).finally(() => {
      const next = this.queue.shift();
      if (next) next();
    });

    // Finalize: disk sinks return null (already on disk); blob sinks return a
    // Blob we verify (if a hash was sent) and hand to the browser to save.
    const blob = await chosen.finish();
    let verified = true;
    if (blob) {
      if (expectedHash) {
        try {
          verified = (await sha256Hex(await blob.arrayBuffer())) === expectedHash;
        } catch {
          verified = false;
        }
      }
      triggerDownload(blob, file.name);
    }
    this.cb.onFileComplete?.(file.id, verified);
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
      } else if (msg.t === "file-end") {
        const a = this.active;
        if (a) {
          this.active = null;
          a.onEnd(msg.hash); // resolves the download() promise; finalize happens there
        }
      } else if (msg.t === "signal") {
        this.cb.onSignal?.(msg.bars);
      }
      // file-begin is implicit — the active download is already set up.
      return;
    }
    if (!this.active) return;
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : null;
    if (!buf) return;
    void this.active.sink.write(buf);
    this.active.received += buf.byteLength;
    this.cb.onFileProgress?.(this.active.fileId, this.active.received, this.active.size, this.instSpeed(this.active.received));
    // Report progress back to the host at most ~5×/sec, not per chunk — at high
    // speed a per-chunk reverse message would clog the channel and slow things.
    const now = Date.now();
    if (now - this.lastProgressSent > 200) {
      this.lastProgressSent = now;
      this.send({ t: "progress", id: this.active.fileId, received: this.active.received });
    }
  }
  private lastProgressSent = 0;

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
    if (this.active) this.active.sink.abort();
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
