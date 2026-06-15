"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

/* The wordmark — gradient text is reserved for the wordmark and the hero
   heading only. Everywhere else: white text, gradient glows. */

export function Wordmark({
  className,
  gradient = false,
  withMark = true,
  href = "/",
  size = "md",
}: {
  className?: string;
  gradient?: boolean;
  withMark?: boolean;
  href?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  };
  const content = (
    <span className={cn("inline-flex items-center gap-2 font-medium tracking-tight no-drag", sizes[size], className)}>
      {withMark && <MarkDot />}
      <span className={gradient ? "gradient-text font-semibold" : "text-fg"}>Space Send</span>
    </span>
  );
  if (href === null) return content;
  return (
    <Link href={href} className="titlebar-no-drag inline-flex items-center transition-opacity hover:opacity-80">
      {content}
    </Link>
  );
}

export function MarkDot({ size = 16 }: { size?: number }) {
  return (
    <span
      className="relative inline-block rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 35% 30%, #6affc0, #00ff88 22%, #00e5c8 50%, #00c8ff 74%, #0099ff 96%)",
        boxShadow: "0 0 10px -1px rgba(0,229,200,0.7), inset -2px -2px 4px rgba(0,20,40,0.6)",
      }}
      aria-hidden
    />
  );
}
