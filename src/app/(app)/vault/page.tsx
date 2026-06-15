"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Icon } from "@/components/ui/Icon";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { StorageRing } from "@/components/ui/StorageRing";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { CopyButton } from "@/components/ui/CopyButton";
import { toast } from "@/components/ui/Toast";
import { useTransfers, QUOTA } from "@/store/transfers";
import type { DropRecord } from "@/transfer/types";
import { formatBytes, formatRelative, formatCountdown, pluralize } from "@/lib/format";
import { fileIcon } from "@/lib/files";
import { dropLink } from "@/lib/site";
import { cn } from "@/lib/cn";
import { fadeUp, stagger, spring } from "@/lib/motion";

/* ===========================================================================
   The Vault — your deep-space storage hold. Dropped files orbit here until
   you clear them. Cold palette, frosted glass, mission-control calm.
   ========================================================================= */

type SortMode = "recent" | "largest" | "extracted";
type ViewMode = "grid" | "list";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "largest", label: "Largest" },
  { id: "extracted", label: "Most extracted" },
];

const EXTEND_MS = 7 * 24 * 3600 * 1000;
const STALE_MS = 14 * 24 * 3600 * 1000;

function isManaged(d: DropRecord): boolean {
  return d.backend === "managed";
}

function firstName(d: DropRecord): string {
  if (d.files.length === 0) return "Empty Drop";
  if (d.files.length === 1) return d.files[0].name;
  return `${d.files.length} files`;
}

/* ---- Backend pill ---------------------------------------------------------- */

function BackendPill({ drop }: { drop: DropRecord }) {
  const managed = isManaged(drop);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        managed
          ? "border-cyan/20 bg-cyan/10 text-cyan"
          : "border-white/10 bg-white/[0.04] text-fg-3",
      )}
    >
      <Icon name={managed ? "Cloud" : "HardDrive"} className="h-3 w-3" />
      {managed ? "Managed" : "Local"}
    </span>
  );
}

/* ---- Row actions (shared between grid + list) ------------------------------ */

function DropActions({
  drop,
  origin,
  onTrash,
  className,
}: {
  drop: DropRecord;
  origin: string;
  onTrash: () => void;
  className?: string;
}) {
  const extendDrop = useTransfers((s) => s.extendDrop);
  const link = dropLink(drop.id);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <CopyButton
        value={link}
        variant="glass"
        label="Copy"
        copiedLabel="Copied"
        className="h-8 px-3 text-[13px]"
      />
      <Button
        variant="glass"
        size="icon-sm"
        title="Extend orbit by 7 cycles"
        onClick={() => {
          extendDrop(drop.id, EXTEND_MS);
          toast.success("Orbit extended", "Decays in 7 cycles from now.");
        }}
      >
        <Icon name="Clock" className="h-4 w-4" />
      </Button>
      <Button
        variant="glass"
        size="icon-sm"
        title="Move to trash"
        className="text-fg-3 hover:text-[#ff8a9c]"
        onClick={onTrash}
      >
        <Icon name="Trash2" className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ---- Thumbnail tile -------------------------------------------------------- */

function Thumb({ drop, size = 48 }: { drop: DropRecord; size?: number }) {
  const multi = drop.files.length > 1;
  const first = drop.files[0];
  const icon = first ? fileIcon(first.mime, first.name) : "FileIcon";
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[0.03]"
      style={{ width: size, height: size }}
    >
      <Icon name={icon} className="h-1/2 w-1/2 text-fg-2" />
      {multi && (
        <span className="mono absolute -bottom-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full border border-white/10 bg-deep px-1 text-[10px] font-semibold tabular-nums text-cyan">
          {drop.files.length}
        </span>
      )}
    </div>
  );
}

/* ---- List row -------------------------------------------------------------- */

function DropRow({ drop, origin }: { drop: DropRecord; origin: string }) {
  const trashDrop = useTransfers((s) => s.trashDrop);
  const expired = drop.expiresAt !== null && drop.expiresAt <= Date.now();

  const handleTrash = () => {
    trashDrop(drop.id);
    toast.success("Moved to trash", `${firstName(drop)} left orbit.`);
  };

  return (
    <motion.div variants={fadeUp} layout exit="exit">
      <GlassPanel
        glow
        className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
      >
        <Thumb drop={drop} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-fg">{firstName(drop)}</p>
            <BackendPill drop={drop} />
          </div>
          <div className="mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-fg-3">
            <span className="text-fg-2">{formatBytes(drop.totalSize)}</span>
            <span>{formatRelative(drop.createdAt)}</span>
            <span>
              {drop.downloads} {pluralize(drop.downloads, "extraction")}
            </span>
            <span className={cn(expired ? "text-[#ff8a9c]" : "text-fg-3")}>
              {drop.expiresAt === null
                ? "no decay"
                : expired
                  ? "orbit decayed"
                  : `decays in ${formatCountdown(drop.expiresAt - Date.now())}`}
            </span>
          </div>
        </div>
        <DropActions
          drop={drop}
          origin={origin}
          onTrash={handleTrash}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        />
      </GlassPanel>
    </motion.div>
  );
}

/* ---- Grid card ------------------------------------------------------------- */

function DropCard({ drop, origin }: { drop: DropRecord; origin: string }) {
  const trashDrop = useTransfers((s) => s.trashDrop);
  const expired = drop.expiresAt !== null && drop.expiresAt <= Date.now();

  const handleTrash = () => {
    trashDrop(drop.id);
    toast.success("Moved to trash", `${firstName(drop)} left orbit.`);
  };

  return (
    <motion.div variants={fadeUp} layout exit="exit">
      <GlassPanel tilt glow className="group flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <Thumb drop={drop} size={56} />
          <BackendPill drop={drop} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{firstName(drop)}</p>
          <div className="mono mt-2 flex flex-col gap-1 text-[11px] tabular-nums text-fg-3">
            <span className="text-fg-2">{formatBytes(drop.totalSize)}</span>
            <span>{formatRelative(drop.createdAt)}</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Download" className="h-3 w-3" />
              {drop.downloads} {pluralize(drop.downloads, "extraction")}
            </span>
            <span className={cn(expired ? "text-[#ff8a9c]" : "text-fg-3")}>
              {drop.expiresAt === null
                ? "no decay"
                : expired
                  ? "orbit decayed"
                  : `decays in ${formatCountdown(drop.expiresAt - Date.now())}`}
            </span>
          </div>
        </div>
        <DropActions
          drop={drop}
          origin={origin}
          onTrash={handleTrash}
          className="border-t border-white/8 pt-3"
        />
      </GlassPanel>
    </motion.div>
  );
}

/* ---- Hero stats ------------------------------------------------------------ */

function HeroStat({
  label,
  value,
  format,
  accent,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-fg-3">{label}</span>
      <AnimatedNumber
        value={value}
        format={format}
        className={cn("text-2xl font-semibold tabular-nums", accent ?? "text-fg")}
      />
    </div>
  );
}

/* ===========================================================================
   Page
   ========================================================================= */

export default function VaultPage() {
  const hydrated = useTransfers((s) => s.hydrated);
  const drops = useTransfers((s) => s.drops);
  const usedBytes = useTransfers((s) => s.usedBytes());
  const trashBytes = useTransfers((s) => s.trashBytes());
  const trashDrop = useTransfers((s) => s.trashDrop);
  const restoreDrop = useTransfers((s) => s.restoreDrop);
  const removeDrop = useTransfers((s) => s.removeDrop);

  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortMode>("recent");
  const [origin, setOrigin] = useState("");
  const [cleanupDismissed, setCleanupDismissed] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const active = useMemo(() => drops.filter((d) => !d.trashedAt), [drops]);
  const trashed = useMemo(() => drops.filter((d) => d.trashedAt), [drops]);

  const sorted = useMemo(() => {
    const copy = [...active];
    copy.sort((a, b) => {
      if (sort === "largest") return b.totalSize - a.totalSize;
      if (sort === "extracted") return b.downloads - a.downloads;
      return b.createdAt - a.createdAt;
    });
    return copy;
  }, [active, sort]);

  const extractions = useMemo(
    () => active.reduce((acc, d) => acc + d.downloads, 0),
    [active],
  );

  const stale = useMemo(() => {
    const now = Date.now();
    return active.filter((d) => d.downloads === 0 && now - d.createdAt > STALE_MS);
  }, [active]);

  const ratio = QUOTA > 0 ? usedBytes / QUOTA : 0;
  const nearFull = ratio > 0.95;
  const approaching = ratio > 0.8 && !nearFull;

  if (!hydrated) {
    return (
      <Page>
        <div className="grid place-items-center py-32">
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
        </div>
      </Page>
    );
  }

  const sweepStale = () => {
    stale.forEach((d) => trashDrop(d.id));
    setCleanupDismissed(true);
    toast.success(
      "Orbit cleared",
      `${stale.length} ${pluralize(stale.length, "file")} swept to trash.`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Vault"
        sub="Files you have Dropped orbit here until you clear them."
        icon={<Icon name="Database" className="h-6 w-6 text-cyan" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-xl border border-white/8 bg-white/[0.02] p-1 sm:flex">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                    sort === s.id ? "bg-white/[0.07] text-fg" : "text-fg-3 hover:text-fg-2",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.02] p-1">
              <button
                onClick={() => setView("grid")}
                title="Grid view"
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg transition-colors",
                  view === "grid" ? "bg-white/[0.07] text-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                <Icon name="Folder" className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                title="List view"
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg transition-colors",
                  view === "list" ? "bg-white/[0.07] text-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                <Icon name="Menu" className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      />

      {/* Sort fallback for mobile */}
      <div className="mb-5 flex items-center gap-1.5 overflow-x-auto sm:hidden">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              sort === s.id
                ? "border-cyan/20 bg-cyan/10 text-cyan"
                : "border-white/8 text-fg-3",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* HERO */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <GlassPanel glow className="mb-6 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10">
            <StorageRing used={usedBytes} total={QUOTA} size={140} />
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
                <HeroStat label="Used" value={usedBytes} format={(n) => formatBytes(n)} />
                <HeroStat label="Files" value={active.length} />
                <HeroStat
                  label="Extractions"
                  value={extractions}
                  accent="text-cyan"
                />
              </div>
              <div className="mono mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums text-fg-3">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="Clock" className="h-3 w-3" />
                  Recalculated just now
                </span>
                <span>·</span>
                <span>
                  {formatBytes(QUOTA - usedBytes)} free in orbit
                </span>
              </div>

              <AnimatePresence>
                {(approaching || nearFull) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={spring}
                    className={cn(
                      "mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium",
                      nearFull
                        ? "border-[#ff4d6a]/30 bg-[#ff4d6a]/10 text-[#ff8a9c]"
                        : "border-[#ffb020]/30 bg-[#ffb020]/10 text-[#ffb020]",
                    )}
                  >
                    <Icon name="AlertTriangle" className="h-3.5 w-3.5" />
                    {nearFull ? "Vault near full" : "Approaching capacity"}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* SMART CLEANUP */}
      <AnimatePresence>
        {stale.length > 0 && !cleanupDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="mb-6 overflow-hidden"
          >
            <GlassPanel className="flex flex-col gap-3 border border-cyan/15 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan/10 text-cyan">
                  <Icon name="Sparkles" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-fg">Smart cleanup</p>
                  <p className="mono mt-0.5 text-[11px] tabular-nums text-fg-3">
                    {stale.length} {pluralize(stale.length, "file")} with zero extractions, older
                    than 14 cycles.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button variant="ghost" size="sm" onClick={() => setCleanupDismissed(true)}>
                  Dismiss
                </Button>
                <Button variant="secondary" size="sm" icon="Trash2" onClick={sweepStale}>
                  Sweep to trash
                </Button>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DROP LIST */}
      {active.length === 0 ? (
        <EmptyState
          title="Your Vault is empty."
          sub="Dropped files orbit here until you clear them."
          action={
            <Link href="/">
              <MagneticButton icon="Rocket" size="md">
                Drop your first file
              </MagneticButton>
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="eyebrow text-fg-3">In orbit</span>
            <span className="mono text-[11px] tabular-nums text-fg-3">
              {active.length} {pluralize(active.length, "Drop")}
            </span>
          </div>
          <motion.div
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className={cn(
              view === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-3",
            )}
          >
            <AnimatePresence mode="popLayout">
              {sorted.map((drop) =>
                view === "grid" ? (
                  <DropCard key={drop.id} drop={drop} origin={origin} />
                ) : (
                  <DropRow key={drop.id} drop={drop} origin={origin} />
                ),
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      {/* TRASH */}
      {trashed.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setTrashOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-2.5">
              <Icon name="Trash2" className="h-4 w-4 text-fg-3" />
              <span className="text-sm font-medium text-fg-2">Trash</span>
              <span className="mono text-[11px] tabular-nums text-fg-3">
                {trashed.length} {pluralize(trashed.length, "item")} ·{" "}
                {formatBytes(trashBytes)} held
              </span>
            </div>
            <motion.span animate={{ rotate: trashOpen ? 180 : 0 }} transition={spring}>
              <Icon name="ChevronDown" className="h-4 w-4 text-fg-3" />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {trashOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-col gap-2">
                  {trashed.map((drop) => (
                    <GlassPanel
                      key={drop.id}
                      className="flex items-center gap-3 px-4 py-3 opacity-80"
                    >
                      <Thumb drop={drop} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-fg-2">{firstName(drop)}</p>
                        <p className="mono mt-0.5 text-[11px] tabular-nums text-fg-3">
                          {formatBytes(drop.totalSize)} · trashed{" "}
                          {drop.trashedAt ? formatRelative(drop.trashedAt) : "recently"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="glass"
                          size="sm"
                          icon="RefreshCw"
                          onClick={() => {
                            restoreDrop(drop.id);
                            toast.success("Restored", `${firstName(drop)} back in orbit.`);
                          }}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          title="Delete permanently"
                          onClick={() => {
                            removeDrop(drop.id);
                            toast.warning("Deleted", "This Drop is gone for good.");
                          }}
                        >
                          <Icon name="X" className="h-4 w-4" />
                        </Button>
                      </div>
                    </GlassPanel>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Page>
  );
}
