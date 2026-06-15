"use client";

import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Icon } from "@/components/ui/Icon";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { cn } from "@/lib/cn";

/* ── animation presets ────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/* ── section data ─────────────────────────────────────────────────────── */
interface PrivacySection {
  id: string;
  icon: string;
  eyebrow: string;
  title: string;
  accent: string;
  paragraphs: string[];
  bullets?: string[];
}

const sections: PrivacySection[] = [
  {
    id: "no-accounts",
    icon: "User",
    eyebrow: "Identity",
    title: "No accounts",
    accent: "#00FF88",
    paragraphs: [
      "Space Send has no user accounts, no sign-up flow, and no authentication server. Your identity is a cryptographic key pair generated on your device at first launch. It lives in local storage under the name Stash.",
      "We receive no name, email address, phone number, or any personal identifier. We cannot correlate your transfers to you as a person. There is nothing to delete because there is nothing stored.",
    ],
  },
  {
    id: "beam-p2p",
    icon: "Radio",
    eyebrow: "Beam transfers",
    title: "Live Beams are pure peer-to-peer",
    accent: "#00E5C8",
    paragraphs: [
      "When you initiate a Beam, your browser establishes a WebRTC data channel directly to the recipient's browser. The file bytes travel that path alone — they never pass through a Space Send server.",
      "The connection is protected by DTLS (Datagram Transport Layer Security), the same encryption standard used in enterprise VoIP. Our signalling servers coordinate the initial handshake and then step aside entirely. We have no visibility into what is transmitted or received.",
    ],
    bullets: [
      "No file bytes touch Space Send infrastructure",
      "DTLS encryption on every peer connection, mandatory",
      "Signalling servers see only connection identifiers, never payload",
      "If both peers are on the same network, traffic stays local",
    ],
  },
  {
    id: "drop-minimum",
    icon: "Cloud",
    eyebrow: "Drop transfers",
    title: "Cloud Drops store the minimum",
    accent: "#00C8FF",
    paragraphs: [
      "When you choose Drop, files are uploaded to either Space Send's managed storage or your own backend (BYOS). We record only what is necessary to serve the file and enforce the expiry you chose.",
    ],
    bullets: [
      "Filename, file size, MIME type — to display the transfer card",
      "A device identifier derived from your Stash — not linkable to a person",
      "Expiry timestamp and download count — to enforce the rules you set",
      "No IP address logs beyond transient abuse protection (not retained)",
      "No user-agent string stored",
      "No browser fingerprinting of any kind",
    ],
  },
  {
    id: "e2e",
    icon: "Lock",
    eyebrow: "Encryption",
    title: "End-to-end encryption",
    accent: "#0099FF",
    paragraphs: [
      "Drop transfers support optional end-to-end encryption. When enabled, the file is encrypted in the browser before upload using AES-GCM. The decryption key is placed in the URL fragment — the hash — which browsers never send to servers.",
      "We receive only the ciphertext. We cannot read your files, cannot hand them to third parties in readable form, and cannot comply with a request to decrypt them because we do not hold the key.",
    ],
    bullets: [
      "AES-256-GCM encryption, performed locally before upload",
      "Key lives in the #fragment — never transmitted to any server",
      "Recipient's browser decrypts locally on Extract",
      "We are technically incapable of reading encrypted files",
    ],
  },
  {
    id: "no-inspection",
    icon: "EyeOff",
    eyebrow: "Content policy",
    title: "Files are never inspected",
    accent: "#00E5C8",
    paragraphs: [
      "We do not scan, index, classify, or otherwise inspect the content of files stored on Space Send infrastructure. There is no machine-learning pipeline processing your transfers. No human reviews file content in the ordinary course of operations.",
      "We reserve the right to act on credible reports of illegal material — this is a legal requirement — but this is reactive, not proactive. We do not know what your files contain unless reported.",
    ],
  },
  {
    id: "hash",
    icon: "Shield",
    eyebrow: "Integrity",
    title: "Hash verification",
    accent: "#00FF88",
    paragraphs: [
      "Every file in a Drop is hashed with SHA-256 before upload and the hash is stored alongside the metadata. When a recipient Extracts a file, their browser recomputes the hash and compares it to the stored value.",
      "A mismatch halts the Extract and displays a verification failure. This protects against data corruption in transit and storage tampering. The verification result is shown in the recipient's interface — they always know whether the file arrived intact.",
    ],
  },
];

/* ── component ────────────────────────────────────────────────────────── */
export default function PrivacyPage() {
  return (
    <Page>
      <PageHeader
        title="Privacy"
        sub="Zero-knowledge by design."
        icon={<Icon name="Shield" className="h-5 w-5 text-fg-3" />}
      />

      {/* ── Intro ──────────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mb-12"
      >
        <GlassPanel strong className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,153,255,0.08))",
                border: "1px solid rgba(0,229,200,0.15)",
                boxShadow: "0 0 24px rgba(0,229,200,0.08)",
              }}
            >
              <Icon name="KeyRound" className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="eyebrow mb-2 text-teal">Our position</p>
              <p className="text-sm leading-relaxed text-fg-2">
                Privacy is not a feature we added. It is the architecture. The system is designed
                so that we are technically incapable of reading most of what passes through it.
                What we cannot see, we cannot leak, sell, or be compelled to hand over.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fg-2">
                The sections below describe exactly what data exists, where it lives, and why.
                If something is unclear, the answer is: less than you think.
              </p>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Sections ───────────────────────────────────────────────────── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        {sections.map((section) => (
          <motion.div key={section.id} variants={fadeUp}>
            <GlassPanel className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
                {/* Icon column */}
                <div className="shrink-0">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: `${section.accent}12`,
                      border: `1px solid ${section.accent}28`,
                    }}
                  >
                    <Icon
                      name={section.icon as "Shield"}
                      className="h-4 w-4"
                      style={{ color: section.accent } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Content column */}
                <div className="flex-1 min-w-0">
                  <p
                    className="eyebrow mb-1"
                    style={{ color: section.accent }}
                  >
                    {section.eyebrow}
                  </p>
                  <h2 className="mb-4 text-base font-light text-fg">{section.title}</h2>

                  <div className="space-y-3">
                    {section.paragraphs.map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed text-fg-2">
                        {para}
                      </p>
                    ))}
                  </div>

                  {section.bullets && (
                    <ul className="mt-5 space-y-2">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5">
                          <div
                            className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                            style={{
                              background: section.accent,
                              boxShadow: `0 0 5px ${section.accent}`,
                            }}
                          />
                          <span className="text-xs leading-relaxed text-fg-3">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Third parties ───────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-5"
      >
        <GlassPanel className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
            <div className="shrink-0">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(160,160,160,0.07)",
                  border: "1px solid rgba(160,160,160,0.14)",
                }}
              >
                <Icon name="Globe" className="h-4 w-4 text-fg-3" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="eyebrow mb-1 text-fg-3">Third parties</p>
              <h2 className="mb-4 text-base font-light text-fg">What we do not share</h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-fg-2">
                  We do not sell data. We do not share data with advertisers. We do not use
                  third-party analytics SDKs that phone home with user behaviour. We do not
                  embed social tracking pixels.
                </p>
                <p className="text-sm leading-relaxed text-fg-2">
                  If you choose to use BYOS, your files go directly to your storage provider
                  under your credentials. Space Send acts as the coordinator, not the custodian.
                  Your provider's privacy policy governs that storage.
                </p>
                <p className="text-sm leading-relaxed text-fg-2">
                  We use WebRTC infrastructure (STUN/TURN servers) to assist Beam connections.
                  These servers see IP addresses transiently during handshake and nothing else.
                  They are not used for tracking.
                </p>
              </div>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Closing ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="mt-14 flex flex-col items-center gap-4 border-t border-white/[0.06] pt-10 text-center"
      >
        <div
          className="h-px w-24 rounded-full"
          style={{
            background: "linear-gradient(90deg, transparent, #00C8FF44, transparent)",
          }}
        />
        <p className="max-w-sm text-sm text-fg-3">
          Questions about how data is handled can be directed to the team via the Space Send
          support channel. We will answer plainly.
        </p>
        <p className="text-xs text-fg-3">Space Send is built by Contles.</p>
        <ContlesMark align="center" />
      </motion.div>
    </Page>
  );
}
