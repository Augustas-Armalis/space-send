"use client";

import { motion } from "framer-motion";
import { Orb } from "@/components/brand/Orb";
import { fadeUp } from "@/lib/motion";

/* Every empty state: a centered dim, breathing Orb, 1–2 lines of space-voice
   copy, and one CTA. Nothing more. The ship powered down, waiting. */

export function EmptyState({
  title,
  sub,
  action,
  orbSize = 88,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  orbSize?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center gap-5 px-6 py-20 text-center"
    >
      <div className="anim-float">
        <Orb size={orbSize} state="dim" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-balance text-lg font-medium text-fg">{title}</h3>
        {sub && <p className="mx-auto max-w-sm text-balance text-sm leading-relaxed text-fg-3">{sub}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </motion.div>
  );
}
