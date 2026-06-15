"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/* Presence signal. Electric cyan when online, dark when away, cycling gradient
   when actively hosting a Beam. */

export type PulseState = "online" | "offline" | "hosting";

export function PulseDot({ state = "offline", size = 8, className }: { state?: PulseState; size?: number; className?: string }) {
  if (state === "offline") {
    return (
      <span
        className={cn("inline-block shrink-0 rounded-full bg-white/15", className)}
        style={{ width: size, height: size }}
        aria-label="offline"
      />
    );
  }
  if (state === "hosting") {
    return (
      <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} aria-label="hosting">
        <span
          className="anim-spin-slow absolute inset-0 rounded-full"
          style={{ background: "conic-gradient(from 0deg, #00ff88, #00e5c8, #00c8ff, #0099ff, #00ff88)" }}
        />
        <span className="absolute inset-[2px] rounded-full bg-[#04040a]" />
        <span className="absolute inset-[3px] rounded-full" style={{ background: "#00c8ff" }} />
      </span>
    );
  }
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} aria-label="online">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: "#00c8ff" }}
        animate={{ boxShadow: ["0 0 0 0 rgba(0,200,255,0.5)", "0 0 0 5px rgba(0,200,255,0)"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
      />
      <span className="absolute inset-0 rounded-full" style={{ background: "#00c8ff", boxShadow: "0 0 6px #00c8ff" }} />
    </span>
  );
}
