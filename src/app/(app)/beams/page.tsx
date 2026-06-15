"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Icon } from "@/components/ui/Icon";
import { PulseDot } from "@/components/ui/PulseDot";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { CopyButton } from "@/components/ui/CopyButton";
import { toast } from "@/components/ui/Toast";
import { useTransfers } from "@/store/transfers";
import { useStash } from "@/store/stash";
import { formatBytes, formatRelative, pluralize } from "@/lib/format";
import { fileIcon } from "@/lib/files";
import { beamLink, beamHref } from "@/lib/site";
import { cn } from "@/lib/cn";
import type { BeamRecord } from "@/transfer/types";

/* Beams — live transmissions where your device is the signal tower.
   Active Beams hold a live Vector; past Beams collapse into the Trail. */

const GRADIENT = "linear-gradient(90deg, #00FF88, #00E5C8 38%, #00C8FF 68%, #0099FF)";

const ACTIVE_STATUSES = new Set<BeamRecord["status"]>(["staged", "live", "extracting"]);

function beamTotal(b: BeamRecord): number {
  return b.files.reduce((acc, f) => acc + f.size, 0);
}

function fileSummary(b: BeamRecord): string {
  const first = b.files[0]?.name ?? "Empty beam";
  if (b.files.length <= 1) return first;
  return `${first} +${b.files.length - 1} more`;
}

function statusText(b: BeamRecord): string {
  if (b.status === "staged") return "Awaiting Extract";
  if (b.status === "extracting") return "Transmitting";
  return "Transmitting";
}

const PAST_PILL: Record<string, { label: string; className: string }> = {
  complete: { label: "Complete", className: "text-cyan border-[#00C8FF]/25 bg-[#00C8FF]/[0.08]" },
  ended: { label: "Ended", className: "text-fg-3 border-white/10 bg-white/[0.03]" },
  severed: { label: "Severed", className: "text-[#FF4D6A] border-[#FF4D6A]/25 bg-[#FF4D6A]/[0.08]" },
};

export default function BeamsPage() {
  const hydrated = useTransfers((s) => s.hydrated);
  const beams = useTransfers((s) => s.beams);
  const endBeam = useTransfers((s) => s.endBeam);
  const tag = useStash((s) => s.tag);
  const router = useRouter();

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const { active, past } = useMemo(() => {
    const a: BeamRecord[] = [];
    const p: BeamRecord[] = [];
    for (const b of beams) (ACTIVE_STATUSES.has(b.status) ? a : p).push(b);
    return { active: a, past: p };
  }, [beams]);

  if (!hydrated) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
      </div>
    );
  }

  const empty = active.length === 0 && past.length === 0;
  const seed = tag ?? "stash";

  const handleKill = (b: BeamRecord) => {
    endBeam(b.id);
    toast.warning("Beam severed", `${fileSummary(b)} is no longer transmitting.`);
  };

  const handleOpen = (b: BeamRecord) => {
    router.push(beamHref(b.id));
  };

  const handleEcho = () => {
    toast.info("Echo", "Re-stage this Beam from Send.");
  };

  return (
    <Page>
      <PageHeader
        title="Beams"
        sub="Your device becomes the server. Data travels peer-to-peer."
        icon={
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-cyan">
            <Icon name="Radio" className="h-5 w-5" />
          </span>
        }
        actions={
          !empty ? (
            <Link href="/">
              <Button variant="glass" size="sm" icon="Radio">
                Stage a Beam
              </Button>
            </Link>
          ) : undefined
        }
      />

      {empty ? (
        <EmptyState
          title="No Beams active."
          sub="Stage a file and your device transmits it live the moment someone Extracts."
          action={
            <Link href="/">
              <MagneticButton icon="Radio" size="md">
                Stage a Beam
              </MagneticButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="eyebrow text-fg-2">Active</span>
                <span className="mono tnum rounded-full border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-fg-3">
                  {active.length}
                </span>
              </div>
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {active.map((b, i) => (
                    <ActiveBeamCard
                      key={b.id}
                      beam={b}
                      index={i}
                      seed={seed}
                      shareUrl={beamLink(b.id)}
                      onKill={() => handleKill(b)}
                      onOpen={() => handleOpen(b)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="eyebrow text-fg-2">Past</span>
                <span className="mono tnum rounded-full border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-fg-3">
                  {past.length}
                </span>
              </div>
              <GlassPanel className="divide-y divide-white/[0.06] overflow-hidden p-0">
                {past.map((b, i) => (
                  <PastBeamRow key={b.id} beam={b} index={i} onEcho={handleEcho} />
                ))}
              </GlassPanel>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}

/* ---- Active Beam card ---- */

function ActiveBeamCard({
  beam,
  index,
  seed,
  shareUrl,
  onKill,
  onOpen,
}: {
  beam: BeamRecord;
  index: number;
  seed: string;
  shareUrl: string;
  onKill: () => void;
  onOpen: () => void;
}) {
  const total = beamTotal(beam);
  const awaiting = beam.status === "staged";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 30, delay: index * 0.06 }}
    >
      <GlassPanel glow className="relative overflow-hidden p-0">
        {/* Aurora — thin gradient ribbon along the top edge */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: GRADIENT }} />
        <motion.span
          aria-hidden
          className="absolute left-0 top-0 h-px w-1/3"
          style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)", opacity: 0.7 }}
          animate={{ x: ["-40%", "340%"] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-cyan">
                <Icon name={fileIcon(beam.files[0]?.mime ?? "", beam.files[0]?.name ?? "")} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PulseDot state="hosting" size={9} />
                  <span className="eyebrow text-fg-3">Hosting</span>
                </div>
                <p className="mt-1 truncate text-[15px] font-medium text-fg">{fileSummary(beam)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-3">
                  <span className="mono tnum text-fg-2">{formatBytes(total)}</span>
                  <span className="text-fg-3/50">·</span>
                  <span>
                    {beam.files.length} {pluralize(beam.files.length, "file")}
                  </span>
                  <span className="text-fg-3/50">·</span>
                  <span>{formatRelative(beam.createdAt)}</span>
                </div>
              </div>
            </div>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                awaiting
                  ? "border-[#00C8FF]/25 bg-[#00C8FF]/[0.08] text-cyan"
                  : "border-[#00FF88]/25 bg-[#00FF88]/[0.08] text-green",
              )}
            >
              <motion.span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: awaiting ? "#00C8FF" : "#00FF88" }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              {statusText(beam)}
            </span>
          </div>

          {/* Vector — decorative live data path */}
          <BeamVector seed={seed} active={!awaiting} />

          {beam.message && (
            <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-2">
              {beam.message}
            </p>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <CopyButton value={shareUrl} variant="glass" label="Copy beam link" className="h-10 px-4 text-[13px]" />
            <Button variant="secondary" size="md" icon="ArrowRight" onClick={onOpen}>
              Open
            </Button>
            <div className="ml-auto">
              <Button variant="destructive" size="md" icon="X" onClick={onKill}>
                Kill Beam
              </Button>
            </div>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

/* The Vector: a line from the hosting Orb to the Radio glyph, with gradient
   packets streaming across it. Pure decoration — conveys "live P2P". */

function BeamVector({ seed, active }: { seed: string; active: boolean }) {
  const dots = [0, 0.45, 0.9];
  return (
    <div className="mt-5 flex items-center gap-3">
      <OrbAvatar seed={seed} size={34} presence="hosting" ring />
      <div className="relative h-10 flex-1">
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="beamVec" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00FF88" />
              <stop offset="38%" stopColor="#00E5C8" />
              <stop offset="68%" stopColor="#00C8FF" />
              <stop offset="100%" stopColor="#0099FF" />
            </linearGradient>
          </defs>
          <line x1="2" y1="20" x2="198" y2="20" stroke="url(#beamVec)" strokeWidth="1" strokeOpacity="0.28" />
          <line
            x1="2"
            y1="20"
            x2="198"
            y2="20"
            stroke="url(#beamVec)"
            strokeWidth="1"
            strokeDasharray="4 7"
            strokeOpacity="0.55"
          />
        </svg>
        {active &&
          dots.map((delay, i) => (
            <motion.span
              key={i}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
              style={{ background: i === 0 ? "#00FF88" : i === 1 ? "#00C8FF" : "#0099FF", boxShadow: "0 0 8px currentColor" }}
              initial={{ left: "0%", opacity: 0 }}
              animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: delay * 1.8 }}
            />
          ))}
        {!active && (
          <motion.span
            className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#00C8FF]"
            style={{ boxShadow: "0 0 8px #00C8FF" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
          active ? "border-[#00C8FF]/30 bg-[#00C8FF]/[0.08] text-cyan" : "border-white/8 bg-white/[0.03] text-fg-3",
        )}
      >
        <Icon name="Radio" className="h-4 w-4" />
      </span>
    </div>
  );
}

/* ---- Past Beam row ---- */

function PastBeamRow({
  beam,
  index,
  onEcho,
}: {
  beam: BeamRecord;
  index: number;
  onEcho: () => void;
}) {
  const total = beamTotal(beam);
  const recips = beam.recipients.length;
  const pill = PAST_PILL[beam.status] ?? PAST_PILL.ended;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 32, delay: index * 0.04 }}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/[0.02] text-fg-3">
        <Icon name={fileIcon(beam.files[0]?.mime ?? "", beam.files[0]?.name ?? "")} className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{fileSummary(beam)}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-3">
          <span className="mono tnum text-fg-2">{formatBytes(total)}</span>
          <span className="text-fg-3/50">·</span>
          <span className="mono tnum">{recips}</span>
          <span>{pluralize(recips, "recipient")}</span>
          <span className="text-fg-3/50">·</span>
          <span>{formatRelative(beam.createdAt)}</span>
        </div>
      </div>

      <span
        className={cn(
          "hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex",
          pill.className,
        )}
      >
        {pill.label}
      </span>

      <Button variant="ghost" size="icon-sm" icon="Repeat" onClick={onEcho} aria-label="Echo this Beam" />
    </motion.div>
  );
}
