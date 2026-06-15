"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/* The Space Send toggle — cyan when on, glass when off. */

export function Switch({
  checked,
  onChange,
  label,
  desc,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  desc?: string;
  className?: string;
}) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-transparent bg-[#00c8ff]/80" : "border-white/10 bg-white/[0.06]",
        className,
      )}
    >
      <motion.span
        className="absolute top-0.5 rounded-full bg-white"
        style={{ width: 18, height: 18 }}
        animate={{ left: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    </button>
  );

  if (!label) return toggle;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        {desc && <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{desc}</p>}
      </div>
      {toggle}
    </div>
  );
}
