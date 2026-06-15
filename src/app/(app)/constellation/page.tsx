"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Page, PageHeader } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Orb } from "@/components/brand/Orb";
import { toast } from "@/components/ui/Toast";

import { useStash } from "@/store/stash";
import { orbIdentity } from "@/lib/avatar";
import { formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CrewMember } from "@/transfer/types";

/* ============================================================================
   Constellation — the Crew rendered as a live star map.
   Center node = you. Each star = a Crew member. Bright Vectors = active Beams.
   ========================================================================== */

const VIEW_W = 800;
const VIEW_H = 520;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;

const DAY = 24 * 3600_000;

interface StarNode {
  member: CrewMember;
  x: number;
  y: number;
  /** Star radius, scaled by interactions. */
  r: number;
  /** Opacity, scaled by recency of last signal. */
  opacity: number;
  /** Deterministic "active Beam" flag — these get a bright solid Vector. */
  active: boolean;
  /** Twinkle phase offset so stars don't pulse in sync. */
  phase: number;
}

/** Map a crew member's interaction count to a clamped star radius (4..11). */
function starRadius(interactions: number): number {
  const r = 4 + Math.min(interactions, 14) * 0.5;
  return Math.max(4, Math.min(11, r));
}

/** Recency → opacity. Fresh signal glows; old signal dims to a faint ember. */
function recencyOpacity(lastSignal: number | undefined, now: number): number {
  if (!lastSignal) return 0.4;
  const ageDays = (now - lastSignal) / DAY;
  if (ageDays <= 1) return 1;
  if (ageDays >= 30) return 0.4;
  return 1 - (ageDays / 30) * 0.6;
}

export default function ConstellationPage() {
  const hydrated = useStash((s) => s.hydrated);
  const crew = useStash((s) => s.crew);
  const tag = useStash((s) => s.tag);
  const name = useStash((s) => s.name);
  const avatar = useStash((s) => s.avatar);
  const appearOffline = useStash((s) => s.settings.appearOffline);

  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const now = Date.now();

  const stars = useMemo<StarNode[]>(() => {
    const total = crew.length;
    if (total === 0) return [];
    // Two rings keep the map from looking like a clock face. Inner ring is
    // tighter; outer ring breathes into the negative space.
    const ringA = 132;
    const ringB = 196;
    return crew.map((member, i) => {
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
      const onOuter = total > 6 ? i % 2 === 1 : false;
      const radius = onOuter ? ringB : ringA;
      // Slight deterministic jitter so the rings feel organic, never rigid.
      const jitter = ((member.interactions * 17) % 11) - 5;
      const r = radius + jitter;
      return {
        member,
        x: CENTER_X + Math.cos(angle) * r,
        y: CENTER_Y + Math.sin(angle) * r,
        r: starRadius(member.interactions),
        opacity: recencyOpacity(member.lastSignal, now),
        active: member.interactions % 2 === 0 && member.interactions > 0,
        phase: (i % 5) * 0.45,
      };
    });
  }, [crew, now]);

  const activeCount = stars.filter((s) => s.active).length;
  const youSeed = tag ?? name ?? "stash";
  const youId = orbIdentity(youSeed, name);
  const hoveredStar = hovered ? stars.find((s) => s.member.tag === hovered) ?? null : null;

  if (!hydrated) {
    return (
      <Page>
        <div className="grid place-items-center py-40">
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Constellation"
        sub="Your network, mapped. Each star is a Crew member; lines are active Beams."
        icon={
          <span
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-white/[0.03]"
            aria-hidden
          >
            <Icon name="Sparkles" className="h-4 w-4 text-cyan" />
          </span>
        }
        actions={
          crew.length > 0 ? (
            <Link href="/crew">
              <Button variant="glass" size="sm" icon="Users">
                Crew
              </Button>
            </Link>
          ) : undefined
        }
      />

      {crew.length === 0 ? (
        <div className="relative">
          {/* Even when dark, the central Orb keeps drifting — the ship is idle,
              not dead. */}
          <div className="pointer-events-none absolute inset-x-0 top-10 grid place-items-center">
            <div className="anim-float opacity-50">
              <Orb size={104} state="dim" />
            </div>
          </div>
          <div className="relative pt-24">
            <EmptyState
              title="Your constellation is dark."
              sub="Add Crew members to light up your signal network."
              action={
                <Link href="/crew">
                  <Button variant="primary" icon="Plus">
                    Add Crew
                  </Button>
                </Link>
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Legend / status strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Stat label="Crew" value={String(crew.length)} accent="text-fg" />
            <Stat
              label="Active vectors"
              value={String(activeCount)}
              accent="text-cyan"
              dot
            />
            <div className="ml-auto hidden items-center gap-2 sm:flex">
              <span className="eyebrow text-fg-3">Signal network</span>
              <span className="h-px w-10 bg-gradient-to-r from-green/60 to-blue/60" />
            </div>
          </div>

          {/* The star map */}
          <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.015]">
            {/* Ambient radial wash behind the map */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(0,200,255,0.08), rgba(0,255,136,0.03) 38%, transparent 70%)",
              }}
              aria-hidden
            />

            <motion.svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="relative w-full"
              style={{ height: "min(70vh, 560px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              role="img"
              aria-label={`Constellation of ${crew.length} Crew ${pluralize(crew.length, "member")}`}
            >
              <defs>
                {/* Cold gradient for the Vector lines — green → blue, never reversed. */}
                <linearGradient id="vector" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00FF88" />
                  <stop offset="40%" stopColor="#00E5C8" />
                  <stop offset="70%" stopColor="#00C8FF" />
                  <stop offset="100%" stopColor="#0099FF" />
                </linearGradient>
                <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#9affd6" stopOpacity="1" />
                  <stop offset="45%" stopColor="#00E5C8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0099FF" stopOpacity="0.2" />
                </radialGradient>
                <radialGradient id="coreHalo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00E5C8" stopOpacity="0.35" />
                  <stop offset="55%" stopColor="#00C8FF" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0099FF" stopOpacity="0" />
                </radialGradient>
                <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>

              {/* Faint guide rings — the orbital scaffolding. */}
              {[132, 196].map((rr) => (
                <circle
                  key={rr}
                  cx={CENTER_X}
                  cy={CENTER_Y}
                  r={rr}
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                  strokeDasharray="2 8"
                />
              ))}

              {/* Slow group rotation — alive, never dizzying. */}
              <motion.g
                style={{ transformOrigin: `${CENTER_X}px ${CENTER_Y}px` }}
                animate={{ rotate: 360 }}
                transition={{ duration: 240, ease: "linear", repeat: Infinity }}
              >
                {/* Vectors first, so stars sit on top. */}
                {stars.map((star, i) => (
                  <Vector key={`v-${star.member.tag}`} star={star} index={i} />
                ))}

                {/* Stars */}
                {stars.map((star, i) => (
                  <StarGlyph
                    key={`s-${star.member.tag}`}
                    star={star}
                    index={i}
                    isHovered={hovered === star.member.tag}
                    onHoverStart={() => setHovered(star.member.tag)}
                    onHoverEnd={() =>
                      setHovered((cur) => (cur === star.member.tag ? null : cur))
                    }
                    onSelect={() => {
                      toast.info(
                        "@" + star.member.tag,
                        "Beam, Drop or add to a Pool from Crew",
                      );
                      router.push("/crew");
                    }}
                  />
                ))}
              </motion.g>

              {/* Central core — YOU. Outside the rotating group so it stays steady. */}
              <circle cx={CENTER_X} cy={CENTER_Y} r={86} fill="url(#coreHalo)" />
              <motion.circle
                cx={CENTER_X}
                cy={CENTER_Y}
                r={48}
                fill="none"
                stroke="rgba(0,229,200,0.4)"
                strokeWidth={1}
                initial={{ opacity: 0.35 }}
                animate={{ opacity: [0.35, 0.7, 0.35], r: [48, 54, 48] }}
                transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
              />

              <foreignObject
                x={CENTER_X - 36}
                y={CENTER_Y - 36}
                width={72}
                height={72}
                style={{ overflow: "visible" }}
              >
                <div className="grid h-full w-full place-items-center">
                  <OrbAvatar
                    seed={youSeed}
                    name={name}
                    src={avatar}
                    size={56}
                    presence={appearOffline ? "offline" : "online"}
                  />
                </div>
              </foreignObject>

              {/* Your @tag label beneath the core. */}
              <text
                x={CENTER_X}
                y={CENTER_Y + 58}
                textAnchor="middle"
                className="mono"
                style={{ fontSize: 12, letterSpacing: "0.04em" }}
                fill="rgba(255,255,255,0.92)"
              >
                {tag ? "@" + tag : "you"}
              </text>
            </motion.svg>

            {/* Persistent caption, low in the frame. */}
            <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto max-w-md text-balance px-4 text-center text-[11px] leading-relaxed text-fg-3">
              Your network, mapped. Each star is a Crew member. Lines are active
              Beams.
            </p>

            {/* Hover tooltip — anchored to the star's position in the viewBox,
                converted to percentages so it tracks across responsive sizes. */}
            {hoveredStar && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(hoveredStar.x / VIEW_W) * 100}%`,
                  top: `${(hoveredStar.y / VIEW_H) * 100}%`,
                  marginTop: -16,
                }}
              >
                <div className="glass-strong flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-2.5">
                  <OrbAvatar
                    seed={hoveredStar.member.tag}
                    name={hoveredStar.member.name}
                    size={32}
                    presence={
                      hoveredStar.member.hosting
                        ? "hosting"
                        : hoveredStar.member.online
                          ? "online"
                          : "offline"
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {hoveredStar.member.name}
                    </p>
                    <p className="mono truncate text-[11px] text-cyan">
                      @{hoveredStar.member.tag}
                    </p>
                    <p className="mt-0.5 text-[11px] text-fg-3">
                      Last signal:{" "}
                      {hoveredStar.member.lastSignal
                        ? formatRelative(hoveredStar.member.lastSignal)
                        : "—"}
                    </p>
                  </div>
                </div>
                {/* Tooltip stem */}
                <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-white/10 bg-[#0a0a12]" />
              </motion.div>
            )}
          </div>

          <p className="text-center text-[11px] text-fg-3">
            Hover a star to read its signal. Select one to Beam, Drop, or pool
            from{" "}
            <Link href="/crew" className="text-fg-2 underline-offset-2 hover:underline">
              Crew
            </Link>
            .
          </p>
        </div>
      )}
    </Page>
  );
}

/* --------------------------------- Vector --------------------------------- */
/* The data path from your core to a Crew star. Faint dashed for dormant links,
   a bright solid arc with travelling Sparks for active Beams. */
function Vector({ star, index }: { star: StarNode; index: number }) {
  const id = orbIdentity(star.member.tag, star.member.name);

  if (!star.active) {
    return (
      <line
        x1={CENTER_X}
        y1={CENTER_Y}
        x2={star.x}
        y2={star.y}
        stroke={`hsl(${(id.hueA + id.hueB) / 2} 90% 60%)`}
        strokeWidth={1}
        strokeDasharray="2 7"
        strokeOpacity={0.16 + star.opacity * 0.12}
        strokeLinecap="round"
      />
    );
  }

  // Active Vector: solid gradient line + 1–2 Sparks drifting along it.
  const sparkCount = star.member.interactions % 4 === 0 ? 2 : 1;
  return (
    <g>
      <line
        x1={CENTER_X}
        y1={CENTER_Y}
        x2={star.x}
        y2={star.y}
        stroke="url(#vector)"
        strokeWidth={1.4}
        strokeOpacity={0.5}
        strokeLinecap="round"
      />
      {Array.from({ length: sparkCount }).map((_, k) => (
        <motion.circle
          key={k}
          r={2.4}
          fill="#9affd6"
          initial={{ cx: CENTER_X, cy: CENTER_Y, opacity: 0 }}
          animate={{
            cx: [CENTER_X, star.x],
            cy: [CENTER_Y, star.y],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.6,
            ease: "easeInOut",
            repeat: Infinity,
            delay: (index * 0.3 + k * 1.3) % 2.6,
          }}
          style={{ filter: "drop-shadow(0 0 4px rgba(0,229,200,0.9))" }}
        />
      ))}
    </g>
  );
}

/* -------------------------------- StarGlyph ------------------------------- */
function StarGlyph({
  star,
  index,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: {
  star: StarNode;
  index: number;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
}) {
  const labelTag = "@" + star.member.tag;
  return (
    <motion.g
      style={{ cursor: "pointer", transformOrigin: `${star.x}px ${star.y}px` }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onTap={onSelect}
      onClick={onSelect}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 22,
        delay: 0.15 + index * 0.05,
      }}
      whileHover={{ scale: 1.35 }}
      tabIndex={0}
      role="button"
      aria-label={`${star.member.name}, ${labelTag}`}
    >
      {/* Soft outer glow */}
      <motion.circle
        cx={star.x}
        cy={star.y}
        r={star.r * 2.4}
        fill="url(#starGlow)"
        filter="url(#soft)"
        animate={{ opacity: [star.opacity * 0.45, star.opacity * 0.7, star.opacity * 0.45] }}
        transition={{
          duration: 3.4,
          ease: "easeInOut",
          repeat: Infinity,
          delay: star.phase,
        }}
      />
      {/* Hover ring */}
      {isHovered && (
        <circle
          cx={star.x}
          cy={star.y}
          r={star.r + 5}
          fill="none"
          stroke="rgba(0,229,200,0.7)"
          strokeWidth={1}
        />
      )}
      {/* The star core — twinkles. */}
      <motion.circle
        cx={star.x}
        cy={star.y}
        r={star.r}
        fill="url(#starGlow)"
        animate={{ opacity: [star.opacity, Math.min(1, star.opacity + 0.25), star.opacity] }}
        transition={{
          duration: 2.8,
          ease: "easeInOut",
          repeat: Infinity,
          delay: star.phase,
        }}
        style={{ filter: "drop-shadow(0 0 3px rgba(0,200,255,0.55))" }}
      />
      {/* Bright pip for active members */}
      {star.active && (
        <circle cx={star.x} cy={star.y} r={1.4} fill="#eafff6" />
      )}
      {/* Callsign label — only revealed on hover to keep the map clean. */}
      {isHovered && (
        <text
          x={star.x}
          y={star.y + star.r + 14}
          textAnchor="middle"
          className="mono"
          style={{ fontSize: 10, letterSpacing: "0.03em" }}
          fill="rgba(255,255,255,0.85)"
        >
          {labelTag}
        </text>
      )}
    </motion.g>
  );
}

/* ---------------------------------- Stat ---------------------------------- */
function Stat({
  label,
  value,
  accent,
  dot,
}: {
  label: string;
  value: string;
  accent?: string;
  dot?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
        </span>
      )}
      <span className={cn("mono tnum text-base font-light", accent ?? "text-fg")}>
        {value}
      </span>
      <span className="eyebrow text-fg-3">{label}</span>
    </div>
  );
}
