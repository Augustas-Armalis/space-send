"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GRADIENT_CSS } from "@/lib/constants";

/* The Aurora — a gradient ribbon along the viewport's top edge whenever a
   transmission is live. Invisible at rest, blazing during a fast Beam.
   Speed + height map to throughput. */

export function AuroraRibbon({
  active,
  intensity = 0.5,
  tall = false,
}: {
  active: boolean;
  intensity?: number; // 0–1
  tall?: boolean;
}) {
  const i = Math.max(0, Math.min(1, intensity));
  const height = tall ? 120 + i * 80 : 3 + i * 4;
  const speed = 9 - i * 6; // faster flow at higher throughput
  const opacity = tall ? 0.18 + i * 0.22 : 0.4 + i * 0.5;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          style={{ height }}
        >
          <div
            className="h-full w-full"
            style={{
              background: GRADIENT_CSS,
              backgroundSize: "200% 100%",
              animation: `ss-aurora-flow ${speed}s linear infinite`,
              filter: tall ? "blur(28px)" : "blur(1px)",
              maskImage: tall ? "linear-gradient(to bottom, black, transparent)" : undefined,
              WebkitMaskImage: tall ? "linear-gradient(to bottom, black, transparent)" : undefined,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
