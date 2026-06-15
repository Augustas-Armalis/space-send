"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useCopy } from "@/hooks";
import { COPY } from "@/lib/constants";

/* Copy → morphs to "Link copied" for 1.5s with a haptic-like scale punch. */

export function CopyButton({
  value,
  label = COPY.copyLink,
  copiedLabel = COPY.linkCopied,
  className,
  variant = "primary",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  variant?: "primary" | "glass";
}) {
  const [copied, copy] = useCopy();
  return (
    <motion.button
      onClick={() => copy(value)}
      whileTap={{ scale: 0.95 }}
      animate={copied ? { scale: [1, 1.05, 1] } : {}}
      className={cn(
        "relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-medium transition-colors",
        variant === "primary" ? "text-[#02140d] gradient-bg" : "glass text-fg hover:bg-white/[0.07]",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="inline-flex items-center gap-2"
          >
            <Icon name="Check" className="h-4 w-4" />
            {copiedLabel}
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="inline-flex items-center gap-2"
          >
            <Icon name="Copy" className="h-4 w-4" />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
