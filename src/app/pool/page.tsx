"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wordmark } from "@/components/brand/Wordmark";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CopyButton } from "@/components/ui/CopyButton";
import { toast } from "@/components/ui/Toast";
import { useStash } from "@/store/stash";
import { shortId } from "@/lib/ids";
import { poolLink } from "@/lib/site";
import { formatBytes, formatRelative } from "@/lib/format";
import { fileIcon } from "@/lib/files";
import { listPool, uploadToPool, poolFileUrl, deletePoolFile, type PoolFileInfo } from "@/transfer/pool";

interface UploadingState {
  id: string;
  name: string;
  progress: number;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoolView />
    </Suspense>
  );
}

function PoolView() {
  const poolId = useSearchParams().get("p") ?? "";
  const { name } = useStash();
  const [files, setFiles] = useState<PoolFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<UploadingState[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const list = await listPool(poolId);
    setFiles(list);
    setLoading(false);
  }, [poolId]);

  useEffect(() => {
    if (!poolId) return;
    refresh();
    const t = setInterval(refresh, 6000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [poolId, refresh]);

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      for (const file of arr) {
        const fid = shortId();
        setUploading((u) => [...u, { id: fid, name: file.name, progress: 0 }]);
        try {
          await uploadToPool(poolId, fid, file, name || "anon", (p) => {
            setUploading((u) => u.map((x) => (x.id === fid ? { ...x, progress: p.total ? p.loaded / p.total : 0 } : x)));
          });
          toast.success("Added to pool", file.name);
        } catch (e) {
          toast.warning("Upload failed", e instanceof Error ? e.message : file.name);
        } finally {
          setUploading((u) => u.filter((x) => x.id !== fid));
        }
      }
      refresh();
    },
    [poolId, name, refresh],
  );

  const remove = async (f: PoolFileInfo) => {
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    await deletePoolFile(poolId, f.id);
    refresh();
  };

  if (!poolId) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <EmptyState title="No pool here" sub="This link is missing a pool id." />
      </div>
    );
  }

  const totalSize = files.reduce((a, f) => a + f.size, 0);

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
      className="min-h-dvh px-5 py-8 sm:px-8"
    >
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Wordmark href="/" size="sm" />
          <span className="mono inline-flex items-center gap-1.5 text-[11px] text-[#00c8ff]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00c8ff] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00c8ff]" />
            </span>
            shared pool
          </span>
        </div>

        <GlassPanel glow className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#00c8ff]/20 bg-[#00c8ff]/[0.08] text-[#00c8ff]">
              <Icon name="Waves" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-medium text-fg">Pool · {poolId}</h1>
              <p className="mono text-[11px] text-fg-3">
                {files.length} {files.length === 1 ? "file" : "files"} · {formatBytes(totalSize)} · anyone with the link can add or grab
              </p>
            </div>
          </div>

          {/* Share link */}
          <div className="mt-4 flex gap-2">
            <CopyButton value={poolLink(poolId)} className="flex-1" />
            <Button variant="primary" icon="Upload" onClick={() => inputRef.current?.click()}>
              Add files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* Drop zone hint */}
          <div
            className={cnDrop(dragging)}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="CloudUpload" className="h-5 w-5 text-fg-3" />
            <span className="text-sm text-fg-3">{dragging ? "Release to add to the pool" : "Drag files here, or click to add"}</span>
          </div>

          {/* Uploading */}
          <AnimatePresence>
            {uploading.map((u) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 overflow-hidden"
              >
                <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                  <Icon name="RefreshCw" className="h-3.5 w-3.5 animate-spin text-[#00c8ff]" />
                  <span className="truncate text-[13px] text-fg-2">{u.name}</span>
                  <span className="mono ml-auto text-[11px] text-fg-3">{Math.round(u.progress * 100)}%</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* File list */}
          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="grid place-items-center py-10 text-fg-3">
                <Icon name="RefreshCw" className="h-5 w-5 animate-spin" />
              </div>
            ) : files.length === 0 && uploading.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-fg-3">Empty pool. Be the first to drop something in.</p>
            ) : (
              <AnimatePresence initial={false}>
                {files.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2.5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-fg-2">
                      <Icon name={fileIcon(f.mime)} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-fg">{f.name}</p>
                      <p className="mono text-[11px] text-fg-3">
                        {formatBytes(f.size)} · {f.uploader} · {formatRelative(f.ts)}
                      </p>
                    </div>
                    <a href={poolFileUrl(poolId, f.id)} download={f.name} target="_blank" rel="noreferrer">
                      <Button variant="glass" size="icon-sm" aria-label="Download">
                        <Icon name="Download" className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => remove(f)}>
                      <Icon name="Trash2" className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </GlassPanel>

        <p className="mt-4 text-center text-[11px] text-fg-3">
          Files live in shared cloud storage · counts against the team&apos;s 10 GB
        </p>
      </div>
    </div>
  );
}

function cnDrop(dragging: boolean): string {
  return [
    "mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-5 transition-colors",
    dragging ? "border-[#00c8ff]/40 bg-[#00c8ff]/[0.06]" : "border-white/12 hover:border-white/20",
  ].join(" ");
}
