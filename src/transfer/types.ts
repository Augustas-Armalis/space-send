import type { ExpiryId } from "@/lib/constants";

/* ============================================================================
   The persisted data model. Metadata lives in localStorage (Zustand persist);
   actual file bytes live in IndexedDB (Drops) or never leave the device (Beams).
   ========================================================================== */

export type StorageBackend = "managed" | "local" | "byos-r2" | "byos-s3" | "byos-b2" | "byos-wasabi";

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  mime: string;
  hash?: string;
  /** Runtime-only object URL for previews — never persisted. */
  preview?: string;
}

export interface LinkOptions {
  password?: { salt: string; hash: string } | null;
  downloadCap?: number | null;
  burnAfter?: boolean;
  expiry?: ExpiryId;
  notifyOnDownload?: boolean;
  slug?: string | null;
  encrypted?: boolean;
}

export interface DropRecord {
  id: string;
  kind: "drop";
  files: FileMeta[];
  message?: string;
  createdAt: number;
  expiresAt: number | null;
  downloads: number;
  totalSize: number;
  backend: StorageBackend;
  projectId?: string | null;
  options: LinkOptions;
  /** Snapshot of the sender so the recipient page renders identity. */
  sender?: { tag?: string | null; name?: string; avatar?: string | null };
  /** Whether the bytes are retrievable in this browser (local IDB demo). */
  localAvailable: boolean;
  trashedAt?: number | null;
}

export type BeamStatus = "staged" | "live" | "extracting" | "complete" | "ended" | "severed";

export interface BeamRecipient {
  id: string;
  tag?: string;
  name?: string;
  region?: string;
  signal: number; // 1–5 bars
  progress: number; // 0–1
  speed: number; // bytes/sec
  status: "reading" | "extracting" | "complete" | "disconnected" | "paused";
  startedAt?: number;
  completedAt?: number;
}

export interface BeamRecord {
  id: string;
  kind: "beam";
  files: FileMeta[];
  message?: string;
  createdAt: number;
  durationId: string;
  expiresAt: number | null;
  status: BeamStatus;
  recipients: BeamRecipient[];
  projectId?: string | null;
}

export interface TrailEntry {
  id: string;
  type: "drop" | "beam" | "ask" | "pool";
  direction: "out" | "in";
  label: string;
  size: number;
  count: number;
  durationMs?: number;
  ts: number;
  status: "complete" | "active" | "ended" | "failed";
  avgSpeed?: number;
  refId?: string;
  hash?: string;
}

export interface CrewMember {
  tag: string;
  name: string;
  publicKey?: string;
  addedAt: number;
  lastSignal?: number;
  interactions: number;
  /** Runtime presence — not persisted. */
  online?: boolean;
  hosting?: boolean;
}

export interface PoolFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  uploader: string;
  ts: number;
  downloads: number;
}

export interface Pool {
  id: string;
  name: string;
  type: "cloud" | "live";
  accent?: string;
  cover?: string;
  members: string[];
  host: string;
  coHosts?: string[];
  maxBytes: number;
  retention: "forever" | "30d" | "7d";
  permissions: "open" | "host-remove" | "read-only";
  files: PoolFile[];
  createdAt: number;
  online?: boolean;
}

export interface Project {
  id: string;
  name: string;
  accent: string;
  logo?: string;
  hero?: string;
  completionMessage?: string;
  defaultExpiry: ExpiryId;
  defaultBackend: StorageBackend;
  createdAt: number;
  bytesSent: number;
  downloads: number;
}

export interface AskRequest {
  id: string;
  title: string;
  message?: string;
  expiresAt: number | null;
  createdAt: number;
  perSubmitterCapBytes: number;
  received: FileMeta[];
  projectId?: string | null;
}

/* ---- WebRTC Beam wire protocol ---- */

export interface BeamManifest {
  files: { id: string; name: string; size: number; mime: string; hash?: string }[];
  message?: string;
  senderTag?: string;
  senderName?: string;
  totalSize: number;
}

export type DataMsg =
  | { t: "ready" }
  | { t: "manifest"; manifest: BeamManifest }
  | { t: "extract"; fileIds: string[] }
  | { t: "file-begin"; id: string; name: string; size: number; mime: string }
  | { t: "file-end"; id: string; hash?: string }
  | { t: "progress"; id: string; received: number }
  | { t: "pause" }
  | { t: "resume" }
  | { t: "complete" }
  | { t: "signal"; bars: number };

/* ---- Signaling messages (broker only relays these; no bytes) ---- */

export type SignalMsg =
  | { kind: "hello"; beam: string; from: string }
  | { kind: "join"; beam: string; from: string }
  | { kind: "offer"; beam: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; beam: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; beam: string; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "bye"; beam: string; from: string };
