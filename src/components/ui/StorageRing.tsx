"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { formatBytes } from "@/lib/format";

/* The Vault storage meter — animated SVG arc. Gradient green→blue normally,
   shifts to amber > 80%, red > 95%. */

export function StorageRing({
  used,
  total,
  size = 140,
  stroke = 10,
  accent,
}: {
  used: number;
  total: number;
  size?: number;
  stroke?: number;
  accent?: string;
}) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, used / total) : 0;
  const pct = Math.round(ratio * 100);

  const over = ratio > 0.95;
  const warn = ratio > 0.8;
  const strokeRef = accent ? undefined : `url(#storage-${id})`;
  const flatColor = over ? "#ff4d6a" : warn ? "#ffb020" : accent;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`storage-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FF88" />
            <stop offset="40%" stopColor="#00E5C8" />
            <stop offset="70%" stopColor="#00C8FF" />
            <stop offset="100%" stopColor="#0099FF" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={warn || over || accent ? flatColor : strokeRef}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ type: "spring", stiffness: 90, damping: 22 }}
          style={{ filter: "drop-shadow(0 0 6px rgba(0,200,255,0.4))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="mono text-2xl font-semibold tabular-nums text-fg">{pct}%</span>
        <span className="mono text-[11px] text-fg-3">
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
    </div>
  );
}
