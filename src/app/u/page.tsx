"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Wordmark } from "@/components/brand/Wordmark";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { Orb } from "@/components/brand/Orb";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileCard, type FileCardState } from "@/components/ui/FileCard";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { useTransfers } from "@/store/transfers";
import { useStash } from "@/store/stash";
import { useUI } from "@/store/ui";
import { uploadFile } from "@/transfer/drop";
import { shortId } from "@/lib/ids";
import { formatBytes, formatCountdown } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { FileMeta } from "@/transfer/types";

type Phase = "collecting" | "sending" | "delivered";

interface Picked {
  file: File;
  meta: FileMeta;
  progress: number;
  state: FileCardState;
}

/* Standalone, branded by the requester. The submitter has no account. */
function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Soft radial glow, upper third — always green→blue. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(0,229,200,0.12), rgba(0,153,255,0.07) 45%, transparent 72%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-center px-4 py-5">
        <Wordmark href="/" size="sm" />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:pt-8">{children}</main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AskUploadInner />
    </Suspense>
  );
}

function AskUploadInner() {
  const id = useSearchParams().get("a") ?? "";

  const hydrated = useTransfers((s) => s.hydrated);
  const asks = useTransfers((s) => s.asks);
  const setAurora = useUI((s) => s.setAurora);
  const fireComplete = useUI((s) => s.fireComplete);

  // Requester identity (the Vault owner on this device).
  const reqName = useStash((s) => s.name);
  const reqAvatar = useStash((s) => s.avatar);
  const reqTag = useStash((s) => s.tag);

  const ask = useMemo(() => asks.find((a) => a.id === id), [asks, id]);

  const [phase, setPhase] = useState<Phase>("collecting");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!hydrated) {
    return (
      <PublicFrame>
        <div className="grid min-h-[50vh] place-items-center text-fg-3">
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin" />
        </div>
      </PublicFrame>
    );
  }

  if (!ask) {
    return (
      <PublicFrame>
        <div className="grid min-h-[55vh] place-items-center">
          <EmptyState title="Nothing here." sub="This Ask link does not match any open request." orbSize={96} />
        </div>
        <div className="flex justify-center pt-2">
          <ContlesMark />
        </div>
      </PublicFrame>
    );
  }

  const requesterName = reqName?.trim() || "Someone";
  const cap = ask.perSubmitterCapBytes;
  const expired = ask.expiresAt !== null && ask.expiresAt <= now;
  const totalPicked = picked.reduce((acc, p) => acc + p.file.size, 0);
  const overCap = totalPicked > cap;

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming: Picked[] = Array.from(list).map((file) => ({
      file,
      meta: {
        id: shortId(),
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
      },
      progress: 0,
      state: "staged" as FileCardState,
    }));
    setPicked((prev) => [...prev, ...incoming]);
  };

  const removeAt = (metaId: string) => setPicked((prev) => prev.filter((p) => p.meta.id !== metaId));

  const patch = (metaId: string, p: Partial<Picked>) =>
    setPicked((prev) => prev.map((x) => (x.meta.id === metaId ? { ...x, ...p } : x)));

  const send = async () => {
    if (picked.length === 0) return;
    if (overCap) {
      toast.error("Over the limit", `Keep this upload under ${formatBytes(cap)}.`);
      return;
    }
    setPhase("sending");
    setAurora(true, 0.6);

    const dropId = shortId();
    const metas: FileMeta[] = [];

    for (const p of picked) {
      patch(p.meta.id, { state: "uploading", progress: 0 });
      try {
        await uploadFile(dropId, p.meta, p.file, (prog) => {
          patch(p.meta.id, {
            state: "uploading",
            progress: prog.total > 0 ? prog.loaded / prog.total : 0,
          });
        });
        patch(p.meta.id, { state: "complete", progress: 1 });
        metas.push(p.meta);
      } catch {
        patch(p.meta.id, { state: "failed" });
      }
    }

    const totalSize = metas.reduce((acc, m) => acc + m.size, 0);

    useTransfers.getState().addDrop({
      id: dropId,
      kind: "drop",
      files: metas,
      message: `via Ask: ${ask.title}`,
      createdAt: Date.now(),
      expiresAt: null,
      downloads: 0,
      totalSize,
      backend: "managed",
      options: {},
      sender: { name: "Anonymous" },
      localAvailable: true,
    });

    useTransfers.getState().addTrail({
      id: shortId(),
      type: "ask",
      direction: "in",
      label: `${metas.length} files`,
      size: totalSize,
      count: metas.length,
      ts: Date.now(),
      status: "complete",
      refId: dropId,
    });

    setAurora(false);
    fireComplete();
    setPhase("delivered");
  };

  /* ── Delivered ─────────────────────────────────────────────────────── */
  if (phase === "delivered") {
    return (
      <PublicFrame>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="flex flex-col items-center pt-6 text-center"
        >
          <div className="mb-6">
            <Orb size={104} state="complete" intensity={0.85} />
          </div>
          <h1 className="text-balance text-2xl font-light tracking-tight sm:text-3xl">Files delivered.</h1>
          <p className="mt-2 max-w-sm text-balance text-sm leading-relaxed text-fg-2">
            {requesterName} will find them in their Vault.
          </p>
          <p className="mono mt-4 inline-flex items-center gap-1.5 text-[11px] text-[#00c8ff]">
            <Icon name="Check" className="h-3 w-3" /> Transmission verified
          </p>

          <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-2">
            <Button
              variant="glass"
              className="w-full"
              icon="Plus"
              onClick={() => {
                setPicked([]);
                setPhase("collecting");
              }}
            >
              Send more files
            </Button>
          </div>

          <div className="mt-12 flex justify-center border-t border-white/5 pt-6">
            <ContlesMark />
          </div>
        </motion.div>
      </PublicFrame>
    );
  }

  /* ── Collecting / Sending ──────────────────────────────────────────── */
  const sending = phase === "sending";

  return (
    <PublicFrame>
      {/* Hero — the requester */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center"
      >
        <div className="mb-5">
          <OrbAvatar seed={reqTag || ask.id} name={requesterName} src={reqAvatar} size={64} ring />
        </div>
        <p className="text-sm text-fg-2">
          <span className="text-fg">{requesterName}</span> is asking for files
        </p>
        <h1 className="mt-2 text-balance text-2xl font-light tracking-tight sm:text-4xl">{ask.title}</h1>

        {ask.message && (
          <div className="glass mt-5 max-w-md rounded-2xl border-l-2 border-l-[#00c8ff]/50 px-4 py-3 text-left">
            <p className="text-[13px] leading-relaxed text-fg-2">{ask.message}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          <span className="mono inline-flex items-center gap-1.5 text-[11px] text-fg-3">
            <Icon name="HardDrive" className="h-3 w-3" /> Up to {formatBytes(cap)} per upload
          </span>
          {ask.expiresAt !== null && !expired && (
            <span className="mono inline-flex items-center gap-1.5 text-[11px] text-[#FFB020]">
              <Icon name="Clock" className="h-3 w-3" /> Closes in {formatCountdown(ask.expiresAt - now)}
            </span>
          )}
        </div>
      </motion.div>

      {expired ? (
        <div className="mt-10 grid place-items-center">
          <EmptyState
            title="This Ask has closed."
            sub={`${requesterName} is no longer accepting files here.`}
            orbSize={88}
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9"
        >
          {/* Upload zone */}
          <button
            type="button"
            disabled={sending}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!sending) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!sending) addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "group relative flex w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed px-6 py-12 text-center transition-all",
              dragging
                ? "border-[#00c8ff]/60 bg-[#00c8ff]/[0.06]"
                : "border-white/12 bg-white/[0.02] hover:border-[#00c8ff]/30 hover:bg-white/[0.03]",
              sending && "pointer-events-none opacity-50",
            )}
          >
            <span
              className={cn(
                "grid h-14 w-14 place-items-center rounded-2xl border transition-colors",
                dragging
                  ? "border-[#00c8ff]/50 bg-[#00c8ff]/10 text-[#00c8ff]"
                  : "border-white/10 bg-white/[0.03] text-fg-2 group-hover:text-[#00c8ff]",
              )}
            >
              <Icon name="Plus" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[15px] font-medium text-fg">Drop files into the void</p>
              <p className="mono mt-1 text-[11px] text-fg-3">Up to {formatBytes(cap)} per upload</p>
            </div>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Picked files */}
          <AnimatePresence initial={false}>
            {picked.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5"
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="eyebrow">
                    {picked.length} {picked.length === 1 ? "file" : "files"} staged
                  </p>
                  <p className={cn("mono text-[11px]", overCap ? "text-[#ff8a9c]" : "text-fg-3")}>
                    {formatBytes(totalPicked)} / {formatBytes(cap)}
                  </p>
                </div>

                <div className="space-y-2">
                  {picked.map((p) => (
                    <motion.div
                      key={p.meta.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                    >
                      <FileCard
                        name={p.meta.name}
                        size={p.meta.size}
                        mime={p.meta.mime}
                        progress={p.progress}
                        state={p.state}
                        onRemove={sending ? undefined : () => removeAt(p.meta.id)}
                      />
                    </motion.div>
                  ))}
                </div>

                {overCap && (
                  <p className="mono mt-3 inline-flex items-center gap-1.5 px-1 text-[11px] text-[#ff8a9c]">
                    <Icon name="AlertTriangle" className="h-3 w-3" /> Over the {formatBytes(cap)} limit — remove a file.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Send CTA */}
          <AnimatePresence>
            {picked.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="sticky bottom-4 z-20 mt-8 flex justify-center"
              >
                <MagneticButton
                  onClick={send}
                  loading={sending}
                  disabled={sending || overCap}
                  icon="Upload"
                  className="w-full max-w-md shadow-[0_12px_48px_-12px_rgba(0,200,255,0.5)]"
                >
                  {sending ? "Delivering…" : `Send ${picked.length === 1 ? "file" : "files"} to ${requesterName}`}
                </MagneticButton>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/5 pt-6 text-center">
        <p className="mono inline-flex items-center gap-1.5 text-[11px] text-fg-3">
          <Icon name="Shield" className="h-3 w-3" /> Files go straight to {requesterName}&apos;s Vault
        </p>
        <ContlesMark />
      </div>
    </PublicFrame>
  );
}
