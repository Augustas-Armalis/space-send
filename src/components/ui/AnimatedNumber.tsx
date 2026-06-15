"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/* Tabular number choreography — each digit slot rolls independently, like a
   smooth split-flap display. Numbers feel alive, never jittery. */

function Digit({ d }: { d: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62ch] overflow-hidden align-baseline tabular-nums">
      <motion.span
        className="absolute left-0 top-0 flex flex-col items-center"
        animate={{ y: `-${d}em` }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="flex h-[1em] items-center leading-none">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const str = format ? format(value) : Math.round(value).toLocaleString();
  return (
    <span className={cn("mono inline-flex items-baseline leading-none", className)}>
      {str.split("").map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <Digit key={i} d={parseInt(ch, 10)} />
        ) : (
          <span key={i} className="inline-block">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
