"use client";

import { Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Wordmark } from "@/components/brand/Wordmark";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { FileCard } from "@/components/ui/FileCard";
import { Icon } from "@/components/ui/Icon";
import { PulseDot } from "@/components/ui/PulseDot";
import { toast } from "@/components/ui/Toast";
import { useTransfers } from "@/store/transfers";
import { useStash } from "@/store/stash";
import { shortId } from "@/lib/ids";
import { formatBytes, formatRelative, pluralize } from "@/lib/format";
import { stagger, fadeUp } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { Pool, PoolFile } from "@/transfer/types";

/* ──────────────────────────────────────────────────────────────────────────
   Public Pool view — a shared gravity well anyone with the link can orbit.
   The host owns this surface, so no Contles mark. Crew drop files in and pull
   them out; everyone sees a live activity feed.
   ──────────────────────────────────────────────────────────────────────── */

function GlowHeader() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[50vh]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(0,229,200,0.10), rgba(0,153,255,0.06) 45%, transparent 70%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-center px-4 py-5">
        <Wordmark href="/" size="sm" />
      </header>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <GlowHeader />
      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:pt-8">{children}</main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PublicPoolInner />
    </Suspense>
  );
}

function PublicPoolInner() {
  const id = useSearchParams().get("p") ?? "";

  const hydrated = useTransfers((s) => s.hydrated);
  const pools = useTransfers((s) => s.pools);
  const updatePool = useTransfers((s) => s.updatePool);
  const myTag = useStash((s) => s.tag);

  const pool = useMemo<Pool | undefined>(() => pools.find((p) => p.id === id), [pools, id]);

  if (!hydrated) {
    return (
      <Shell>
        <div className="grid min-h-[50vh] place-items-center text-fg-3">
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin" />
        </div>
      </Shell>
    );
  }

  if (!pool) {
    return (
      <Shell>
        <div className="grid min-h-[55vh] place-items-center">
          <EmptyState
            title="Nothing here."
            sub="This Pool link does not match any known gravity well."
            orbSize={96}
          />
        </div>
      </Shell>
    );
  }

  return <PoolView pool={pool} myTag={myTag} updatePool={updatePool} />;
}

/* ── The found Pool ──────────────────────────────────────────────────────── */

function PoolView({
  pool,
  myTag,
  updatePool,
}: {
  pool: Pool;
  myTag: string | null;
  updatePool: (id: string, patch: Partial<Pool>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const used = pool.files.reduce((acc, f) => acc + f.size, 0);
  const pct = Math.min(1, pool.maxBytes > 0 ? used / pool.maxBytes : 0);
  const live = pool.type === "live";

  const roster = useMemo(() => {
    const all = [pool.host, ...pool.members];
    return Array.from(new Set(all));
  }, [pool.host, pool.members]);

  const recent = useMemo(() => [...pool.files].sort((a, b) => b.ts - a.ts), [pool.files]);

  const onPick = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const uploader = myTag || "you";
    const additions: PoolFile[] = Array.from(list).map((f) => ({
      id: shortId(),
      name: f.name,
      size: f.size,
      mime: f.type,
      uploader,
      ts: Date.now(),
      downloads: 0,
    }));
    updatePool(pool.id, { files: [...pool.files, ...additions] });
    toast.success(
      additions.length === 1 ? "Dropped into the Pool" : `${additions.length} files dropped in`,
      `Your Crew can pull ${additions.length === 1 ? "it" : "them"} out now.`,
    );
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Shell>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />

      {/* Hero */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <GlassPanel glow className="overflow-hidden p-6">
          {live && pool.online && (
            <motion.span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, #00ff88, #00c8ff, #0099ff, transparent)" }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow inline-flex items-center gap-1.5 text-fg-3">
              <Icon name="Waves" className="h-3 w-3" /> Pool
            </span>
            <PoolTypeBadge type={pool.type} online={pool.online} />
          </div>

          <h1 className="mt-3 text-balance text-2xl font-light tracking-tight text-fg sm:text-3xl">
            {pool.name}
          </h1>
          <p className="mono mt-1.5 text-[11px] tnum text-fg-3">
            {pool.files.length} {pluralize(pool.files.length, "file")} ·{" "}
            {roster.length} {pluralize(roster.length, "member")}
          </p>

          {/* Size meter */}
          <div className="mt-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <motion.span
                className="block h-full rounded-full gradient-bg"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct * 100, used > 0 ? 4 : 0)}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 28 }}
              />
            </div>
            <p className="mono mt-2 text-[11px] tnum text-fg-3">
              <span className="text-fg-2">{formatBytes(used)}</span> / {formatBytes(pool.maxBytes)}
            </p>
          </div>

          {/* Roster */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 pt-4">
            {roster.map((tag) => {
              const isHost = tag === pool.host;
              return (
                <span key={tag} className="inline-flex items-center gap-2">
                  <OrbAvatar
                    seed={tag}
                    name={tag}
                    size={24}
                    ring={false}
                    presence={isHost && pool.online ? "hosting" : undefined}
                  />
                  <span className="mono text-[12px] text-fg-2">@{tag}</span>
                  {isHost && <span className="eyebrow text-fg-3">Host</span>}
                </span>
              );
            })}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Drop tile */}
      <motion.button
        type="button"
        onClick={() => inputRef.current?.click()}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 280, damping: 28 }}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.99 }}
        className="group mt-4 flex w-full flex-col items-center gap-2 rounded-[var(--radius-glass)] border border-dashed border-white/12 bg-white/[0.015] px-6 py-7 text-center transition-colors hover:border-[#00c8ff]/40 hover:bg-white/[0.03]"
      >
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/[0.04] text-fg-2 transition-colors group-hover:text-cyan">
          <Icon name="CloudUpload" className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium text-fg">Drop files into the Pool</span>
        <span className="text-[12px] text-fg-3">Click to select — everyone in the Pool can pull them out.</span>
      </motion.button>

      {/* File grid */}
      <section className="mt-8">
        <p className="eyebrow mb-3 px-1">In the Pool</p>
        {pool.files.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-fg-3">
              <Icon name="Waves" className="h-4 w-4" />
            </span>
            <p className="text-[13px] text-fg-3">Pool is empty — be the first to drop something in.</p>
          </div>
        ) : (
          <motion.div
            key={pool.files.length}
            variants={stagger(0.04)}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {recent.map((f) => (
              <motion.div key={f.id} variants={fadeUp}>
                <PoolFileRow file={f} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Activity feed */}
      {pool.files.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow mb-3 px-1">Activity</p>
          <div className="space-y-1">
            {recent.slice(0, 6).map((f) => (
              <div
                key={`act-${f.id}`}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px]"
              >
                <PulseDot state="online" size={7} />
                <span className="min-w-0 flex-1 truncate text-fg-2">
                  <span className="mono text-fg">@{f.uploader}</span> added{" "}
                  <span className="text-fg">{f.name}</span>
                </span>
                <span className="mono shrink-0 text-[11px] text-fg-3">{formatRelative(f.ts)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="mt-10 flex flex-col items-center gap-2 border-t border-white/5 pt-6 text-center">
        <p className="mono inline-flex items-center gap-1.5 text-[11px] text-fg-3">
          <Icon name="Lock" className="h-3 w-3" /> {pool.retention === "forever" ? "Kept in orbit" : `Decays in ${pool.retention}`}
        </p>
      </div>
    </Shell>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function PoolFileRow({ file }: { file: PoolFile }) {
  return (
    <div className="relative">
      <FileCard name={file.name} size={file.size} mime={file.mime} state="idle" />
      <div className="mono pointer-events-none absolute bottom-2.5 right-3 flex items-center gap-1.5 text-[10px] text-fg-3">
        <span>@{file.uploader}</span>
        <span className="text-fg-3/60">·</span>
        <span>{formatRelative(file.ts)}</span>
      </div>
    </div>
  );
}

function PoolTypeBadge({ type, online }: { type: "cloud" | "live"; online?: boolean }) {
  if (type === "live") {
    return (
      <span className={cn(
        "mono inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wide",
        online ? "text-cyan" : "text-fg-2",
      )}>
        <Icon name="Radio" className="h-3 w-3" />
        {online ? (
          <span className="inline-flex items-center gap-1">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-cyan"
              style={{ boxShadow: "0 0 8px #00c8ff" }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            Live
          </span>
        ) : (
          "Live"
        )}
      </span>
    );
  }
  return (
    <span className="mono inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wide text-fg-2">
      <Icon name="Cloud" className="h-3 w-3 text-blue" />
      Cloud
    </span>
  );
}
