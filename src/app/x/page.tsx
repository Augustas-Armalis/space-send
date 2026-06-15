"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  RecipientFrame,
  SenderHero,
  ExtractCTA,
  RecipientFooter,
  Handshake,
  CompleteState,
} from "@/components/recipient/RecipientUI";
import { FileCard, type FileCardState } from "@/components/ui/FileCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SignalBars } from "@/components/ui/SignalBars";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { BeamReceiver } from "@/transfer/beam";
import { HAS_CLOUD_SIGNALING } from "@/transfer/signaling";
import type { BeamManifest } from "@/transfer/types";
import { shortId } from "@/lib/ids";
import { useUI } from "@/store/ui";
import { downloadBlob } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import { COPY } from "@/lib/constants";

type Status = "connecting" | "ready" | "extracting" | "complete" | "offline" | "severed";
interface FState {
  progress: number;
  state: FileCardState;
  speed?: number;
  verified?: boolean;
}

function intensity(bps: number) {
  return bps <= 0 ? 0 : Math.min(1, Math.log10(bps / 50_000 + 1) / 3);
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BeamRecipientInner />
    </Suspense>
  );
}

function BeamRecipientInner() {
  const id = useSearchParams().get("b") ?? "";
  const setAurora = useUI((s) => s.setAurora);
  const fireComplete = useUI((s) => s.fireComplete);

  const [status, setStatus] = useState<Status>("connecting");
  const [manifest, setManifest] = useState<BeamManifest | null>(null);
  const [fstates, setFstates] = useState<Record<string, FState>>({});
  const [signal, setSignal] = useState(4);
  const [severedAt, setSeveredAt] = useState(0);
  const [aggSpeed, setAggSpeed] = useState(0);

  const receiverRef = useRef<BeamReceiver | null>(null);
  const blobsRef = useRef<Record<string, Blob>>({});
  const selfId = useRef(shortId());
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const recv = new BeamReceiver(id, selfId.current, {
      onManifest: (m) => {
        setManifest(m);
        setFstates(Object.fromEntries(m.files.map((f) => [f.id, { progress: 0, state: "queued" as FileCardState }])));
        setStatus("ready");
      },
      onFileProgress: (fid, received, total, speed) => {
        setFstates((prev) => ({ ...prev, [fid]: { ...prev[fid], progress: received / total, state: "extracting", speed } }));
        setAggSpeed(speed);
        setAurora(true, intensity(speed));
      },
      onFileComplete: (fid, blob, verified) => {
        blobsRef.current[fid] = blob;
        const name = manifestNameRef.current[fid] ?? "file";
        setFstates((prev) => ({ ...prev, [fid]: { ...prev[fid], progress: 1, state: "complete", verified } }));
        downloadBlob(blob, name);
      },
      onAllComplete: () => {
        setAurora(false);
        fireComplete();
        setStatus("complete");
      },
      onSignal: (bars) => setSignal(bars),
      onError: () => setStatus((s) => (s === "complete" ? s : "offline")),
      onSevered: (frac) => {
        setSeveredAt(Math.round(frac * 100));
        setStatus("severed");
        setAurora(false);
      },
    });
    receiverRef.current = recv;

    // Host-offline detection: no manifest within 12s → Signal lost.
    const t = setTimeout(() => {
      setStatus((s) => (s === "connecting" ? "offline" : s));
    }, 12000);

    return () => {
      clearTimeout(t);
      recv.close();
      setAurora(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keep a name lookup for downloads inside callbacks.
  const manifestNameRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (manifest) manifestNameRef.current = Object.fromEntries(manifest.files.map((f) => [f.id, f.name]));
  }, [manifest]);

  const startExtract = () => {
    if (!manifest) return;
    setStatus("extracting");
    setAurora(true, 0.4);
    setFstates((prev) => {
      const next = { ...prev };
      manifest.files.forEach((f) => (next[f.id] = { ...next[f.id], state: "queued" }));
      return next;
    });
    receiverRef.current?.startExtract(manifest.files.map((f) => f.id));
  };

  const saveAll = () => {
    if (!manifest) return;
    manifest.files.forEach((f) => {
      const b = blobsRef.current[f.id];
      if (b) downloadBlob(b, f.name);
    });
  };

  /* ---- Error states ---- */
  if (status === "offline") {
    // Distinguish "no signaling worker configured" from "host actually offline".
    // Without HAS_CLOUD_SIGNALING the recipient can only reach a sender in the
    // same browser via BroadcastChannel, so an open-from-another-device fails
    // here every time — and that's a config issue, not the sender's fault.
    const title = HAS_CLOUD_SIGNALING ? COPY.hostOfflineTitle : "Cross-device Beam not configured";
    const sub = HAS_CLOUD_SIGNALING
      ? COPY.hostOfflineSub
      : "This site was built without a NEXT_PUBLIC_SIGNAL_URL, so Beams only reach tabs in the same browser. Use Drop for cross-device transfers, or set the secret and redeploy.";
    return (
      <RecipientFrame>
        <div className="grid min-h-[55vh] place-items-center">
          <EmptyState title={title} sub={sub} />
        </div>
        <div className="flex justify-center">
          <ContlesMark />
        </div>
      </RecipientFrame>
    );
  }
  if (status === "severed") {
    return (
      <RecipientFrame>
        <div className="grid min-h-[55vh] place-items-center">
          <EmptyState
            title={COPY.severed(severedAt)}
            sub="The connection to the sender dropped mid-stream."
            action={
              <Button variant="primary" icon="RefreshCw" onClick={() => window.location.reload()}>
                {COPY.resumeExtraction}
              </Button>
            }
          />
        </div>
      </RecipientFrame>
    );
  }
  if (status === "connecting") {
    return (
      <RecipientFrame active intensity={0.2}>
        <Handshake label={COPY.establishingSignal} />
        <div className="mt-10 flex justify-center">
          <ContlesMark />
        </div>
      </RecipientFrame>
    );
  }

  const totalSize = manifest?.totalSize ?? 0;
  const senderName = manifest?.senderName || "Someone";

  return (
    <RecipientFrame active={status === "extracting"} intensity={intensity(aggSpeed)}>
      <AnimatePresence mode="wait">
        {status === "complete" ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CompleteState />
            <div className="mt-6 flex justify-center">
              <Button variant="glass" icon="Download" onClick={saveAll}>
                {COPY.saveToDevice}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="files" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SenderHero
              name={senderName}
              seed={manifest?.senderTag || id}
              count={manifest?.files.length ?? 0}
              message={manifest?.message}
              beam
              online
            />

            <div className="mx-auto mt-6 flex max-w-md items-center justify-between px-1">
              <p className="eyebrow">
                {status === "extracting" ? COPY.signalLocked : "Signal locked. Ready."}
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-3">
                Signal <SignalBars level={signal} />
              </span>
            </div>

            <div className="mx-auto mt-3 max-w-md space-y-2">
              {manifest?.files.map((f) => {
                const st = fstates[f.id] ?? { progress: 0, state: "queued" as FileCardState };
                return (
                  <FileCard
                    key={f.id}
                    name={f.name}
                    size={f.size}
                    mime={f.mime}
                    progress={st.progress}
                    state={st.state}
                    speed={st.speed}
                    verified={st.verified}
                  />
                );
              })}
              <p className="mono px-1 pt-1 text-[11px] text-fg-3">{formatBytes(totalSize)} total · peer-to-peer · DTLS encrypted</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status === "ready" && <ExtractCTA label={COPY.extract} onClick={startExtract} />}

      <RecipientFooter verified={status === "complete"} />
    </RecipientFrame>
  );
}
