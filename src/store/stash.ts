"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CrewMember } from "@/transfer/types";
import type { ExpiryId, TransferMode } from "@/lib/constants";
import type { StorageBackend } from "@/transfer/types";
import { generateDeviceKeys, type DeviceKeys } from "@/lib/crypto";

export interface ByosCredential {
  id: string;
  label: string;
  provider: "r2" | "s3" | "b2" | "wasabi" | "spaces" | "minio";
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  // secret intentionally not stored in plaintext in this demo
  secretMasked: string;
  isDefault?: boolean;
}

export interface Settings {
  defaultMode: TransferMode;
  defaultExpiry: ExpiryId;
  defaultBackend: StorageBackend;
  appearOffline: boolean;
  anonymousExtract: boolean;
  hideSignal: boolean;
  sounds: boolean;
  motion: "auto" | "on" | "off";
  monthlyCapEur: number;
  smartCleanup: boolean;
  trashRetentionDays: number;
  keepAwake: boolean;
  backgroundHosting: boolean;
  customCursor: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  defaultMode: "drop",
  defaultExpiry: "7d",
  defaultBackend: "managed",
  appearOffline: false,
  anonymousExtract: false,
  hideSignal: false,
  sounds: false,
  motion: "auto",
  monthlyCapEur: 5,
  smartCleanup: true,
  trashRetentionDays: 7,
  keepAwake: true,
  backgroundHosting: false,
  customCursor: true,
};

interface StashState {
  hydrated: boolean;
  onboarded: boolean;
  tag: string | null;
  name: string;
  avatar: string | null;
  keys: DeviceKeys | null;
  crew: CrewMember[];
  byos: ByosCredential[];
  settings: Settings;

  setHydrated: () => void;
  completeOnboarding: (p: { tag: string; name: string; avatar: string | null }) => Promise<void>;
  updateProfile: (p: Partial<{ tag: string; name: string; avatar: string | null }>) => void;
  updateSettings: (p: Partial<Settings>) => void;
  addCrew: (m: Omit<CrewMember, "addedAt" | "interactions"> & Partial<CrewMember>) => void;
  removeCrew: (tag: string) => void;
  bumpInteraction: (tag: string) => void;
  addByos: (c: ByosCredential) => void;
  removeByos: (id: string) => void;
  exportStash: () => string;
  importStash: (json: string) => boolean;
  wipe: () => void;
}

export const useStash = create<StashState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboarded: false,
      tag: null,
      name: "",
      avatar: null,
      keys: null,
      crew: [],
      byos: [],
      settings: DEFAULT_SETTINGS,

      setHydrated: () => set({ hydrated: true }),

      completeOnboarding: async ({ tag, name, avatar }) => {
        let keys = get().keys;
        if (!keys) {
          try {
            keys = await generateDeviceKeys();
          } catch {
            keys = null;
          }
        }
        set({ onboarded: true, tag, name, avatar, keys });
      },

      updateProfile: (p) => set((s) => ({ ...s, ...p })),
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      addCrew: (m) =>
        set((s) => {
          if (s.crew.some((c) => c.tag === m.tag)) return s;
          return {
            crew: [...s.crew, { addedAt: Date.now(), interactions: 0, ...m }],
          };
        }),
      removeCrew: (tag) => set((s) => ({ crew: s.crew.filter((c) => c.tag !== tag) })),
      bumpInteraction: (tag) =>
        set((s) => ({
          crew: s.crew.map((c) =>
            c.tag === tag ? { ...c, interactions: c.interactions + 1, lastSignal: Date.now() } : c,
          ),
        })),

      addByos: (c) =>
        set((s) => ({ byos: [...s.byos.map((b) => ({ ...b, isDefault: c.isDefault ? false : b.isDefault })), c] })),
      removeByos: (id) => set((s) => ({ byos: s.byos.filter((b) => b.id !== id) })),

      exportStash: () => {
        const s = get();
        return JSON.stringify(
          { v: 1, tag: s.tag, name: s.name, avatar: s.avatar, keys: s.keys, crew: s.crew, settings: s.settings },
          null,
          2,
        );
      },
      importStash: (json) => {
        try {
          const d = JSON.parse(json);
          if (!d || typeof d !== "object") return false;
          set({
            onboarded: true,
            tag: d.tag ?? null,
            name: d.name ?? "",
            avatar: d.avatar ?? null,
            keys: d.keys ?? null,
            crew: Array.isArray(d.crew) ? d.crew : [],
            settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
          });
          return true;
        } catch {
          return false;
        }
      },

      wipe: () =>
        set({
          onboarded: false,
          tag: null,
          name: "",
          avatar: null,
          keys: null,
          crew: [],
          byos: [],
          settings: DEFAULT_SETTINGS,
        }),
    }),
    {
      name: "spacesend-stash",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        tag: s.tag,
        name: s.name,
        avatar: s.avatar,
        keys: s.keys,
        crew: s.crew,
        byos: s.byos,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
