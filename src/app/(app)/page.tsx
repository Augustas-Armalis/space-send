"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { SendComposer, SendWorking } from "@/components/send/SendComposer";
import { ShareCard } from "@/components/send/ShareCard";
import { useSend } from "@/components/send/useSend";
import { BRAND } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";

export default function LandingPage() {
  const s = useSend();

  // Paste-to-add files.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length && s.phase === "compose") s.addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [s]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Ambient radial glow — drifts slowly in the upper-left quadrant */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[640px] w-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,255,136,0.10), rgba(0,200,255,0.08) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-1/3 h-[420px] w-[420px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(0,153,255,0.08), transparent 65%)", filter: "blur(50px)" }}
        animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Desktop top-right utility nav */}
      <div className="absolute right-6 top-5 z-30 hidden items-center gap-1 lg:flex">
        <a
          href="#mac"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-fg-3 transition-colors hover:text-fg"
        >
          <Icon name="Sparkles" className="h-3.5 w-3.5" /> Mac app
        </a>
        <Link
          href="/vault"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-fg-3 transition-colors hover:text-fg"
        >
          My Vault
        </Link>
      </div>

      <div className="mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 py-10 xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-8 xl:px-8">
        {/* Hero (desktop left column / mobile top) */}
        <div className="order-1 text-center xl:order-none xl:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl xl:text-6xl"
          >
            Transmit anything.
            <br />
            <span className="gradient-text font-semibold">Instantly.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-5 max-w-md text-balance text-[15px] leading-relaxed text-fg-3 xl:mx-0"
          >
            Drop files into the cloud, or Beam them live — peer-to-peer, straight from your device.
            No login. End-to-end encrypted.
          </motion.p>
          <div className="mt-7 hidden items-center gap-5 xl:flex">
            <Feature icon="Cloud" title="Drop" sub="Cloud, 10 GB free" />
            <Feature icon="Radio" title="Beam" sub="Live P2P, no upload" />
            <Feature icon="Shield" title="Private" sub="Zero-knowledge" />
          </div>
        </div>

        {/* The upload card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="order-2 w-full justify-self-center xl:order-none xl:justify-self-end"
        >
          <GlassPanel tilt glow className="w-full p-5 sm:p-6">
            <AnimatePresence mode="wait">
              {s.phase === "compose" && (
                <motion.div key="compose" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                  <SendComposer s={s} />
                </motion.div>
              )}
              {s.phase === "working" && (
                <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <SendWorking s={s} />
                </motion.div>
              )}
              {s.phase === "ready" && (
                <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ShareCard s={s} />
                </motion.div>
              )}
            </AnimatePresence>
          </GlassPanel>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-4 px-4 text-[11px] text-fg-3 lg:justify-start lg:px-8">
        <Link href="/privacy" className="transition-colors hover:text-fg-2">
          Privacy
        </Link>
        <Link href="/about" className="transition-colors hover:text-fg-2">
          How it works
        </Link>
        <a
          href={BRAND.builtByUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-fg-2"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#00c8ff]" /> Contles
        </a>
      </div>
    </div>
  );
}

function Feature({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-fg-2">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <p className="text-[13px] font-medium text-fg">{title}</p>
        <p className="text-[11px] text-fg-3">{sub}</p>
      </div>
    </div>
  );
}
