"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shortId, beamId as genBeamId, genKey } from "@/lib/ids";
import { hashFile } from "@/lib/hash";
import { makePreview } from "@/lib/files";
import { uploadFile, putManifest } from "@/transfer/drop";
import { hasCloud } from "@/lib/site";
import { BeamHost, type HostFile, type BeamHostStats } from "@/transfer/beam";
import type { BeamManifest, BeamRecipient, DropRecord, FileMeta, LinkOptions } from "@/transfer/types";
import type { FileCardState } from "@/components/ui/FileCard";
import { EXPIRY_OPTIONS, type ExpiryId, type TransferMode } from "@/lib/constants";
import { useTransfers } from "@/store/transfers";
import { useStash } from "@/store/stash";
import { useUI } from "@/store/ui";
import { preventSleep, allowSleep } from "@/lib/desktop";
import { dropLink, beamLink } from "@/lib/site";

export interface SendFile {
  meta: FileMeta;
  file: File;
  preview: string | null;
  progress: number;
  state: FileCardState;
  speed?: number;
}

export type SendPhase = "compose" | "working" | "ready";

function intensityFromSpeed(bytesPerSec: number): number {
  if (bytesPerSec <= 0) return 0;
  // Map ~0–50 MB/s onto 0–1 with a log curve.
  return Math.min(1, Math.log10(bytesPerSec / 50_000 + 1) / 3);
}

export function useSend() {
  const [mode, setMode] = useState<TransferMode>("drop");
  const [files, setFiles] = useState<SendFile[]>([]);
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState<ExpiryId>("7d");
  const [options, setOptions] = useState<LinkOptions>({ encrypted: false, burnAfter: false, downloadCap: null });
  const [phase, setPhase] = useState<SendPhase>("compose");
  const [shareUrl, setShareUrl] = useState("");
  const [shareId, setShareId] = useState("");
  const [recipients, setRecipients] = useState<BeamRecipient[]>([]);
  const [aggregateSpeed, setAggregateSpeed] = useState(0);
  const [hostStats, setHostStats] = useState<BeamHostStats>({
    connected: 0, active: 0, completed: 0, aggSpeed: 0, bufferedBytes: 0, load: 0,
  });
  const [working, setWorking] = useState<{ label: string; progress: number }>({ label: "", progress: 0 });

  const hostRef = useRef<BeamHost | null>(null);
  const selfId = useRef<string>(shortId());

  const addDrop = useTransfers((s) => s.addDrop);
  const addBeam = useTransfers((s) => s.addBeam);
  const addTrail = useTransfers((s) => s.addTrail);
  const stash = useStash();
  const setAurora = useUI((s) => s.setAurora);
  const fireComplete = useUI((s) => s.fireComplete);

  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (defaultsApplied.current || !stash.hydrated) return;
    defaultsApplied.current = true;
    setMode(stash.settings.defaultMode);
    setExpiry(stash.settings.defaultExpiry);
  }, [stash.hydrated, stash.settings.defaultMode, stash.settings.defaultExpiry]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles((prev) => {
      const next: SendFile[] = arr.map((file) => ({
        meta: { id: shortId(), name: file.name, size: file.size, mime: file.type || "application/octet-stream" },
        file,
        preview: makePreview(file),
        progress: 0,
        state: "idle",
      }));
      return [...prev, ...next];
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.meta.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.meta.id !== id);
    });
  }, []);

  const patchFile = useCallback((id: string, patch: Partial<SendFile>) => {
    setFiles((prev) => prev.map((f) => (f.meta.id === id ? { ...f, ...patch } : f)));
  }, []);

  const totalSize = files.reduce((a, f) => a + f.meta.size, 0);

  const submitDrop = useCallback(async () => {
    const id = shortId();
    setShareId(id);
    setPhase("working");
    setAurora(true, 0.5);
    try {
    const metas: FileMeta[] = [];
    // Track real byte progress across the whole batch so the working indicator
    // never freezes at 0% on a single big file.
    const grandTotal = files.reduce((a, f) => a + f.meta.size, 0);
    let priorBytes = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      patchFile(f.meta.id, { state: "uploading" });
      setWorking({ label: `Dropping ${f.meta.name}`, progress: priorBytes / Math.max(1, grandTotal) });
      await uploadFile(id, f.meta, f.file, (p) => {
        const fileFrac = p.loaded / p.total;
        patchFile(f.meta.id, { progress: fileFrac, speed: p.speed });
        setWorking({
          label: `Dropping ${f.meta.name}`,
          progress: (priorBytes + p.loaded) / Math.max(1, grandTotal),
        });
        setAurora(true, intensityFromSpeed(p.speed));
      });
      priorBytes += f.meta.size;
      // Integrity hash — kept for the local IDB path so the recipient can
      // verify byte-for-byte. Skipped on cloud uploads because R2 has its own
      // checksums and hashing a 50 MB file twice (once on the device, once on
      // the recipient) hangs slow phones for many seconds.
      if (!hasCloud()) {
        try {
          f.meta.hash = await hashFile(f.file);
        } catch {
          /* skip */
        }
      }
      patchFile(f.meta.id, { state: "complete", progress: 1 });
      metas.push({ ...f.meta });
    }
    const exp = EXPIRY_OPTIONS.find((e) => e.id === expiry);
    const expiresAt = exp?.ms ? Date.now() + exp.ms : null;
    const record: DropRecord = {
      id,
      kind: "drop",
      files: metas,
      message: message.trim() || undefined,
      createdAt: Date.now(),
      expiresAt,
      downloads: 0,
      totalSize,
      backend: stash.settings.defaultBackend,
      options: { ...options, expiry },
      sender: { tag: stash.tag, name: stash.name, avatar: stash.avatar },
      localAvailable: true,
    };
    addDrop(record);
    // Show a clear "Finalizing" beat between 100% bytes and the share screen so
    // users don't think the upload froze while the worker writes to R2 and the
    // manifest goes up.
    setWorking({ label: "Finalizing", progress: 1 });
    // The manifest PUT used to silently hang the UI when the cloud was slow or
    // unreachable. Now it's bounded by an 8s timeout — if it doesn't land, we
    // still surface the share link (the recipient page can retry, and same-
    // browser viewers can read from the local store).
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      await putManifest(record, ac.signal).finally(() => clearTimeout(timer));
    } catch (e) {
      console.warn("[Space Send] manifest upload skipped:", e);
    }
    addTrail({
      id: shortId(),
      type: "drop",
      direction: "out",
      label: metas.length === 1 ? metas[0].name : `${metas.length} files`,
      size: totalSize,
      count: 0,
      ts: Date.now(),
      status: "complete",
      refId: id,
    });
    const url = dropLink(id);
    setShareUrl(url);
    setPhase("ready");
    setAurora(false);
    fireComplete();
    } catch (e) {
      // Surface the real error in the working indicator and stop. We don't
      // auto-revert to compose because that flicker reads as "the share screen
      // appeared and then vanished" — the user was bouncing on a transient
      // failure they couldn't see. Now they see "Failed — <reason>" and the
      // composer keeps their files so they can retry.
      console.error("[Space Send] Drop failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setWorking({ label: `Failed — ${msg.slice(0, 80)}`, progress: 0 });
      files.forEach((f) => patchFile(f.meta.id, { state: "failed" }));
      setAurora(false);
    }
  }, [files, expiry, message, totalSize, options, stash.settings.defaultBackend, stash.tag, stash.name, stash.avatar, addDrop, addTrail, patchFile, setAurora, fireComplete]);

  const submitBeam = useCallback(async () => {
    const bId = genBeamId();
    const key = genKey();
    setShareId(bId);
    setPhase("working");
    setWorking({ label: "Staging files", progress: 0.2 });
    setAurora(true, 0.3);
    void preventSleep(); // your device is the signal tower — keep it awake

    const hostFiles: HostFile[] = [];
    const metas: FileMeta[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      patchFile(f.meta.id, { state: "staged" });
      setWorking({ label: `Staging ${f.meta.name}`, progress: (i + 1) / (files.length + 1) });
      try {
        f.meta.hash = await hashFile(f.file);
      } catch {
        /* skip */
      }
      hostFiles.push({ meta: f.meta, file: f.file });
      metas.push({ ...f.meta });
    }

    const manifest: BeamManifest = {
      files: metas.map((m) => ({ id: m.id, name: m.name, size: m.size, mime: m.mime, hash: m.hash })),
      message: message.trim() || undefined,
      senderTag: stash.tag ?? undefined,
      senderName: stash.name || undefined,
      totalSize,
    };

    const host = new BeamHost(bId, selfId.current, hostFiles, manifest, {
      onRecipientJoin: (r) => setRecipients((prev) => [...prev.filter((x) => x.id !== r.id), r]),
      onRecipientUpdate: (rid, patch) =>
        setRecipients((prev) => prev.map((x) => (x.id === rid ? { ...x, ...patch } : x))),
      onRecipientLeave: (rid) => setRecipients((prev) => prev.filter((x) => x.id !== rid)),
      onAggregateSpeed: (spd) => {
        setAggregateSpeed(spd);
        setAurora(spd > 0, intensityFromSpeed(spd));
      },
      onStats: (st) => setHostStats(st),
    });
    hostRef.current = host;

    addBeam({
      id: bId,
      kind: "beam",
      files: metas,
      message: message.trim() || undefined,
      createdAt: Date.now(),
      durationId: "until",
      expiresAt: null,
      status: "live",
      recipients: [],
    });
    addTrail({
      id: shortId(),
      type: "beam",
      direction: "out",
      label: metas.length === 1 ? metas[0].name : `${metas.length} files`,
      size: totalSize,
      count: 0,
      ts: Date.now(),
      status: "active",
      refId: bId,
    });

    const url = beamLink(bId, key);
    setShareUrl(url);
    setPhase("ready");
  }, [files, message, totalSize, stash.tag, stash.name, addBeam, addTrail, patchFile, setAurora]);

  const submit = useCallback(() => {
    if (files.length === 0) return;
    if (mode === "drop") void submitDrop();
    else void submitBeam();
  }, [files.length, mode, submitDrop, submitBeam]);

  const reset = useCallback(() => {
    hostRef.current?.close();
    hostRef.current = null;
    void allowSleep();
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
    setMessage("");
    setRecipients([]);
    setAggregateSpeed(0);
    setHostStats({ connected: 0, active: 0, completed: 0, aggSpeed: 0, bufferedBytes: 0, load: 0 });
    setShareUrl("");
    setShareId("");
    setPhase("compose");
    setAurora(false);
    selfId.current = shortId();
  }, [files, setAurora]);

  // Clean up the live host on unmount.
  useEffect(() => {
    return () => {
      hostRef.current?.close();
      setAurora(false);
      void allowSleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    mode, setMode,
    files, addFiles, removeFile, totalSize,
    message, setMessage,
    expiry, setExpiry,
    options, setOptions,
    phase, working,
    shareUrl, shareId,
    recipients, aggregateSpeed, hostStats,
    host: hostRef,
    submit, reset,
  };
}
