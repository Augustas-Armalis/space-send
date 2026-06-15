"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import { useTransfers } from "@/store/transfers";
import type { TrailEntry } from "@/transfer/types";
import { formatBytes, formatDuration, formatDate, pluralize } from "@/lib/format";
import { downloadBlob } from "@/lib/files";
import { cn } from "@/lib/cn";
import { fadeUp, stagger, spring } from "@/lib/motion";

/* Trail — the black box of your signal history. Every Drop, Beam, Ask and
   Pool action, timestamped, rendered as a vertical mission-log timeline. */

type FilterId = "all" | "drop" | "beam" | "ask" | "pool";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "drop", label: "Drops" },
  { id: "beam", label: "Beams" },
  { id: "ask", label: "Asks" },
  { id: "pool", label: "Pools" },
];

const TYPE_META: Record<
  TrailEntry["type"],
  { icon: string; tint: string; ring: string; verb: string; unit: (n: number) => string }
> = {
  drop: {
    icon: "Cloud",
    tint: "text-cyan",
    ring: "border-cyan/25 bg-cyan/[0.08]",
    verb: "Dropped",
    unit: (n) => pluralize(n, "extraction"),
  },
  beam: {
    icon: "Radio",
    tint: "text-blue",
    ring: "border-blue/25 bg-blue/[0.08]",
    verb: "Beamed",
    unit: (n) => pluralize(n, "recipient"),
  },
  ask: {
    icon: "FolderPlus",
    tint: "text-teal",
    ring: "border-teal/25 bg-teal/[0.08]",
    verb: "Asked",
    unit: (n) => pluralize(n, "submission"),
  },
  pool: {
    icon: "Waves",
    tint: "text-green",
    ring: "border-green/25 bg-green/[0.08]",
    verb: "Pooled",
    unit: (n) => pluralize(n, "file"),
  },
};

const STATUS_META: Record<
  TrailEntry["status"],
  { label: string; cls: string; pulse?: boolean }
> = {
  complete: { label: "Complete", cls: "border-cyan/30 bg-cyan/[0.1] text-cyan" },
  active: { label: "Active", cls: "border-blue/30 bg-blue/[0.1] text-blue", pulse: true },
  ended: { label: "Ended", cls: "border-white/10 bg-white/[0.03] text-fg-3" },
  failed: { label: "Failed", cls: "border-[#FFB020]/30 bg-[#FFB020]/[0.1] text-[#FFB020]" },
};

const Middot = () => <span className="px-1.5 text-fg-3">·</span>;

function TrailRow({ entry, last }: { entry: TrailEntry; last: boolean }) {
  const meta = TYPE_META[entry.type];
  const status = STATUS_META[entry.status];
  const inbound = entry.direction === "in";

  return (
    <motion.li variants={fadeUp} className="relative flex gap-4">
      {/* Timeline spine */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-md",
            meta.ring,
          )}
        >
          <Icon name={meta.icon} className={cn("h-[18px] w-[18px]", meta.tint)} />
          <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/10 bg-deep">
            <Icon
              name={inbound ? "ArrowLeft" : "ArrowRight"}
              className={cn(
                "h-3 w-3",
                inbound ? "-rotate-90 text-teal" : "-rotate-90 text-cyan",
              )}
            />
          </span>
        </div>
        {!last && <div className="w-px flex-1 bg-gradient-to-b from-white/10 to-transparent" />}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 pb-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-snug text-fg">
              <span className="text-fg-2">{meta.verb}</span>{" "}
              <span className="font-medium">{entry.label}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center text-[13px] text-fg-3">
              <span className={cn("mono tnum", meta.tint)}>{formatBytes(entry.size)}</span>
              <Middot />
              <span className="mono tnum text-fg-2">{entry.count}</span>
              <span className="ml-1 text-fg-3">{meta.unit(entry.count)}</span>
              {entry.type === "beam" && entry.durationMs ? (
                <>
                  <Middot />
                  <span className="mono tnum text-fg-2">
                    {formatDuration((entry.durationMs || 0) / 1000)}
                  </span>
                </>
              ) : null}
              <Middot />
              <span className="mono text-fg-3">{formatDate(entry.ts)}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                status.cls,
              )}
            >
              {status.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
              )}
              {status.label}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Echo"
              onClick={() => toast.info("Echo", "Re-send this transmission from Send.")}
            >
              <Icon name="Repeat" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export default function TrailPage() {
  const hydrated = useTransfers((s) => s.hydrated);
  const trail = useTransfers((s) => s.trail);
  const clearTrail = useTransfers((s) => s.clearTrail);

  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: trail.length, drop: 0, beam: 0, ask: 0, pool: 0 };
    for (const e of trail) c[e.type] += 1;
    return c;
  }, [trail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trail
      .filter((e) => (filter === "all" ? true : e.type === filter))
      .filter((e) => (q ? e.label.toLowerCase().includes(q) : true));
  }, [trail, filter, query]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
      </div>
    );
  }

  const handleExport = () => {
    if (trail.length === 0) {
      toast.warning("Nothing to export", "Your Trail is empty.");
      return;
    }
    const blob = new Blob([JSON.stringify(trail, null, 2)], { type: "application/json" });
    downloadBlob(blob, "space-send-trail.json");
    toast.success("Trail exported", `${trail.length} ${pluralize(trail.length, "entry", "entries")} written.`);
  };

  const handleClear = () => {
    if (trail.length === 0) return;
    clearTrail();
    setQuery("");
    setFilter("all");
    toast.success("Trail cleared", "The black box has been wiped.");
  };

  return (
    <Page>
      <PageHeader
        title="Trail"
        sub="Every Drop, Beam, Ask and Pool action, timestamped."
        actions={
          <>
            <Button variant="glass" size="sm" icon="Download" onClick={handleExport}>
              Export
            </Button>
            <Button variant="ghost" size="sm" icon="Trash2" onClick={handleClear}>
              Clear
            </Button>
          </>
        }
      />

      {trail.length === 0 ? (
        <EmptyState
          title="No transmissions logged."
          sub="Your first Drop or Beam will appear here."
          action={
            <Link href="/">
              <MagneticButton icon="Rocket" size="md">
                Send something
              </MagneticButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-all duration-200",
                      active
                        ? "border-cyan/40 bg-cyan/[0.1] text-cyan"
                        : "border-white/8 bg-white/[0.02] text-fg-2 hover:border-white/15 hover:text-fg",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        "mono tnum text-[11px]",
                        active ? "text-cyan/80" : "text-fg-3",
                      )}
                    >
                      {counts[f.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Icon
                name="Search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the Trail"
                className="h-9 w-full rounded-xl border border-white/8 bg-white/[0.02] pl-9 pr-3 text-sm text-fg placeholder:text-fg-3 outline-none transition-colors focus:border-cyan/40 focus:bg-white/[0.04]"
              />
            </div>
          </div>

          {/* Timeline */}
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.length === 0 ? (
              <motion.div
                key="no-match"
                variants={fadeUp}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center"
              >
                <Icon name="Search" className="h-6 w-6 text-fg-3" />
                <p className="text-sm text-fg-2">No entries match your filter.</p>
                <button
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                  className="text-[13px] text-cyan transition-opacity hover:opacity-80"
                >
                  Reset view
                </button>
              </motion.div>
            ) : (
              <motion.ol
                key={`${filter}-${query}`}
                variants={stagger(0.05)}
                initial="hidden"
                animate="show"
                className="pl-0.5"
              >
                {filtered.map((entry, i) => (
                  <TrailRow key={entry.id} entry={entry} last={i === filtered.length - 1} />
                ))}
              </motion.ol>
            )}
          </AnimatePresence>

          {/* Footer ledger */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...spring, delay: 0.1 }}
            className="flex items-center justify-center gap-2 pt-2 text-[11px] text-fg-3"
          >
            <Icon name="Shield" className="h-3 w-3" />
            <span className="eyebrow">
              {filtered.length} of {trail.length} {pluralize(trail.length, "entry", "entries")} logged
            </span>
          </motion.div>
        </div>
      )}
    </Page>
  );
}
