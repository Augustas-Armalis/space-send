"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { FileCard } from "@/components/ui/FileCard";
import { Segmented } from "@/components/ui/Segmented";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Orb } from "@/components/brand/Orb";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { COPY, EXPIRY_OPTIONS, FREE_PER_FILE_BYTES } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import type { useSend } from "./useSend";

type Controller = ReturnType<typeof useSend>;

export function SendComposer({ s }: { s: Controller }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCount = useRef(0);
  const [showMessage, setShowMessage] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) s.addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) s.addFiles(e.dataTransfer.files);
  };

  const hasFiles = s.files.length > 0;

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        dragCount.current++;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragCount.current--;
        if (dragCount.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
      className="relative"
    >
      {/* Drag glow border */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute -inset-2 z-20 rounded-[28px]"
            style={{
              background: "linear-gradient(135deg,rgba(0,255,136,0.12),rgba(0,200,255,0.12))",
              border: "1px solid rgba(0,229,200,0.4)",
              boxShadow: "0 0 60px -10px rgba(0,229,200,0.4) inset",
            }}
          >
            <div className="grid h-full place-items-center">
              <p className="text-lg font-medium text-fg">
                {s.mode === "beam" ? COPY.releaseBeam : COPY.releaseDrop}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("transition-opacity", dragging && "opacity-30")}>
        {/* Heading */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-tight text-fg">Send files</h1>
          {hasFiles && (
            <span className="mono text-xs text-fg-3">
              {s.files.length} · {formatBytes(s.totalSize)}
            </span>
          )}
        </div>

        {/* Drop zone / file list */}
        {!hasFiles ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="group relative grid w-full place-items-center gap-4 rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-6 py-14 text-center transition-colors hover:border-[#00c8ff]/30 hover:bg-white/[0.03]"
          >
            <div className="anim-breathe">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-fg-2 transition-colors group-hover:text-[#00e5c8]">
                <Icon name="Plus" className="h-6 w-6" />
              </span>
            </div>
            <div>
              <p className="text-lg font-medium text-fg">{COPY.dropZoneEmpty}</p>
              <p className="mt-1 text-sm text-fg-3">{COPY.dropZoneSub(formatBytes(FREE_PER_FILE_BYTES, 0))}</p>
            </div>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1 scrollbar-none">
              <AnimatePresence initial={false}>
                {s.files.map((f) => (
                  <FileCard
                    key={f.meta.id}
                    name={f.meta.name}
                    size={f.meta.size}
                    mime={f.meta.mime}
                    preview={f.preview}
                    onRemove={() => s.removeFile(f.meta.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2.5 text-sm text-fg-3 transition-colors hover:border-white/20 hover:text-fg-2"
            >
              <Icon name="Plus" className="h-4 w-4" /> Add more
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" multiple hidden onChange={onPick} />

        {/* Mode toggle */}
        <div className="mt-5">
          <Segmented
            options={[
              { id: "drop", label: COPY.modeDrop, icon: "Cloud" },
              { id: "beam", label: COPY.modeBeam, icon: "Radio" },
            ]}
            value={s.mode}
            onChange={(v) => s.setMode(v)}
            layoutId="send-mode"
          />
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-fg-3">{COPY.modeTooltip}</p>
        </div>

        {/* Message */}
        <div className="mt-3">
          {!showMessage ? (
            <button
              onClick={() => setShowMessage(true)}
              className="flex items-center gap-2 px-1 text-[13px] text-fg-3 transition-colors hover:text-fg-2"
            >
              <Icon name="Plus" className="h-3.5 w-3.5" /> Add a transmission note
            </button>
          ) : (
            <motion.textarea
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              autoFocus
              value={s.message}
              onChange={(e) => s.setMessage(e.target.value)}
              placeholder={COPY.messagePlaceholder}
              rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-[#00c8ff]/40"
            />
          )}
        </div>

        {/* Expiry (Drop only) */}
        <AnimatePresence>
          {s.mode === "drop" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <p className="eyebrow mb-2">{COPY.expiryLabel}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => s.setExpiry(opt.id)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-xl border py-2 text-center transition-colors",
                      s.expiry === opt.id
                        ? "border-[#00c8ff]/40 bg-[#00c8ff]/[0.08] text-fg"
                        : "border-white/8 bg-white/[0.02] text-fg-3 hover:text-fg-2",
                    )}
                  >
                    <span className="text-[12px] font-medium leading-tight">{opt.label}</span>
                    <span className="mono text-[9px] text-fg-3">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Link options */}
        <div className="mt-4">
          <button
            onClick={() => setShowOptions((v) => !v)}
            className="flex w-full items-center justify-between px-1 text-[13px] text-fg-3 transition-colors hover:text-fg-2"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="Shield" className="h-3.5 w-3.5" /> Link options
            </span>
            <Icon name="ChevronDown" className={cn("h-4 w-4 transition-transform", showOptions && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-3 overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-3.5"
              >
                <OptionToggle
                  label="Encrypt end-to-end"
                  desc="Files encrypted in your browser. We can't read them."
                  checked={!!s.options.encrypted}
                  onChange={(v) => s.setOptions({ ...s.options, encrypted: v })}
                />
                <OptionToggle
                  label="Burn after extract"
                  desc="Link dies after the first successful pickup."
                  checked={!!s.options.burnAfter}
                  onChange={(v) => s.setOptions({ ...s.options, burnAfter: v })}
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-fg">Access code</p>
                    <p className="text-[11px] text-fg-3">Recipient must enter it to extract.</p>
                  </div>
                  <input
                    type="text"
                    placeholder="optional"
                    onChange={(e) =>
                      s.setOptions({ ...s.options, password: e.target.value ? { salt: "", hash: e.target.value } : null })
                    }
                    className="mono h-9 w-28 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-fg outline-none focus:border-[#00c8ff]/40"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div className="mt-6">
          <MagneticButton onClick={s.submit} disabled={!hasFiles} className="w-full" icon="Rocket">
            {COPY.ctaGetLink}
          </MagneticButton>
          {hasFiles && (
            <p className="mono mt-2.5 text-center text-[11px] text-fg-3">
              {s.mode === "beam" ? "Transmits live from this device" : "Orbits in the cloud until extracted"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionToggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="text-[11px] text-fg-3">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "border-transparent bg-[#00c8ff]/80" : "border-white/10 bg-white/[0.06]",
        )}
        role="switch"
        aria-checked={checked}
      >
        <motion.span
          className="absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white"
          style={{ width: 18, height: 18 }}
          animate={{ left: checked ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      </button>
    </div>
  );
}

/* The "working" interstitial — files collapse into a pulsing Orb. */
export function SendWorking({ s }: { s: Controller }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
      <motion.div layoutId="send-orb">
        <Orb size={120} state="active" intensity={0.7} />
      </motion.div>
      <div>
        <p className="text-lg font-medium text-fg">{s.working.label || "Working"}</p>
        <p className="mono mt-1 text-sm text-fg-3">
          <AnimatedNumber value={Math.round(s.working.progress * 100)} format={(n) => `${n}`} />% ·{" "}
          {s.mode === "beam" ? "staging" : "dropping"}
        </p>
      </div>
    </div>
  );
}
