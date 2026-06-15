"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

/* The complete-flash — when a transfer finishes, the screen briefly vignettes
   inward with the gradient arc, plus a confetti-less particle burst. ~400ms.
   Combined with the SVG checkmark draw. Unforgettable, never gaudy. */

export function CompleteFlash({ playKey }: { playKey: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (playKey <= 0) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1100);
    return () => clearTimeout(t);
  }, [playKey]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, times: [0, 0.4, 1] }}
        >
          {/* Edge vignette: green at the top, electric blue at the sides */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% -10%, rgba(0,255,136,0.30), transparent 45%), radial-gradient(90% 120% at -10% 50%, rgba(0,153,255,0.22), transparent 45%), radial-gradient(90% 120% at 110% 50%, rgba(0,153,255,0.22), transparent 45%)",
            }}
          />
          <ParticleBurst />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ParticleBurst({ count = 14 }: { count?: number }) {
  const stops = ["#00FF88", "#00E5C8", "#00C8FF", "#0099FF"];
  return (
    <div className="absolute left-1/2 top-1/2">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 80 + (i % 4) * 26;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: stops[i % stops.length], boxShadow: `0 0 8px ${stops[i % stops.length]}` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

/* The gradient checkmark that draws itself — stroke animates green→blue. */
export function DrawCheck({ size = 24, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="checkgrad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#00FF88" />
          <stop offset="100%" stopColor="#0099FF" />
        </linearGradient>
      </defs>
      <motion.path
        d="M4 12.5L9.5 18L20 6.5"
        stroke="url(#checkgrad)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay, ease: "easeOut" }}
      />
    </svg>
  );
}
