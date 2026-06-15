"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/* The Orb — Space Send's mascot. A contained energy core: phosphor green at the
   heart, haloing through cyan-teal, bleeding to electric blue at the rim.
   Never literal, always abstract. */

export type OrbState = "idle" | "waiting" | "active" | "complete" | "dim";

interface OrbProps {
  size?: number;
  state?: OrbState;
  className?: string;
  /** 0–1 throughput, drives glow intensity on active state. */
  intensity?: number;
}

export function Orb({ size = 120, state = "idle", className, intensity = 0.5 }: OrbProps) {
  const dim = state === "dim";
  const pulse = state === "waiting" || state === "active";
  const glowScale = 1 + (state === "active" ? intensity * 0.6 : 0);

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Ambient halo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.7,
          height: size * 1.7,
          background:
            "radial-gradient(circle, rgba(0,229,200,0.22), rgba(0,200,255,0.10) 45%, transparent 70%)",
          filter: "blur(8px)",
        }}
        animate={
          pulse
            ? { scale: [glowScale, glowScale * 1.12, glowScale], opacity: [0.7, 1, 0.7] }
            : { scale: glowScale, opacity: dim ? 0.25 : 0.7 }
        }
        transition={{ duration: 3.2, repeat: pulse ? Infinity : 0, ease: "easeInOut" }}
      />

      {/* The sphere */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 36% 30%, #6affc0 0%, #00ff88 14%, #00e5c8 38%, #00c8ff 62%, #0099ff 82%, #043a5c 100%)",
          boxShadow:
            "inset 0 0 28px rgba(0,255,136,0.45), inset -8px -10px 36px rgba(0,30,60,0.65), 0 0 60px -8px rgba(0,229,200,0.5)",
          opacity: dim ? 0.35 : 1,
          filter: dim ? "saturate(0.7)" : "none",
        }}
        animate={pulse ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 3.2, repeat: pulse ? Infinity : 0, ease: "easeInOut" }}
      >
        {/* Specular highlight */}
        <div
          className="absolute rounded-full"
          style={{
            top: "14%",
            left: "20%",
            width: "34%",
            height: "26%",
            background: "radial-gradient(circle, rgba(255,255,255,0.85), transparent 70%)",
            filter: "blur(2px)",
          }}
        />
        {/* Inner rotating energy band */}
        <div
          className="anim-spin-slow absolute inset-[14%] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.18), transparent 40%, rgba(0,255,136,0.2), transparent 70%)",
            mixBlendMode: "screen",
            opacity: dim ? 0.2 : 0.6,
          }}
        />
        {/* Terminator shading for sphere volume */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 70% 78%, rgba(0,10,30,0.5), transparent 55%)",
          }}
        />
      </motion.div>

      {/* Completion ring flash */}
      {state === "complete" && (
        <motion.div
          className="absolute rounded-full border"
          style={{ borderColor: "rgba(0,200,255,0.6)" }}
          initial={{ width: size, height: size, opacity: 0.8 }}
          animate={{ width: size * 2.2, height: size * 2.2, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
    </div>
  );
}
