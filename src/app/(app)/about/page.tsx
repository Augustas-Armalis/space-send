"use client";

import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/brand/Orb";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { VOCAB } from "@/lib/constants";
import { cn } from "@/lib/cn";

/* ── animation presets ────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

/* ── vocab grid data ──────────────────────────────────────────────────── */
const vocabEntries: { term: string; meaning: string }[] = [
  { term: VOCAB.orb, meaning: "The glowing sphere mascot — Space Send's living signal." },
  { term: VOCAB.drop, meaning: "A cloud transfer. Files enter orbit; a link materialises." },
  { term: VOCAB.beam, meaning: "A live peer-to-peer stream. Your device is the tower." },
  { term: VOCAB.stage, meaning: "Prepare a file for a Beam before the signal goes live." },
  { term: VOCAB.extract, meaning: "What a recipient does — pulls the file from the link." },
  { term: VOCAB.ask, meaning: "A file request. Others send to you, not the other way." },
  { term: VOCAB.pool, meaning: "A shared container — cloud or live — for a group." },
  { term: VOCAB.crew, meaning: "Your trusted contacts, stored only on your device." },
  { term: VOCAB.constellation, meaning: "The star map of your Crew and their presence." },
  { term: VOCAB.project, meaning: "A named workspace grouping related transfers." },
  { term: VOCAB.vault, meaning: "Your personal storage — Drops you have sent or received." },
  { term: VOCAB.trail, meaning: "The transfer log — every transmission, in chronological order." },
  { term: VOCAB.tag, meaning: "Your @callsign — a human-readable device identity." },
  { term: VOCAB.aurora, meaning: "The edge ribbon that lights up on active transmissions." },
  { term: VOCAB.pulse, meaning: "Presence signal — whether a peer is online or hosting." },
  { term: VOCAB.spark, meaning: "The moment a Beam locks onto a recipient — connection confirmed." },
  { term: VOCAB.signal, meaning: "Connection quality, shown in 1–5 bars." },
  { term: VOCAB.vector, meaning: "The data path a Beam or Drop travels." },
  { term: VOCAB.probe, meaning: "A lightweight ping to verify a peer is still reachable." },
  { term: VOCAB.stash, meaning: "Your local identity — keys, tag, name, avatar." },
  { term: VOCAB.echo, meaning: "Resend a previous Drop without re-uploading." },
];

/* ── identity bullets ─────────────────────────────────────────────────── */
const identityPoints: string[] = [
  "Your identity lives in the Stash — a JSON object in your browser's local storage, never transmitted to any server.",
  "A cryptographic key pair is generated on first launch, entirely on your device. The private key never leaves.",
  "Your Crew — the contacts you trust — is stored exclusively in the Stash. We have no record of who you know.",
  "There is no account system. No email, no password, no session token on any server bearing your identity.",
  "You can export your Stash to migrate to another device, or wipe it completely with a single action.",
];

/* ── component ────────────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <Page>
      <PageHeader
        title="How it works"
        sub="Two ways to transmit. No login. No middleman."
        icon={<Icon name="Info" className="h-5 w-5 text-fg-3" />}
      />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mb-14 flex flex-col items-center gap-6 py-10 text-center"
      >
        <div className="relative">
          <div
            className="absolute inset-0 -z-10 rounded-full blur-[72px]"
            style={{
              background:
                "radial-gradient(circle, rgba(0,229,200,0.18) 0%, rgba(0,200,255,0.08) 60%, transparent 100%)",
            }}
          />
          <Orb size={96} state="idle" intensity={0.7} />
        </div>
        <p className="max-w-xs text-2xl font-light tracking-tight text-fg sm:max-w-sm sm:text-3xl">
          Transmit anything.{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #00FF88, #00C8FF)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Instantly.
          </span>
        </p>
        <p className="max-w-md text-sm text-fg-2">
          No account required. No servers between you and the person receiving your files —
          unless you need the cloud, in which case only the minimum touches it.
        </p>
      </motion.div>

      {/* ── Two modes ──────────────────────────────────────────────────── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {/* Drop card */}
        <motion.div variants={fadeUp}>
          <GlassPanel glow className="flex h-full flex-col gap-5 p-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,200,255,0.08))",
                  border: "1px solid rgba(0,229,200,0.2)",
                  boxShadow: "0 0 20px rgba(0,229,200,0.1)",
                }}
              >
                <Icon name="Cloud" className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="eyebrow text-teal">Mode 01</p>
                <h2 className="text-lg font-light text-fg">Drop</h2>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-fg-2">
              Files leave your device, enter the Vault, and a link materialises. Zero wait for the
              recipient — they extract from the cloud at any time. 10 GB free, or bring your own
              storage with any S3-compatible backend.
            </p>
            <div className="mt-auto space-y-2">
              {[
                { icon: "Globe", label: "Works async — no need to be online when they Extract" },
                { icon: "Lock", label: "Optional end-to-end encryption via link fragment" },
                { icon: "Clock", label: "Configurable expiry from 24 orbits to forever" },
              ].map((pt) => (
                <div key={pt.label} className="flex items-start gap-2">
                  <Icon name={pt.icon as "Globe"} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                  <span className="text-xs text-fg-3">{pt.label}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>

        {/* Beam card */}
        <motion.div variants={fadeUp}>
          <GlassPanel glow className="flex h-full flex-col gap-5 p-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,200,255,0.15), rgba(0,153,255,0.08))",
                  border: "1px solid rgba(0,200,255,0.2)",
                  boxShadow: "0 0 20px rgba(0,200,255,0.1)",
                }}
              >
                <Icon name="Radio" className="h-5 w-5 text-cyan" />
              </div>
              <div>
                <p className="eyebrow text-cyan">Mode 02</p>
                <h2 className="text-lg font-light text-fg">Beam</h2>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-fg-2">
              Your device becomes the signal tower. Data streams directly to whoever has the
              link — peer-to-peer over WebRTC. No cloud, no upload wait, end-to-end encrypted
              by the transport layer itself.
            </p>
            <div className="mt-auto space-y-2">
              {[
                { icon: "Zap", label: "Transmission begins the instant a Spark is established" },
                { icon: "Shield", label: "DTLS encryption on every peer connection" },
                { icon: "WifiOff", label: "Files never touch a server — pure peer-to-peer" },
              ].map((pt) => (
                <div key={pt.label} className="flex items-start gap-2">
                  <Icon name={pt.icon as "Zap"} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                  <span className="text-xs text-fg-3">{pt.label}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      </motion.div>

      {/* ── Vocabulary grid ─────────────────────────────────────────────── */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mb-14"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <p className="eyebrow mb-1 text-fg-3">Vocabulary</p>
          <h2 className="text-xl font-light text-fg">The language of Space Send</h2>
          <p className="mt-1 text-sm text-fg-3">Every term has a precise meaning. Learn it once.</p>
        </motion.div>

        <GlassPanel className="p-0 overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-white/[0.04] sm:grid-cols-2 sm:divide-y-0">
            {vocabEntries.map((entry, i) => (
              <motion.div
                key={entry.term}
                variants={fadeUp}
                className={cn(
                  "flex items-start gap-3 px-5 py-4",
                  i % 2 === 0 && "sm:border-r sm:border-white/[0.04]",
                  i < vocabEntries.length - 2 && "sm:border-b sm:border-white/[0.04]",
                  i === vocabEntries.length - 1 && "sm:border-t-0",
                )}
              >
                <div
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                  style={{
                    background: i % 3 === 0 ? "#00FF88" : i % 3 === 1 ? "#00C8FF" : "#0099FF",
                    boxShadow: `0 0 6px ${i % 3 === 0 ? "#00FF88" : i % 3 === 1 ? "#00C8FF" : "#0099FF"}`,
                  }}
                />
                <div className="min-w-0">
                  <span className="mono text-xs font-medium text-fg">{entry.term}</span>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-2">{entry.meaning}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </motion.section>

      {/* ── No accounts ─────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mb-14"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <p className="eyebrow mb-1 text-fg-3">Identity</p>
          <h2 className="text-xl font-light text-fg">No accounts. Ever.</h2>
          <p className="mt-1 text-sm text-fg-3">
            Your identity is your device. It lives in the Stash — never on our servers.
          </p>
        </motion.div>

        <GlassPanel className="p-6">
          <div className="space-y-4">
            {identityPoints.map((point, i) => (
              <motion.div key={i} variants={fadeUp} className="flex items-start gap-3">
                <div
                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
                  style={{
                    background: "rgba(0,200,255,0.1)",
                    border: "1px solid rgba(0,200,255,0.2)",
                    color: "#00C8FF",
                  }}
                >
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed text-fg-2">{point}</p>
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </motion.section>

      {/* ── BYOS callout ────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mb-14"
      >
        <GlassPanel strong className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-8">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,153,255,0.08))",
              border: "1px solid rgba(0,229,200,0.15)",
            }}
          >
            <Icon name="HardDrive" className="h-6 w-6 text-teal" />
          </div>
          <div className="flex-1">
            <p className="eyebrow mb-1 text-teal">Storage</p>
            <h3 className="text-base font-light text-fg">Bring your own storage</h3>
            <p className="mt-1 text-sm text-fg-2">
              Connect an R2, S3, Backblaze B2, Wasabi, DigitalOcean Spaces, or MinIO bucket.
              Your Drops go directly to your infrastructure — Space Send orchestrates, never stores.
            </p>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="flex flex-col items-center gap-3 border-t border-white/[0.06] pt-10 text-center"
      >
        <p className="text-sm text-fg-3">Space Send is built by Contles.</p>
        <ContlesMark align="center" />
      </motion.div>
    </Page>
  );
}
