"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Orb } from "@/components/brand/Orb";
import { Wordmark, MarkDot } from "@/components/brand/Wordmark";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useStash } from "@/store/stash";
import { isValidTag } from "@/lib/ids";
import { cn } from "@/lib/cn";

export function Onboarding() {
  const complete = useStash((s) => s.completeOnboarding);
  const importStash = useStash((s) => s.importStash);
  const [step, setStep] = useState(0);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const tagValid = isValidTag(tag);
  const canProceed = tagValid && name.trim().length > 0;

  const finish = async () => {
    setBusy(true);
    await complete({ tag, name: name.trim(), avatar });
    setBusy(false);
  };

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(f);
  };

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => importStash(reader.result as string);
    reader.readAsText(f);
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-[#04040a] px-6">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <div className="anim-float mb-8">
                <Orb size={120} state="waiting" />
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-semibold tracking-tight"
              >
                Welcome to <span className="gradient-text">Space Send</span>.
              </motion.h1>
              <p className="mt-3 text-sm text-fg-3">Transmit anything. Instantly.</p>
              <div className="mt-10 w-full space-y-3">
                <MagneticButton onClick={() => setStep(1)} className="w-full" pulse={false}>
                  Begin
                </MagneticButton>
                <Button variant="ghost" className="w-full" onClick={() => importRef.current?.click()}>
                  Restore from a Stash backup
                </Button>
                <input ref={importRef} type="file" accept="application/json" hidden onChange={onImport} />
              </div>
            </motion.div>
          )}

          {/* Step 1 — Callsign */}
          {step === 1 && (
            <motion.div
              key="callsign"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.32 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-6">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="relative transition-transform hover:scale-105"
                  aria-label="Upload avatar"
                >
                  <OrbAvatar seed={tag || "anon"} name={name} src={avatar} size={84} ring />
                  <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-[#0a0a14]">
                    <Icon name="Plus" className="h-3.5 w-3.5 text-fg-2" />
                  </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Choose your callsign.</h1>
              <p className="mt-2 text-sm text-fg-3">No password. No email. Just your mark.</p>

              <div className="mt-7 w-full space-y-3 text-left">
                <div>
                  <label className="eyebrow mb-2 block">Display name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Augustas"
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-[#00c8ff]/40"
                  />
                </div>
                <div>
                  <label className="eyebrow mb-2 block">Your Tag</label>
                  <div
                    className={cn(
                      "flex h-12 items-center rounded-xl border bg-white/[0.03] px-4 transition-colors",
                      tag.length === 0
                        ? "border-white/10"
                        : tagValid
                          ? "border-[#00ff88]/40"
                          : "border-[#ff4d6a]/40",
                    )}
                  >
                    <span className="mono text-fg-3">@</span>
                    <input
                      value={tag}
                      onChange={(e) => setTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="augustas"
                      maxLength={20}
                      className="mono ml-0.5 h-full flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
                    />
                    {tag.length > 0 && (
                      <Icon
                        name={tagValid ? "Check" : "X"}
                        className={cn("h-4 w-4", tagValid ? "text-[#00ff88]" : "text-[#ff8a9c]")}
                      />
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-fg-3">3–20 chars · lowercase, numbers, underscore</p>
                </div>
              </div>

              <div className="mt-8 flex w-full gap-2">
                <Button variant="ghost" onClick={() => setStep(0)} icon="ArrowLeft">
                  Back
                </Button>
                <MagneticButton
                  onClick={() => setStep(2)}
                  disabled={!canProceed}
                  className="flex-1"
                  size="md"
                  pulse={false}
                >
                  Continue
                </MagneticButton>
              </div>
            </motion.div>
          )}

          {/* Step 2 — How it works */}
          {step === 2 && (
            <motion.div
              key="how"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.32 }}
              className="flex flex-col items-center text-center"
            >
              <h1 className="text-2xl font-semibold tracking-tight">How it works.</h1>
              <HowDiagram />
              <div className="mt-8 flex w-full gap-2">
                <Button variant="ghost" onClick={() => setStep(1)} icon="ArrowLeft">
                  Back
                </Button>
                <MagneticButton onClick={() => setStep(3)} className="flex-1" size="md" pulse={false}>
                  Got it
                </MagneticButton>
              </div>
            </motion.div>
          )}

          {/* Step 3 — Cleared for launch */}
          {step === 3 && (
            <motion.div
              key="launch"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <div className="anim-float mb-8">
                <Orb size={112} state="active" intensity={0.8} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">You&apos;re cleared for launch.</h1>
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-fg-2">
                <MarkDot size={14} /> Welcome aboard, <span className="mono text-fg">@{tag}</span>
              </p>
              <div className="mt-10 w-full">
                <MagneticButton onClick={finish} loading={busy} className="w-full" icon="Rocket">
                  Enter Space Send
                </MagneticButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step dots */}
        <div className="mt-10 flex items-center justify-center gap-2">
          {[0, 1, 2, 3].map((s) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                s === step ? "w-6 bg-[#00c8ff]" : "w-1.5 bg-white/15",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HowDiagram() {
  return (
    <div className="relative mt-8 h-44 w-full">
      {/* Sender device */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
          <Icon name="HardDrive" className="h-5 w-5 text-fg-2" />
        </div>
        <p className="mt-1.5 text-[10px] text-fg-3">You</p>
      </div>

      {/* Orb at center */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ y: [-4, 4, -4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Orb size={48} state="waiting" />
      </motion.div>

      {/* Drop path → cloud */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 176" fill="none" preserveAspectRatio="none">
        <motion.path
          d="M64 88 Q 160 20 256 44"
          stroke="url(#dropg)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        />
        <motion.path
          d="M64 88 Q 160 156 256 132"
          stroke="url(#beamg)"
          strokeWidth="1.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        />
        <defs>
          <linearGradient id="dropg" x1="0" y1="0" x2="320" y2="0">
            <stop stopColor="#00ff88" />
            <stop offset="1" stopColor="#00c8ff" />
          </linearGradient>
          <linearGradient id="beamg" x1="0" y1="0" x2="320" y2="0">
            <stop stopColor="#00e5c8" />
            <stop offset="1" stopColor="#0099ff" />
          </linearGradient>
        </defs>
      </svg>

      {/* Cloud (Drop) */}
      <motion.div
        className="absolute right-2 top-3 text-right"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9 }}
      >
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#00ff88]/20 bg-[#00ff88]/[0.06]">
          <Icon name="Cloud" className="h-5 w-5 text-[#00e5c8]" />
        </div>
        <p className="mt-1.5 text-[10px] text-fg-3">Drop</p>
      </motion.div>

      {/* Device (Beam) */}
      <motion.div
        className="absolute bottom-1 right-2 text-right"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1 }}
      >
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#0099ff]/20 bg-[#0099ff]/[0.06]">
          <Icon name="Radio" className="h-5 w-5 text-[#00c8ff]" />
        </div>
        <p className="mt-1.5 text-[10px] text-fg-3">Beam</p>
      </motion.div>
    </div>
  );
}
