"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { RecipientFrame, SenderHero, RecipientFooter, Handshake } from "@/components/recipient/RecipientUI";
import { FileCard, type FileCardState } from "@/components/ui/FileCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { BeamReceiver } from "@/transfer/beam";
import { HAS_CLOUD_SIGNALING } from "@/transfer/signaling";
import type { BeamManifest } from "@/transfer/types";
import { shortId } from "@/lib/ids";
import { useUI } from "@/store/ui";
import { formatBytes } from "@/lib/format";
import { COPY } from "@/lib/constants";

type Conn = "connecting" | "live" | "offline";
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
      <BeamViewer />
    </Suspense>
  );
}

function BeamViewer() {
  const id = useSearchParams().get("b") ?? "";
  const setAurora = useUI((s) => s.setAurora);

  const [conn, setConn] = useState<Conn>("connecting");
  const [manifest, setManifest] = useState<BeamManifest | null>(null);
  const [fstates, setFstates] = useState<Record<string, FState>>({});
  const [anyActive, setAnyActive] = useState(false);

  const receiverRef = useRef<BeamReceiver | null>(null);
  const selfId = useRef(shortId());
  const startedRef = useRef(false);

  const patch = (fid: string, p: Partial<FState>) =>
    setFstates((prev) => ({ ...prev, [fid]: { ...(prev[fid] ?? { progress: 0, state: "queued" }), ...p } }));

  useEffect(() => {
    if (startedRef.current || !id) return;
    startedRef.current = true;

    const recv = new BeamReceiver(id, selfId.current, {
      onManifest: (m) => {
        setManifest(m);
        setConn("live");
        setFstates((prev) => {
          const next = { ...prev };
          m.files.forEach((f) => {
            if (!next[f.id]) next[f.id] = { progress: 0, state: "queued" };
          });
          return next;
        });
      },
      onFileProgress: (fid, received, total, speed) => {
        patch(fid, { progress: total ? received / total : 0, state: "extracting", speed });
        setAurora(true, intensity(speed));
      },
      onFileComplete: (fid, verified) => {
        patch(fid, { progress: 1, state: "complete", verified });
        setAurora(false);
      },
      onError: () => setConn((c) => (c === "live" ? c : "offline")),
      onHostGone: () => setConn((c) => (c === "live" ? c : "offline")),
    });
    receiverRef.current = recv;

    // If no manifest within 12s, the host isn't online.
    const t = setTimeout(() => setConn((c) => (c === "connecting" ? "offline" : c)), 12000);

    return () => {
      clearTimeout(t);
      recv.close();
      setAurora(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const downloadOne = async (f: { id: string; name: string; size: number; mime: string; hash?: string }) => {
    setAnyActive(true);
    try {
      await receiverRef.current?.download(f);
    } catch {
      patch(f.id, { state: "failed" });
    } finally {
      setAnyActive(false);
    }
  };

  const downloadAll = async () => {
    if (!manifest) return;
    setAnyActive(true);
    for (const f of manifest.files) {
      if (fstates[f.id]?.state === "complete") continue;
      try {
        await receiverRef.current?.download(f);
      } catch {
        patch(f.id, { state: "failed" });
      }
    }
    setAnyActive(false);
  };

  if (conn === "offline") {
    const title = HAS_CLOUD_SIGNALING ? "Signal lost" : "Cross-device Beam not configured";
    const sub = HAS_CLOUD_SIGNALING
      ? "The host's device is offline. Beams are live — ask them to reopen the Beam, or request a Drop instead."
      : "This site was built without a signaling URL, so Beams only reach the same browser.";
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

  if (conn === "connecting") {
    return (
      <RecipientFrame active intensity={0.2}>
        <Handshake label="Locking onto the signal tower…" />
        <div className="mt-10 flex justify-center">
          <ContlesMark />
        </div>
      </RecipientFrame>
    );
  }

  const totalSize = manifest?.totalSize ?? 0;
  const allDone = !!manifest && manifest.files.every((f) => fstates[f.id]?.state === "complete");

  return (
    <RecipientFrame active={anyActive} intensity={0.5}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <SenderHero
          name={manifest?.senderName || "Someone"}
          seed={manifest?.senderTag || id}
          count={manifest?.files.length ?? 0}
          message={manifest?.message}
          beam
          online
        />

        <div className="mx-auto mt-6 flex max-w-md items-center justify-between px-1">
          <p className="eyebrow inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00c8ff] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00c8ff]" />
            </span>
            Live · streaming from sender
          </p>
          <span className="mono text-[11px] text-fg-3">{formatBytes(totalSize)}</span>
        </div>

        <div className="mx-auto mt-3 max-w-md space-y-2">
          {manifest?.files.map((f) => {
            const st = fstates[f.id] ?? { progress: 0, state: "queued" as FileCardState };
            const done = st.state === "complete";
            return (
              <div key={f.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <FileCard
                    name={f.name}
                    size={f.size}
                    mime={f.mime}
                    progress={st.progress}
                    state={st.state}
                    speed={st.speed}
                    verified={st.verified}
                  />
                </div>
                <Button
                  variant={done ? "glass" : "primary"}
                  size="icon"
                  aria-label={done ? "Downloaded" : "Download"}
                  disabled={st.state === "extracting"}
                  onClick={() => downloadOne(f)}
                >
                  <Icon name={done ? "Check" : "Download"} className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {manifest && manifest.files.length > 0 && (
          <div className="mx-auto mt-5 max-w-md">
            <Button variant="primary" size="lg" className="w-full" loading={anyActive} disabled={allDone} onClick={downloadAll} icon="Download">
              {allDone ? "All files downloaded" : manifest.files.length > 1 ? "Download all" : "Download"}
            </Button>
            <p className="mono mt-2 text-center text-[11px] text-fg-3">
              peer-to-peer · DTLS encrypted · nothing stored in the cloud
            </p>
          </div>
        )}
      </motion.div>

      <RecipientFooter verified={allDone} />
    </RecipientFrame>
  );
}

void COPY;
