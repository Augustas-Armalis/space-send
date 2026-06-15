"use client";

import { create } from "zustand";
import type { BeamHost, BeamHostStats, HostFile } from "@/transfer/beam";
import type { BeamRecipient, FileMeta } from "@/transfer/types";
import { shortId } from "@/lib/ids";
import { makePreview } from "@/lib/files";
import { allowSleep } from "@/lib/desktop";

/* ============================================================================
   The live Beam "tower" session. Lives in a module-level store (not tied to any
   page component) so the host's RTCPeerConnections and in-memory File handles
   survive a client-side navigation from Send → the dedicated /tower page.
   Only one tower is active at a time.
   ========================================================================== */

const EMPTY_STATS: BeamHostStats = { connected: 0, active: 0, completed: 0, aggSpeed: 0, bufferedBytes: 0, load: 0 };

interface TowerState {
  active: boolean;
  id: string;
  shareUrl: string;
  host: BeamHost | null;
  files: { meta: FileMeta; preview: string | null }[];
  recipients: BeamRecipient[];
  stats: BeamHostStats;
  aggSpeed: number;
  startedAt: number;
  turbo: boolean;

  launch: (p: { id: string; shareUrl: string; host: BeamHost; files: FileMeta[]; startedAt: number }) => void;
  addRecipient: (r: BeamRecipient) => void;
  patchRecipient: (id: string, patch: Partial<BeamRecipient>) => void;
  removeRecipient: (id: string) => void;
  setStats: (s: BeamHostStats) => void;
  setAggSpeed: (v: number) => void;
  addFiles: (incoming: FileList | File[]) => void;
  setThrottle: (bytesPerSec: number) => void;
  setTurbo: (on: boolean) => void;
  kill: () => void;
}

export const useTower = create<TowerState>((set, get) => ({
  active: false,
  id: "",
  shareUrl: "",
  host: null,
  files: [],
  recipients: [],
  stats: EMPTY_STATS,
  aggSpeed: 0,
  startedAt: 0,
  turbo: false,

  launch: ({ id, shareUrl, host, files, startedAt }) =>
    set({
      active: true,
      id,
      shareUrl,
      host,
      files: files.map((meta) => ({ meta, preview: null })),
      recipients: [],
      stats: EMPTY_STATS,
      aggSpeed: 0,
      startedAt,
      turbo: false,
    }),

  addRecipient: (r) =>
    set((s) => ({ recipients: [...s.recipients.filter((x) => x.id !== r.id), r] })),
  patchRecipient: (id, patch) =>
    set((s) => ({ recipients: s.recipients.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  removeRecipient: (id) => set((s) => ({ recipients: s.recipients.filter((x) => x.id !== id) })),
  setStats: (stats) => set({ stats }),
  setAggSpeed: (aggSpeed) => set({ aggSpeed }),

  addFiles: (incoming) => {
    const arr = Array.from(incoming);
    const hostFiles: HostFile[] = arr.map((file) => ({
      meta: { id: shortId(), name: file.name, size: file.size, mime: file.type || "application/octet-stream" },
      file,
    }));
    get().host?.addFiles(hostFiles);
    set((s) => ({ files: [...s.files, ...hostFiles.map((h) => ({ meta: h.meta, preview: makePreview(h.file) }))] }));
  },

  setThrottle: (bytesPerSec) => get().host?.setThrottle(bytesPerSec),
  setTurbo: (on) => {
    get().host?.setTurbo(on);
    set({ turbo: on });
  },

  kill: () => {
    try {
      get().host?.close();
    } catch {
      /* noop */
    }
    void allowSleep();
    set({ active: false, id: "", shareUrl: "", host: null, files: [], recipients: [], stats: EMPTY_STATS, aggSpeed: 0, startedAt: 0 });
  },
}));
