"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Page } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CopyButton } from "@/components/ui/CopyButton";
import { QRCode } from "@/components/ui/QRCode";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { SignalBars } from "@/components/ui/SignalBars";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTower } from "@/store/tower";
import { useStash } from "@/store/stash";
import { formatBytes } from "@/lib/format";
import type { BeamRecipient } from "@/transfer/types";

export default function Page_() {
  return (
    <Suspense fallback={null}>
      <Tower />
    </Suspense>
  );
}

function uptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function Tower() {
  const router = useRouter();
  const active = useTower((s) => s.active);
  const shareUrl = useTower((s) => s.shareUrl);
  const id = useTower((s) => s.id);
  const files = useTower((s) => s.files);
  const recipients = useTower((s) => s.recipients);
  const stats = useTower((s) => s.stats);
  const aggSpeed = useTower((s) => s.aggSpeed);
  const startedAt = useTower((s) => s.startedAt);
  const addFiles = useTower((s) => s.addFiles);
  const setThrottle = useTower((s) => s.setThrottle);
  const setTurbo = useTower((s) => s.setTurbo);
  const turbo = useTower((s) => s.turbo);
  const kill = useTower((s) => s.kill);
  const { name, tag, avatar } = useStash();

  const addRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(startedAt);
  const [customMbps, setCustomMbps] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!active) {
    return (
      <Page>
        <div className="grid min-h-[60vh] place-items-center">
          <EmptyState
            title="No live Beam"
            sub="A tower runs only while its tab is open. Start a Beam from Send to host one."
            action={
              <Link href="/">
                <Button variant="primary" icon="Radio">Start a Beam</Button>
              </Link>
            }
          />
        </div>
      </Page>
    );
  }

  const totalSize = files.reduce((a, f) => a + f.meta.size, 0);
  const applyLimit = (mbps: number, custom = false) => {
    setThrottle(mbps <= 0 ? 0 : mbps * 1024 * 1024);
    if (!custom) setCustomMbps("");
  };
  const stop = () => {
    kill();
    router.push("/");
  };

  return (
    <Page>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#00c8ff]/25 bg-[#00c8ff]/[0.08] text-[#00c8ff]">
              <Icon name="Radio" className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Signal Tower</h1>
          </div>
          <p className="mono mt-1.5 flex items-center gap-2 text-[11px] text-fg-3">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
            </span>
            LIVE · beam {id} · up {uptime(now - startedAt)}
          </p>
        </div>
        <Button variant="destructive" icon="X" onClick={stop}>Stop tower</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT: recipients + files */}
        <div className="space-y-5">
          {/* Aggregate stats */}
          <GlassPanel glow className="p-5 sm:p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow">Total throughput</p>
                <p className="font-heading text-4xl font-semibold tracking-tight text-fg tabular-nums">
                  {formatBytes(aggSpeed)}<span className="text-lg text-fg-3">/s</span>
                </p>
              </div>
              <div className="text-right">
                <p className="mono text-[11px] text-fg-3">streaming peer-to-peer</p>
                <p className="mono text-[11px] text-fg-3">{formatBytes(stats.bufferedBytes)} buffered</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Connected" value={stats.connected} accent="#00c8ff" />
              <Stat label="Downloading" value={stats.active} accent="#00ff88" pulse={stats.active > 0} />
              <Stat label="Completed" value={stats.completed} accent="#00e5c8" />
            </div>
          </GlassPanel>

          {/* Recipients */}
          <GlassPanel className="p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Connected devices</p>
              <span className="mono text-[11px] text-fg-3">{recipients.length}</span>
            </div>
            {recipients.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-fg-3">
                Share the link. Anyone who opens it appears here — you&apos;ll see their download live.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recipients.map((r) => (
                  <RecipientCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </GlassPanel>

          {/* Files */}
          <GlassPanel className="p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Hosting · {files.length} {files.length === 1 ? "file" : "files"} · {formatBytes(totalSize)}</p>
            </div>
            <div className="space-y-1.5">
              {files.map((f) => (
                <div key={f.meta.id} className="flex items-center gap-2 text-[13px] text-fg-2">
                  <Icon name="FileIcon" className="h-3.5 w-3.5 shrink-0 text-fg-3" />
                  <span className="truncate">{f.meta.name}</span>
                  <span className="mono ml-auto text-[11px] text-fg-3">{formatBytes(f.meta.size)}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => addRef.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/12 py-2.5 text-[13px] text-fg-3 transition-colors hover:border-[#00c8ff]/30 hover:text-fg-2"
            >
              <Icon name="Plus" className="h-4 w-4" /> Add files to this Beam
            </button>
            <input
              ref={addRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </GlassPanel>
        </div>

        {/* RIGHT: share + controls */}
        <div className="space-y-5">
          <GlassPanel glow className="p-5 sm:p-6 text-center">
            <div className="mx-auto mb-3 flex w-fit items-center gap-2">
              <OrbAvatar seed={tag ?? "anon"} name={name} src={avatar} size={40} presence="hosting" />
              <div className="text-left">
                <p className="text-sm font-medium text-fg">{name || "You"}</p>
                <p className="mono text-[10px] text-fg-3">hosting</p>
              </div>
            </div>
            <p className="eyebrow mb-2">Viewer link · send to anyone</p>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left">
              <Icon name="Link2" className="h-4 w-4 shrink-0 text-fg-3" />
              <span className="mono truncate text-[12px] text-fg">{shareUrl}</span>
            </div>
            <div className="mt-3">
              <CopyButton value={shareUrl} className="w-full" />
            </div>
            <div className="mt-4 flex justify-center">
              <QRCode value={shareUrl} size={150} />
            </div>
          </GlassPanel>

          {/* Overdrive */}
          <GlassPanel className="p-5 sm:p-6">
            <button
              onClick={() => setTurbo(!turbo)}
              className={cnTurbo(turbo)}
            >
              <div className="text-left">
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-fg">
                  <Icon name="Zap" className="h-4 w-4 text-[#00ff88]" /> Overdrive
                </p>
                <p className="mt-0.5 text-[11px] text-fg-3">Use more memory + CPU to push max throughput.</p>
              </div>
              <span
                className={[
                  "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
                  turbo ? "border-transparent bg-[#00ff88]/80" : "border-white/10 bg-white/[0.06]",
                ].join(" ")}
              >
                <span
                  className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all"
                  style={{ left: turbo ? 22 : 2 }}
                />
              </span>
            </button>
            <p className="mt-2 text-[11px] text-fg-3">
              {turbo ? "On — biggest chunks + 256 MB in-flight buffer. Best on fast/local networks." : "Off — balanced, low-memory streaming."}
            </p>
          </GlassPanel>

          {/* Bitrate control */}
          <GlassPanel className="p-5 sm:p-6">
            <p className="eyebrow mb-3 inline-flex items-center gap-1.5">
              <Icon name="Gauge" className="h-3.5 w-3.5" /> Output speed
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {[0, 5, 25, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => applyLimit(v)}
                  className="mono h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12px] text-fg-2 transition-colors hover:border-[#00c8ff]/30 hover:text-fg"
                >
                  {v === 0 ? "Max" : `${v}`}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Custom"
                value={customMbps}
                onChange={(e) => {
                  setCustomMbps(e.target.value);
                  applyLimit(e.target.value === "" ? 0 : Number(e.target.value), true);
                }}
                className="mono h-8 w-24 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-fg outline-none focus:border-[#00c8ff]/40"
              />
              <span className="mono text-[12px] text-fg-3">MB/s</span>
            </div>
            <p className="mt-2 text-[11px] text-fg-3">Max = full speed. Set a ceiling if you need to keep bandwidth free.</p>
          </GlassPanel>
        </div>
      </div>
    </Page>
  );
}

function cnTurbo(on: boolean): string {
  return [
    "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors",
    on ? "border-[#00ff88]/30 bg-[#00ff88]/[0.06]" : "border-white/8 bg-white/[0.02] hover:border-white/15",
  ].join(" ");
}

function Stat({ label, value, accent, pulse }: { label: string; value: number; accent: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1.5">
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: accent }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          </span>
        )}
        <span className="mono text-xl font-medium tabular-nums" style={{ color: accent }}>{value}</span>
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-3">{label}</p>
    </div>
  );
}

function RecipientCard({ r }: { r: BeamRecipient }) {
  const pct = Math.round(r.progress * 100);
  const statusText =
    r.status === "complete" ? "Done" :
    r.status === "extracting" ? "Downloading" :
    r.status === "disconnected" ? "Disconnected" : "Connected";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
    >
      <OrbAvatar seed={r.tag ?? r.id} name={r.tag ?? "Anonymous"} size={38} presence={r.status === "disconnected" ? "offline" : "online"} ring={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{r.tag ? `@${r.tag}` : "Anonymous"}</p>
        <p className="mono text-[11px] text-fg-3">
          {statusText}
          {r.region ? ` · ${r.region}` : ""}
          {r.status === "extracting" && r.speed > 0 ? ` · ${formatBytes(r.speed)}/s` : ""}
        </p>
      </div>
      <SignalBars level={r.signal} />
      <ProgressRing progress={r.progress} size={40} stroke={3.5}>
        <span className="mono text-[9px] text-fg-2">{pct}</span>
      </ProgressRing>
    </motion.div>
  );
}
