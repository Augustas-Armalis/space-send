"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { routeTransition } from "@/lib/motion";

/* Consistent page chrome for every in-app screen. Keeps the whole app coherent:
   same max-width, same header rhythm, same route crossfade. */

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={routeTransition}
      initial="hidden"
      animate="show"
      className={cn("mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8", className)}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
  icon,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h1 className="text-2xl font-light tracking-tight text-fg">{title}</h1>
          {sub && <p className="mt-1 text-sm text-fg-3">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
