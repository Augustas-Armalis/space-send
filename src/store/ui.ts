"use client";

import { create } from "zustand";

/* Global ambient UI state — drives the Aurora ribbon and the complete-flash
   from anywhere in the app without prop drilling. */

interface UIState {
  auroraActive: boolean;
  auroraIntensity: number; // 0–1
  completeKey: number;
  commandOpen: boolean;
  setAurora: (active: boolean, intensity?: number) => void;
  fireComplete: () => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  auroraActive: false,
  auroraIntensity: 0.4,
  completeKey: 0,
  commandOpen: false,
  setAurora: (active, intensity) =>
    set((s) => ({ auroraActive: active, auroraIntensity: intensity ?? s.auroraIntensity })),
  fireComplete: () => set((s) => ({ completeKey: s.completeKey + 1 })),
  setCommandOpen: (v) => set({ commandOpen: v }),
}));
