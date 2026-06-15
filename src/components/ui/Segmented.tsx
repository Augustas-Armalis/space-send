"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/* Segmented control — the Drop ↔ Beam toggle. A gradient underline slides
   between options with a shared layout transition. */

export interface SegOption<T extends string> {
  id: T;
  label: string;
  icon?: string;
  sub?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId = "seg",
  className,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  layoutId?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-white/[0.04] p-1", className)}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors",
              active ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-white/[0.07]"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              >
                <span
                  className="absolute inset-x-3 bottom-0 h-[2px] rounded-full"
                  style={{ background: "linear-gradient(90deg,#00ff88,#00c8ff,#0099ff)" }}
                />
              </motion.span>
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {opt.icon && <Icon name={opt.icon} className="h-4 w-4" />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
