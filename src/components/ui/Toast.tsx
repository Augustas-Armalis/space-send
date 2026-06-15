"use client";

import { create } from "zustand";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./Icon";
import { shortId } from "@/lib/ids";

export type ToastStatus = "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  status: ToastStatus;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (t: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => void;
  remove: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) => {
    const id = shortId();
    const item: ToastItem = { id, duration: 4200, ...t };
    set((s) => ({ toasts: [...s.toasts, item] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), item.duration);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Mission-control toast API. */
export const toast = {
  add: (t: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => useToastStore.getState().add(t),
  success: (title: string, description?: string) => useToastStore.getState().add({ title, description, status: "success" }),
  error: (title: string, description?: string) => useToastStore.getState().add({ title, description, status: "error" }),
  warning: (title: string, description?: string) => useToastStore.getState().add({ title, description, status: "warning" }),
  info: (title: string, description?: string) => useToastStore.getState().add({ title, description, status: "info" }),
};

const META: Record<ToastStatus, { icon: string; color: string }> = {
  success: { icon: "CheckCheck", color: "#00e5c8" },
  warning: { icon: "AlertTriangle", color: "#ffb020" },
  error: { icon: "AlertTriangle", color: "#ff4d6a" },
  info: { icon: "Info", color: "#00c8ff" },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => {
          const m = META[t.status];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="glass pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5 pr-3"
            >
              <span
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
                style={{ background: `${m.color}1f`, color: m.color }}
              >
                <Icon name={m.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] leading-snug text-fg-3">{t.description}</p>}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 rounded-md p-1 text-fg-3 transition-colors hover:text-fg"
                aria-label="Dismiss"
              >
                <Icon name="X" className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
