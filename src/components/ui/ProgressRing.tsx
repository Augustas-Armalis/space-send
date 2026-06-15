"use client";

import { motion } from "framer-motion";
import { useId } from "react";

/* SVG ring with continuous gradient-arc fill — never steppy. */

export function ProgressRing({
  progress,
  size = 44,
  stroke = 3,
  children,
  trackColor = "rgba(255,255,255,0.08)",
  showGlow = true,
}: {
  progress: number; // 0–1
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  trackColor?: string;
  showGlow?: boolean;
}) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FF88" />
            <stop offset="38%" stopColor="#00E5C8" />
            <stop offset="68%" stopColor="#00C8FF" />
            <stop offset="100%" stopColor="#0099FF" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
          style={showGlow ? { filter: "drop-shadow(0 0 4px rgba(0,200,255,0.5))" } : undefined}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}
