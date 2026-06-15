"use client";

import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/constants";

/* "Powered by Contles" — whisper-quiet, never bold, never the full gradient.
   Highest-value placement: recipient page footer. Tracks with ?ref=spacesend. */

export function ContlesMark({ className, align = "center" }: { className?: string; align?: "center" | "right" | "left" }) {
  return (
    <a
      href={BRAND.builtByUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5 text-[11px] text-fg-3 transition-colors hover:text-fg-2",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] transition-shadow group-hover:shadow-[0_0_6px_#00c8ff]" />
      <span>
        Powered by <span className="underline-offset-2 group-hover:underline">Contles</span>
      </span>
    </a>
  );
}
