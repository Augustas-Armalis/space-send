"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { ProgressRing } from "./ProgressRing";
import { DrawCheck } from "./CompleteFlash";
import { fileIcon, extOf } from "@/lib/files";
import { formatBytes, formatSpeed } from "@/lib/format";
import { landSpring } from "@/lib/motion";

export type FileCardState = "idle" | "staged" | "uploading" | "queued" | "extracting" | "complete" | "failed";

const STATE_LABEL: Record<FileCardState, string> = {
  idle: "",
  staged: "Staged",
  uploading: "Dropping",
  queued: "Queued",
  extracting: "Extracting",
  complete: "Complete",
  failed: "Failed",
};

export function FileCard({
  name,
  size,
  mime,
  preview,
  progress = 0,
  state = "idle",
  speed,
  verified,
  onRemove,
  onClick,
  className,
}: {
  name: string;
  size: number;
  mime: string;
  preview?: string | null;
  progress?: number;
  state?: FileCardState;
  speed?: number;
  verified?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}) {
  const ext = extOf(name);
  const showRing = state === "uploading" || state === "extracting";
  const dim = state === "queued";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: dim ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={landSpring}
      onClick={onClick}
      className={cn(
        "group glass flex items-center gap-3 rounded-2xl p-2.5 pr-3 transition-colors",
        onClick && "cursor-pointer hover:bg-white/[0.07]",
        className,
      )}
    >
      {/* Thumbnail */}
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.04]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{ background: "linear-gradient(135deg,#00ff88,#00c8ff)" }}
            />
            <Icon name={fileIcon(mime, name)} className="relative h-5 w-5 text-fg-2" />
          </>
        )}
      </div>

      {/* Meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{name}</p>
        <p className="mono mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-3">
          <span>{formatBytes(size)}</span>
          {ext && <span className="rounded bg-white/[0.06] px-1 py-px text-[9px] tracking-wide">{ext}</span>}
          {state !== "idle" && state !== "complete" && (
            <span className={cn(state === "failed" ? "text-[#ff8a9c]" : "text-fg-2")}>· {STATE_LABEL[state]}</span>
          )}
          {showRing && speed != null && speed > 0 && <span>· {formatSpeed(speed)}</span>}
        </p>
      </div>

      {/* Right: ring / check / remove */}
      <div className="flex shrink-0 items-center">
        {showRing && (
          <ProgressRing progress={progress} size={34} stroke={3}>
            <span className="mono text-[9px] text-fg-2">{Math.round(progress * 100)}</span>
          </ProgressRing>
        )}
        {state === "complete" && (
          <span className="grid h-8 w-8 place-items-center" title={verified ? "Transmission verified" : "Complete"}>
            <DrawCheck size={22} />
          </span>
        )}
        {state === "failed" && (
          <span className="grid h-8 w-8 place-items-center text-[#ff8a9c]">
            <Icon name="AlertTriangle" className="h-4 w-4" />
          </span>
        )}
        {onRemove && state !== "uploading" && state !== "extracting" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-fg-3 opacity-0 transition-all hover:bg-white/[0.06] hover:text-fg group-hover:opacity-100"
            aria-label="Remove"
          >
            <Icon name="X" className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
