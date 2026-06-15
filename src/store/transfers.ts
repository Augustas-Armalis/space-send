"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AskRequest,
  BeamRecord,
  DropRecord,
  Pool,
  Project,
  TrailEntry,
} from "@/transfer/types";
import { MANAGED_QUOTA_BYTES } from "@/lib/constants";

interface TransfersState {
  hydrated: boolean;
  drops: DropRecord[];
  beams: BeamRecord[];
  trail: TrailEntry[];
  pools: Pool[];
  projects: Project[];
  asks: AskRequest[];

  setHydrated: () => void;

  addDrop: (d: DropRecord) => void;
  removeDrop: (id: string) => void;
  trashDrop: (id: string) => void;
  restoreDrop: (id: string) => void;
  extendDrop: (id: string, ms: number | null) => void;
  registerDownload: (id: string) => void;

  addBeam: (b: BeamRecord) => void;
  updateBeam: (id: string, patch: Partial<BeamRecord>) => void;
  endBeam: (id: string) => void;

  addTrail: (e: TrailEntry) => void;
  clearTrail: () => void;

  addPool: (p: Pool) => void;
  updatePool: (id: string, patch: Partial<Pool>) => void;
  removePool: (id: string) => void;

  addProject: (p: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;

  addAsk: (a: AskRequest) => void;
  removeAsk: (id: string) => void;

  usedBytes: () => number;
  trashBytes: () => number;
}

export const useTransfers = create<TransfersState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      drops: [],
      beams: [],
      trail: [],
      pools: [],
      projects: [],
      asks: [],

      setHydrated: () => set({ hydrated: true }),

      addDrop: (d) => set((s) => ({ drops: [d, ...s.drops] })),
      removeDrop: (id) => set((s) => ({ drops: s.drops.filter((d) => d.id !== id) })),
      trashDrop: (id) =>
        set((s) => ({ drops: s.drops.map((d) => (d.id === id ? { ...d, trashedAt: Date.now() } : d)) })),
      restoreDrop: (id) =>
        set((s) => ({ drops: s.drops.map((d) => (d.id === id ? { ...d, trashedAt: null } : d)) })),
      extendDrop: (id, ms) =>
        set((s) => ({
          drops: s.drops.map((d) =>
            d.id === id ? { ...d, expiresAt: ms === null ? null : Date.now() + ms } : d,
          ),
        })),
      registerDownload: (id) =>
        set((s) => ({ drops: s.drops.map((d) => (d.id === id ? { ...d, downloads: d.downloads + 1 } : d)) })),

      addBeam: (b) => set((s) => ({ beams: [b, ...s.beams] })),
      updateBeam: (id, patch) =>
        set((s) => ({ beams: s.beams.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      endBeam: (id) =>
        set((s) => ({ beams: s.beams.map((b) => (b.id === id ? { ...b, status: "ended" } : b)) })),

      addTrail: (e) => set((s) => ({ trail: [e, ...s.trail].slice(0, 500) })),
      clearTrail: () => set({ trail: [] }),

      addPool: (p) => set((s) => ({ pools: [p, ...s.pools] })),
      updatePool: (id, patch) => set((s) => ({ pools: s.pools.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePool: (id) => set((s) => ({ pools: s.pools.filter((p) => p.id !== id) })),

      addProject: (p) => set((s) => ({ projects: [p, ...s.projects] })),
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      addAsk: (a) => set((s) => ({ asks: [a, ...s.asks] })),
      removeAsk: (id) => set((s) => ({ asks: s.asks.filter((a) => a.id !== id) })),

      usedBytes: () =>
        get()
          .drops.filter((d) => d.backend === "managed" && !d.trashedAt)
          .reduce((acc, d) => acc + d.totalSize, 0),
      trashBytes: () =>
        get()
          .drops.filter((d) => d.trashedAt)
          .reduce((acc, d) => acc + d.totalSize * 0.5, 0),
    }),
    {
      name: "spacesend-transfers",
      // localStorage is capped at ~5–10 MB per origin. After enough test runs
      // the store overflows and every subsequent setState throws "quota
      // exceeded" — which the user saw mid-Drop. This safeStorage swallows the
      // error after auto-trimming to recent items, so an over-full store
      // never blocks a working app. The cloud Drop is already in R2; this is
      // only the local catalog.
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try { return localStorage.getItem(key); } catch { return null; }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            // Most likely DOMException QuotaExceededError. Try to shrink the
            // payload by dropping older items and write again. If still
            // failing, give up silently — the in-memory state stays correct
            // for this session.
            try {
              const parsed = JSON.parse(value);
              if (parsed?.state) {
                const s = parsed.state as Partial<TransfersState>;
                parsed.state = {
                  ...s,
                  drops: (s.drops ?? []).slice(0, 50),
                  trail: (s.trail ?? []).slice(0, 100),
                  beams: (s.beams ?? []).slice(0, 25),
                  asks: (s.asks ?? []).slice(0, 25),
                };
                localStorage.setItem(key, JSON.stringify(parsed));
                return;
              }
            } catch {
              /* fall through */
            }
            console.warn("[Space Send] localStorage full — skipping persist:", e);
          }
        },
        removeItem: (key) => {
          try { localStorage.removeItem(key); } catch { /* noop */ }
        },
      })),
      partialize: (s) => ({
        // Hard cap how much we keep in localStorage so we never refill the
        // bucket. R2 is the source of truth for Drops; this is just a recent
        // history cache for the sender.
        drops: s.drops.slice(0, 50),
        beams: s.beams.slice(0, 25).map((b) => ({ ...b, recipients: [] })),
        trail: s.trail.slice(0, 100),
        pools: s.pools,
        projects: s.projects,
        asks: s.asks.slice(0, 25),
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export const QUOTA = MANAGED_QUOTA_BYTES;
