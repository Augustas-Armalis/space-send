"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Orb } from "@/components/brand/Orb";
import { Wordmark } from "@/components/brand/Wordmark";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { PulseDot } from "@/components/ui/PulseDot";
import { Icon } from "@/components/ui/Icon";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuroraRibbon } from "@/components/brand/AuroraRibbon";
import { formatCountdown } from "@/lib/format";

export function RecipientFrame({
  children,
  active,
  intensity = 0.5,
  accent,
}: {
  children: React.ReactNode;
  active?: boolean;
  intensity?: number;
  accent?: string;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AuroraRibbon active={!!active} intensity={intensity} tall />
      {/* Soft glow upper third */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[50vh]"
        style={{
          background: accent
            ? `radial-gradient(60% 100% at 50% 0%, ${accent}22, transparent 70%)`
            : "radial-gradient(60% 100% at 50% 0%, rgba(0,229,200,0.10), rgba(0,153,255,0.06) 45%, transparent 70%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-center px-4 py-5">
        <Wordmark href="/" size="sm" />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:pt-8">{children}</main>
    </div>
  );
}

export function SenderHero({
  name,
  seed,
  avatar,
  count,
  message,
  beam,
  online,
}: {
  name: string;
  seed: string;
  avatar?: string | null;
  count: number;
  message?: string;
  beam?: boolean;
  online?: boolean;
}) {
  const display = name || (beam ? "Someone" : "Anonymous");
  const heading = `${display} sent you ${count} file${count === 1 ? "" : "s"}.`;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-5">
        <OrbAvatar seed={seed} name={name} src={avatar} size={64} presence={beam ? (online ? "online" : "offline") : undefined} />
      </div>
      <h1 className="text-balance text-2xl font-light tracking-tight sm:text-3xl">
        {heading.split("").map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.012 }}
          >
            {ch}
          </motion.span>
        ))}
      </h1>
      {beam && (
        <p className="mono mt-2 inline-flex items-center gap-1.5 text-[11px] text-fg-3">
          <PulseDot state={online ? "online" : "offline"} /> {online ? "Sender online" : "Sender offline"}
        </p>
      )}
      {message && (
        <div className="glass mt-5 max-w-md rounded-2xl border-l-2 border-l-[#00c8ff]/50 px-4 py-3 text-left">
          <p className="text-sm leading-relaxed text-fg-2">{message}</p>
        </div>
      )}
    </div>
  );
}

export function CountdownBar({ expiresAt }: { expiresAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (expiresAt === null) return null;
  const remaining = expiresAt - now;
  return (
    <p className="mono inline-flex items-center gap-1.5 text-[11px] text-fg-3">
      <Icon name="Clock" className="h-3 w-3" />
      Expires in {formatCountdown(remaining)}
    </p>
  );
}

export function ExtractCTA({
  label,
  onClick,
  loading,
  disabled,
  accent,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  accent?: string;
}) {
  return (
    <div className="sticky bottom-4 z-20 mt-8 flex justify-center px-4">
      <MagneticButton
        onClick={onClick}
        loading={loading}
        disabled={disabled}
        icon="Download"
        className="w-full max-w-md shadow-[0_12px_48px_-12px_rgba(0,200,255,0.5)]"
        style={accent ? { background: accent } : undefined}
      >
        {label}
      </MagneticButton>
    </div>
  );
}

export function RecipientFooter({
  expiresAt,
  showContles = true,
  verified,
}: {
  expiresAt?: number | null;
  showContles?: boolean;
  verified?: boolean;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-2.5 border-t border-white/5 pt-6 text-center">
      {verified && (
        <p className="mono inline-flex items-center gap-1.5 text-[11px] text-[#00c8ff]">
          <Icon name="Check" className="h-3 w-3" /> Transmission verified
        </p>
      )}
      {expiresAt !== undefined && <CountdownBar expiresAt={expiresAt ?? null} />}
      {showContles && <ContlesMark />}
    </div>
  );
}

export function RecipientError({
  title,
  sub,
  dimOrb = true,
}: {
  title: string;
  sub?: string;
  dimOrb?: boolean;
}) {
  return (
    <RecipientFrame>
      <div className="grid min-h-[60vh] place-items-center">
        <EmptyState title={title} sub={sub} orbSize={dimOrb ? 96 : 80} />
      </div>
      <div className="flex justify-center">
        <ContlesMark />
      </div>
    </RecipientFrame>
  );
}

/* The connecting handshake — two pulsing dots reaching toward each other. */
export function Handshake({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-7">
      <div className="relative flex items-center gap-10">
        <motion.span
          className="h-3 w-3 rounded-full"
          style={{ background: "#00ff88", boxShadow: "0 0 14px #00ff88" }}
          animate={{ x: [0, 14, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <svg width="80" height="20" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.line
            x1="6" y1="10" x2="74" y2="10"
            stroke="url(#hs)" strokeWidth="1.5" strokeDasharray="3 4"
            animate={{ opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          <defs>
            <linearGradient id="hs" x1="0" x2="80">
              <stop stopColor="#00ff88" />
              <stop offset="1" stopColor="#0099ff" />
            </linearGradient>
          </defs>
        </svg>
        <motion.span
          className="h-3 w-3 rounded-full"
          style={{ background: "#0099ff", boxShadow: "0 0 14px #0099ff" }}
          animate={{ x: [0, -14, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="text-sm text-fg-2">{label}</p>
    </div>
  );
}

export function CompleteState({ accent }: { accent?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center"
    >
      <div className="mb-5">
        <Orb size={96} state="complete" intensity={0.8} />
      </div>
      <h2 className="text-xl font-medium text-fg">All files extracted.</h2>
      <p className="mt-1.5 text-sm text-fg-3">Transmission complete.</p>
      <p className="mono mt-4 inline-flex items-center gap-1.5 text-[11px] text-[#00c8ff]">
        <Icon name="Check" className="h-3 w-3" /> Transmission verified
      </p>
      <div className={cn("mt-6 rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-3")}>
        <p className="text-[13px] text-fg-2">
          Liked Space Send? It&apos;s made by{" "}
          <a href="https://contles.com/?ref=spacesend" target="_blank" rel="noopener noreferrer" className="text-[#00c8ff] hover:underline">
            Contles
          </a>
          .
        </p>
      </div>
    </motion.div>
  );
}
