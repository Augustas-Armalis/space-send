"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useStash } from "@/store/stash";
import { usePrefersReducedMotion } from "@/hooks";

/* A small cyan dot that softly trails the cursor with spring damping. Expands
   over interactive elements. Desktop pointer only. */

export function CursorTrail() {
  const reduced = usePrefersReducedMotion();
  const enabled = useStash((s) => s.settings.customCursor);
  const [fine, setFine] = useState(false);
  const [big, setBig] = useState(false);
  const [down, setDown] = useState(false);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 380, damping: 28, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 380, damping: 28, mass: 0.6 });

  useEffect(() => {
    setFine(window.matchMedia("(pointer: fine)").matches);
  }, []);

  useEffect(() => {
    if (!fine || reduced || !enabled) return;
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
      const t = e.target as HTMLElement | null;
      setBig(!!t?.closest("button, a, [role=button], input, textarea, select, [data-magnetic]"));
    };
    const dn = () => setDown(true);
    const up = () => setDown(false);
    const leave = () => setVisible(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", dn);
    window.addEventListener("mouseup", up);
    document.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", dn);
      window.removeEventListener("mouseup", up);
      document.removeEventListener("mouseleave", leave);
    };
  }, [fine, reduced, enabled, x, y]);

  if (!fine || reduced || !enabled) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[200] mix-blend-screen"
      style={{ x: sx, y: sy }}
      animate={{ opacity: visible ? 1 : 0 }}
    >
      <motion.div
        className="rounded-full"
        animate={{
          width: big ? 26 : 8,
          height: big ? 26 : 8,
          x: big ? -13 : -4,
          y: big ? -13 : -4,
          scale: down ? 0.7 : 1,
          opacity: big ? 0.4 : 0.85,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 24 }}
        style={{ background: "#00c8ff", boxShadow: "0 0 12px rgba(0,200,255,0.6)" }}
      />
    </motion.div>
  );
}
