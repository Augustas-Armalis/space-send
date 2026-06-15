"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  RecipientFrame,
  SenderHero,
  ExtractCTA,
  RecipientFooter,
  RecipientError,
  CompleteState,
} from "@/components/recipient/RecipientUI";
import { FileCard, type FileCardState } from "@/components/ui/FileCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useTransfers } from "@/store/transfers";
import { useUI } from "@/store/ui";
import { getDropFile, fetchManifest } from "@/transfer/drop";
import type { DropRecord } from "@/transfer/types";
import { sha256Hex } from "@/lib/hash";
import { downloadBlob, isImage } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import { COPY } from "@/lib/constants";

type Phase = "ready" | "extracting" | "complete";
interface FState {
  progress: number;
  state: FileCardState;
  verified?: boolean;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DropRecipientInner />
    </Suspense>
  );
}

function DropRecipientInner() {
  const id = useSearchParams().get("d") ?? "";
  const hydrated = useTransfers((s) => s.hydrated);
  const drops = useTransfers((s) => s.drops);
  const registerDownload = useTransfers((s) => s.registerDownload);
  const setAurora = useUI((s) => s.setAurora);
  const fireComplete = useUI((s) => s.fireComplete);

  const localDrop = useMemo(() => drops.find((d) => d.id === id && !d.trashedAt), [drops, id]);
  const [remoteDrop, setRemoteDrop] = useState<DropRecord | null>(null);
  const [fetchingManifest, setFetchingManifest] = useState(false);
  const triedRemoteRef = useRef(false);
  const drop = localDrop ?? remoteDrop;

  const [phase, setPhase] = useState<Phase>("ready");
  const [fstates, setFstates] = useState<Record<string, FState>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    if (drop) {
      setFstates(Object.fromEntries(drop.files.map((f) => [f.id, { progress: 0, state: "idle" as FileCardState }])));
    }
  }, [drop]);

  // If we don't have this Drop locally, try the cloud manifest exactly once.
  // We track the attempt with a ref so a null result (drop not in R2) doesn't
  // trigger a refetch loop.
  useEffect(() => {
    if (!hydrated || !id || localDrop || triedRemoteRef.current) return;
    triedRemoteRef.current = true;
    setFetchingManifest(true);
    fetchManifest(id)
      .then((m) => setRemoteDrop(m))
      .finally(() => setFetchingManifest(false));
  }, [hydrated, id, localDrop]);

  if (!hydrated || fetchingManifest) {
    return (
      <RecipientFrame>
        <div className="grid min-h-[50vh] place-items-center text-fg-3">
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin" />
        </div>
      </RecipientFrame>
    );
  }

  if (!drop) {
    return <RecipientError title={COPY.invalidTitle} sub={COPY.invalidSub} />;
  }
  if (drop.expiresAt !== null && drop.expiresAt < Date.now()) {
    return <RecipientError title={COPY.expiredTitle} sub={COPY.expiredSub} />;
  }

  const password = drop.options.password?.hash;
  if (password && !unlocked) {
    return (
      <RecipientFrame>
        <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col items-center justify-center gap-5 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Icon name="Lock" className="h-6 w-6 text-fg-2" />
          </span>
          <div>
            <h1 className="text-xl font-medium">{COPY.lockedTitle}</h1>
          </div>
          <div className="w-full space-y-2">
            <input
              type="password"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(false);
              }}
              placeholder={COPY.lockedPlaceholder}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-center text-sm text-fg outline-none focus:border-[#00c8ff]/40"
            />
            {codeError && <p className="text-[12px] text-[#ff8a9c]">{COPY.accessDeniedSub}</p>}
            <Button
              variant="primary"
              className="w-full"
              onClick={() => (code === password ? setUnlocked(true) : setCodeError(true))}
            >
              {COPY.unlock}
            </Button>
          </div>
        </div>
      </RecipientFrame>
    );
  }

  const patch = (fid: string, p: Partial<FState>) =>
    setFstates((prev) => ({ ...prev, [fid]: { ...prev[fid], ...p } }));

  const extractAll = async () => {
    setPhase("extracting");
    setAurora(true, 0.6);
    for (const meta of drop.files) {
      patch(meta.id, { state: "extracting", progress: 0 });
      const blob = await getDropFile(drop.id, meta.id);
      if (!blob) {
        patch(meta.id, { state: "failed" });
        continue;
      }
      const total = blob.size || 1;
      let loaded = 0;
      const parts: BlobPart[] = [];
      const CH = 2 * 1024 * 1024;
      while (loaded < total) {
        const slice = blob.slice(loaded, Math.min(loaded + CH, total));
        const buf = await slice.arrayBuffer();
        parts.push(buf);
        loaded += buf.byteLength;
        patch(meta.id, { progress: loaded / total });
        await new Promise((r) => setTimeout(r, 8));
      }
      const out = new Blob(parts, { type: meta.mime });
      let verified = true;
      if (meta.hash) {
        try {
          verified = (await sha256Hex(await out.arrayBuffer())) === meta.hash;
        } catch {
          verified = false;
        }
      }
      patch(meta.id, { state: "complete", progress: 1, verified });
      downloadBlob(out, meta.name);
    }
    registerDownload(drop.id);
    setAurora(false);
    fireComplete();
    setPhase("complete");
  };

  const previewFile = async (fid: string, mime: string) => {
    if (!isImage(mime)) return;
    const blob = await getDropFile(drop.id, fid);
    if (blob) window.open(URL.createObjectURL(blob), "_blank");
  };

  return (
    <RecipientFrame active={phase === "extracting"} intensity={0.6}>
      <AnimatePresence mode="wait">
        {phase === "complete" ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CompleteState />
          </motion.div>
        ) : (
          <motion.div key="files" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SenderHero
              name={drop.sender?.name || "Anonymous"}
              seed={drop.sender?.tag || drop.id}
              avatar={drop.sender?.avatar}
              count={drop.files.length}
              message={drop.message}
            />

            <div className="mx-auto mt-8 max-w-md space-y-2">
              <p className="eyebrow mb-1 px-1">
                {drop.files.length} {drop.files.length === 1 ? "file" : "files"} · {formatBytes(drop.totalSize)}
              </p>
              {drop.files.map((f) => {
                const st = fstates[f.id] ?? { progress: 0, state: "idle" as FileCardState };
                return (
                  <FileCard
                    key={f.id}
                    name={f.name}
                    size={f.size}
                    mime={f.mime}
                    progress={st.progress}
                    state={st.state}
                    verified={st.verified}
                    onClick={phase === "ready" ? () => previewFile(f.id, f.mime) : undefined}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase !== "complete" && (
        <ExtractCTA
          label={drop.files.length > 1 ? COPY.extractAll : COPY.extract}
          onClick={extractAll}
          loading={phase === "extracting"}
        />
      )}

      <RecipientFooter expiresAt={drop.expiresAt} verified={phase === "complete"} />
    </RecipientFrame>
  );
}
