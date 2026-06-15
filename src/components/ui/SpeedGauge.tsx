"use client";

import { cn } from "@/lib/cn";
import { splitSpeed } from "@/lib/format";
import { AnimatedNumber } from "./AnimatedNumber";

/* Real-time transfer rate with smooth digit interpolation. */

export function SpeedGauge({
  bytesPerSec,
  up = true,
  className,
}: {
  bytesPerSec: number;
  up?: boolean;
  className?: string;
}) {
  const { value, unit } = splitSpeed(bytesPerSec);
  return (
    <span className={cn("mono inline-flex items-baseline gap-1 tabular-nums", className)}>
      <AnimatedNumber value={bytesPerSec} format={() => value} className="text-fg" />
      <span className="text-xs text-fg-3">
        {unit} {up ? "↑" : "↓"}
      </span>
    </span>
  );
}
