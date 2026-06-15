"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/hooks";

/* The frosted-glass container with optional magnetic parallax tilt — Apple
   product-card energy, max 4° in any direction, spring-damped. */

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tilt?: boolean;
  glow?: boolean;
  strong?: boolean;
  as?: "div" | "section" | "article";
}

export function GlassPanel({
  tilt = false,
  glow = false,
  strong = false,
  className,
  children,
  ...props
}: GlassPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), { stiffness: 250, damping: 25 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-4, 4]), { stiffness: 250, damping: 25 });
  const [active, setActive] = useState(false);

  const handleMove = (e: React.MouseEvent) => {
    if (!tilt || reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => {
        setActive(false);
        mx.set(0);
        my.set(0);
      }}
      style={tilt && !reduced ? { rotateX: rx, rotateY: ry, transformPerspective: 1000 } : undefined}
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-[var(--radius-glass)]",
        glow && "shadow-[0_24px_80px_-32px_rgba(0,200,255,0.25)]",
        className,
      )}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      {glow && active && !reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0"
          animate={{ opacity: 0.5 }}
          style={{
            background: "radial-gradient(400px circle at center, rgba(0,200,255,0.06), transparent 60%)",
          }}
        />
      )}
      {children}
    </motion.div>
  );
}
