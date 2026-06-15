"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/hooks";
import { Icon } from "./Icon";

/* Modal — a centered glass dialog on desktop, a draggable bottom sheet on
   mobile. Backdrop blurs the app heavily. */

export function Modal({
  open,
  onClose,
  children,
  title,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const desktop = useIsDesktop();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/55"
            style={{ backdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={desktop ? { opacity: 0, scale: 0.95, y: 8 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            drag={desktop ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
            className={cn(
              "glass-strong relative z-10 w-full overflow-hidden rounded-t-[28px] sm:rounded-[24px]",
              widths[size],
              "max-h-[90vh]",
              className,
            )}
          >
            {!desktop && <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/15" />}
            {title && (
              <div className="flex items-center justify-between px-6 pb-3 pt-5">
                <h2 className="font-[var(--font-heading)] text-lg font-medium text-fg">{title}</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 text-fg-3 transition-colors hover:text-fg">
                  <Icon name="X" className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className={cn("overflow-y-auto", title ? "px-6 pb-6" : "p-6", "max-h-[80vh]")}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
