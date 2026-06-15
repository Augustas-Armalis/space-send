"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { usePrefersReducedMotion, useVibrate } from "@/hooks";

/* The signature primary CTA — gradient pill, magnetic hover, soft idle pulse,
   shimmer sweep, and the hold-to-confirm easter egg. */

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: string;
  size?: "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  pulse?: boolean;
  shimmer?: boolean;
  className?: string;
  type?: "button" | "submit";
  style?: React.CSSProperties;
}

export function MagneticButton({
  children,
  onClick,
  icon,
  size = "lg",
  disabled,
  loading,
  pulse = true,
  shimmer = true,
  className,
  type = "button",
  style,
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduced = usePrefersReducedMotion();
  const vibrate = useVibrate();
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    if (reduced || disabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    setOffset({ x: x * 0.18, y: y * 0.3 });
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onMouseMove={onMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      onClick={() => {
        vibrate(10);
        onClick?.();
      }}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      whileTap={{ scale: 0.97 }}
      style={style}
      className={cn(
        "group relative inline-flex select-none items-center justify-center overflow-hidden font-semibold text-[#02140d] transition-[filter,box-shadow] duration-300 disabled:cursor-not-allowed disabled:opacity-60",
        size === "lg" ? "h-14 gap-2.5 rounded-2xl px-8 text-base" : "h-11 gap-2 rounded-xl px-5 text-sm",
        "gradient-bg cta-glow hover:brightness-110",
        className,
      )}
    >
      {/* Idle pulse halo */}
      {pulse && !reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: "0 0 0 0 rgba(0,200,255,0.35)" }}
          animate={{ boxShadow: ["0 0 0 0 rgba(0,200,255,0.35)", "0 0 0 12px rgba(0,200,255,0)"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {/* Shimmer sweep */}
      {shimmer && !reduced && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)",
            transform: "translateX(-130%)",
            animation: "ss-shimmer 5s ease-in-out infinite",
            animationDelay: "1s",
          }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">
        {loading ? (
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin" />
        ) : (
          icon && <Icon name={icon} className="h-5 w-5" />
        )}
        {children}
      </span>
    </motion.button>
  );
}
