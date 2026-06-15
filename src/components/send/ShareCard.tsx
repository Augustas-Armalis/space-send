"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { Orb } from "@/components/brand/Orb";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { QRCode } from "@/components/ui/QRCode";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { SignalBars } from "@/components/ui/SignalBars";
import { SpeedGauge } from "@/components/ui/SpeedGauge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { COPY } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { useStash } from "@/store/stash";
import type { useSend } from "./useSend";
import type { BeamRecipient } from "@/transfer/types";

type Controller = ReturnType<typeof useSend>;

function TypewriterText({ text, speed = 18 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span className="mono break-all text-[13px] text-fg">{shown}</span>;
}

export function ShareCard({ s }: { s: Controller }) {
  const isBeam = s.mode === "beam";
  const [showQR, setShowQR] = useState(false);
  const { tag, name, avatar } = useStash();

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Space Send", text: "I sent you files via Space Send", url: s.shareUrl });
      } catch {
        /* cancelled */
      }
    } else {
      setShowQR((v) => !v);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-center">
      {/* Orb crystallizes here */}
      <motion.div layoutId="send-orb" className="mb-5">
        <Orb size={96} state={isBeam ? "waiting" : "complete"} intensity={0.6} />
      </motion.div>

      <h2 className="text-xl font-medium tracking-tight text-fg">
        {isBeam ? COPY.staged : COPY.transmissionReady}
      </h2>
      <p className="mt-1.5 max-w-xs text-balance text-sm text-fg-3">
        {isBeam ? COPY.stagedSub : COPY.transmissionReadySub}
      </p>

      {/* Link block */}
      <div className="mt-6 w-full">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
          <Icon name="Link2" className="h-4 w-4 shrink-0 text-fg-3" />
          <div className="min-w-0 flex-1 text-left">
            <TypewriterText text={s.shareUrl} />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <CopyButton value={s.shareUrl} className="flex-1" />
          <Button variant="glass" size="lg" onClick={nativeShare} aria-label="Share">
            <Icon name="Share2" className="h-4 w-4" />
          </Button>
          <Button
            variant="glass"
            size="lg"
            onClick={() => setShowQR((v) => !v)}
            aria-label="QR code"
            className={cn(showQR && "text-[#00c8ff]")}
          >
            <Icon name="QrCode" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* QR */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 flex flex-col items-center overflow-hidden"
          >
            <QRCode value={s.shareUrl} size={160} />
            <p className="mt-2 text-xs text-fg-3">{COPY.qrLabel}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Beam live dashboard */}
      {isBeam && (
        <BeamLivePanel s={s} senderSeed={tag ?? "anon"} senderName={name} senderAvatar={avatar} />
      )}

      {/* New transmission */}
      <button
        onClick={s.reset}
        className="mt-6 inline-flex items-center gap-2 text-sm text-fg-3 transition-colors hover:text-fg"
      >
        <Icon name="RefreshCw" className="h-3.5 w-3.5" /> {COPY.newTransmission}
      </button>
    </motion.div>
  );
}

function BeamLivePanel({
  s,
  senderSeed,
  senderName,
  senderAvatar,
}: {
  s: Controller;
  senderSeed: string;
  senderName: string;
  senderAvatar: string | null;
}) {
  const [throttle, setThrottle] = useState(0);
  const recipients = s.recipients;

  const applyThrottle = (mbps: number) => {
    setThrottle(mbps);
    s.host.current?.setThrottle(mbps === 0 ? 0 : mbps * 1024 * 1024);
  };

  return (
    <div className="mt-6 w-full space-y-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Live Beam</span>
        <span className="mono inline-flex items-center gap-1.5 text-[11px] text-[#00c8ff]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00c8ff] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00c8ff]" />
          </span>
          {recipients.length > 0 ? `${recipients.length} connected` : COPY.awaitingExtract}
        </span>
      </div>

      {/* Vector visualization */}
      <BeamVector senderSeed={senderSeed} senderName={senderName} senderAvatar={senderAvatar} recipients={recipients} active={s.aggregateSpeed > 0} />

      {recipients.length === 0 ? (
        <p className="text-center text-[13px] text-fg-3">
          Your device transmits the moment someone Extracts.
        </p>
      ) : (
        <div className="space-y-2">
          {recipients.map((r) => (
            <RecipientRow key={r.id} r={r} />
          ))}
        </div>
      )}

      {/* Aggregate + throttle */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex items-center gap-2 text-xs text-fg-3">
          <Icon name="Gauge" className="h-3.5 w-3.5" />
          <SpeedGauge bytesPerSec={s.aggregateSpeed} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-fg-3">Limit output</span>
          <select
            value={throttle}
            onChange={(e) => applyThrottle(Number(e.target.value))}
            className="mono h-7 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[11px] text-fg outline-none"
          >
            <option value={0}>Max</option>
            <option value={1}>1 MB/s</option>
            <option value={5}>5 MB/s</option>
            <option value={10}>10 MB/s</option>
          </select>
        </div>
      </div>

      <Button
        variant="destructive"
        size="md"
        className="w-full"
        onClick={s.reset}
        icon="X"
      >
        Kill Beam
      </Button>
    </div>
  );
}

function RecipientRow({ r }: { r: BeamRecipient }) {
  const statusText =
    r.status === "reading" ? "reading" : r.status === "extracting" ? "extracting" : r.status === "complete" ? "complete" : r.status;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
      <OrbAvatar seed={r.tag ?? r.id} name={r.tag ?? "Anonymous"} size={32} presence="online" ring={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{r.tag ? `@${r.tag}` : "Anonymous"}</p>
        <p className="mono text-[11px] text-fg-3">
          {statusText}
          {r.region ? ` · ${r.region}` : ""}
        </p>
      </div>
      <SignalBars level={r.signal} />
      {r.status === "extracting" || r.status === "complete" ? (
        <ProgressRing progress={r.progress} size={30} stroke={3}>
          <span className="mono text-[8px] text-fg-2">{Math.round(r.progress * 100)}</span>
        </ProgressRing>
      ) : null}
    </div>
  );
}

/* Two abstract glyphs with gradient Orbs streaming between them. */
function BeamVector({
  senderSeed,
  senderName,
  senderAvatar,
  recipients,
  active,
}: {
  senderSeed: string;
  senderName: string;
  senderAvatar: string | null;
  recipients: BeamRecipient[];
  active: boolean;
}) {
  const streaming = active && recipients.some((r) => r.status === "extracting");
  return (
    <div className="relative h-20">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 80" preserveAspectRatio="none" fill="none">
        <path d="M44 40 H 256" stroke="url(#vec)" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.5" />
        <defs>
          <linearGradient id="vec" x1="0" y1="0" x2="300" y2="0">
            <stop stopColor="#00ff88" />
            <stop offset="1" stopColor="#0099ff" />
          </linearGradient>
        </defs>
        {streaming &&
          [0, 1, 2, 3].map((i) => (
            <motion.circle
              key={i}
              r="2.5"
              cy="40"
              fill={i % 2 ? "#00c8ff" : "#00ff88"}
              initial={{ cx: 44 }}
              animate={{ cx: 256 }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.28, ease: "linear" }}
            />
          ))}
      </svg>
      {/* Sender glyph */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <OrbAvatar seed={senderSeed} name={senderName} src={senderAvatar} size={40} presence="hosting" />
      </div>
      {/* Recipient glyph */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        {recipients.length > 0 ? (
          <OrbAvatar seed={recipients[0].tag ?? recipients[0].id} size={40} presence="online" ring={false} />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-white/15 text-fg-3">
            <Icon name="Radio" className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
