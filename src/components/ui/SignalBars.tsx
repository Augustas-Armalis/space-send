"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/* Connection quality on a Beam — 1 to 5 bars, derived from RTT/loss/bandwidth. */

export function SignalBars({ level, className, size = 14 }: { level: number; className?: string; size?: number }) {
  const lvl = Math.max(0, Math.min(5, Math.round(level)));
  const weak = lvl <= 2;
  return (
    <span className={cn("inline-flex items-end gap-[2px]", className)} style={{ height: size }} aria-label={`Signal ${lvl}/5`}>
      {[1, 2, 3, 4, 5].map((b) => {
        const on = b <= lvl;
        return (
          <motion.span
            key={b}
            className="w-[2.5px] rounded-full"
            style={{
              height: `${(b / 5) * 100}%`,
              background: on ? (weak ? "#ffb020" : "#0099ff") : "rgba(255,255,255,0.14)",
              boxShadow: on && !weak ? "0 0 4px rgba(0,153,255,0.5)" : "none",
            }}
            initial={false}
            animate={{ opacity: on ? 1 : 0.5 }}
            transition={{ duration: 0.3 }}
          />
        );
      })}
    </span>
  );
}
