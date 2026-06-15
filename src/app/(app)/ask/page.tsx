"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { CopyButton } from "@/components/ui/CopyButton";
import { QRCode } from "@/components/ui/QRCode";
import { toast } from "@/components/ui/Toast";
import { useTransfers } from "@/store/transfers";
import { shortId } from "@/lib/ids";
import { formatBytes, formatCountdown, formatRelative, pluralize } from "@/lib/format";
import { EXPIRY_OPTIONS, type ExpiryId } from "@/lib/constants";
import { askLink } from "@/lib/site";
import { cn } from "@/lib/cn";
import type { AskRequest } from "@/transfer/types";

const GB = 1024 * 1024 * 1024;
const CAP_OPTIONS = [
  { label: "1 GB", bytes: 1 * GB },
  { label: "2 GB", bytes: 2 * GB },
  { label: "5 GB", bytes: 5 * GB },
] as const;

/* Ticking clock so countdowns on each Ask row stay live. */
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function AsksPage() {
  const hydrated = useTransfers((s) => s.hydrated);
  const asks = useTransfers((s) => s.asks);
  const addAsk = useTransfers((s) => s.addAsk);
  const removeAsk = useTransfers((s) => s.removeAsk);

  const [origin, setOrigin] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const sorted = useMemo(() => [...asks].sort((a, b) => b.createdAt - a.createdAt), [asks]);

  if (!hydrated) {
    return (
      <Page>
        <div className="grid min-h-[50vh] place-items-center text-fg-3">
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin" />
        </div>
      </Page>
    );
  }

  const openAction = (
    <Button variant="primary" icon="FolderPlus" onClick={() => setCreateOpen(true)}>
      Open an Ask
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title="Asks"
        sub="Send a link; anyone fills it with files that land in your Vault."
        icon={
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/8 bg-white/[0.03] text-fg-2">
            <Icon name="FolderPlus" className="h-5 w-5" />
          </span>
        }
        actions={asks.length > 0 ? openAction : undefined}
      />

      {asks.length === 0 ? (
        <div className="grid min-h-[46vh] place-items-center">
          <EmptyState
            title="No pending Asks."
            sub="Open an Ask to collect files from friends, clients, anyone — no account needed on their end."
            action={openAction}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {sorted.map((ask, i) => (
              <AskRow
                key={ask.id}
                ask={ask}
                index={i}
                origin={origin}
                onRemove={() => {
                  removeAsk(ask.id);
                  toast.info("Ask closed", `"${ask.title}" is no longer accepting files.`);
                }}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <CreateAskModal
        open={createOpen}
        origin={origin}
        onClose={() => setCreateOpen(false)}
        onCreate={(ask) => {
          addAsk(ask);
          toast.success("Ask opened", "Share the link to start collecting files.");
        }}
      />
    </Page>
  );
}

/* ── A single Ask row ─────────────────────────────────────────────────── */
function AskRow({
  ask,
  index,
  origin,
  onRemove,
}: {
  ask: AskRequest;
  index: number;
  origin: string;
  onRemove: () => void;
}) {
  const now = useNow();
  const link = askLink(ask.id);
  const received = ask.received.length;
  const expired = ask.expiresAt !== null && ask.expiresAt <= now;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 360, damping: 32, delay: index * 0.04 }}
      className="glass group relative overflow-hidden rounded-2xl border border-white/8 p-4 sm:p-5"
    >
      {/* Edge accent ribbon */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px"
        style={{ background: "linear-gradient(180deg,#00ff88,#00c8ff,#0099ff)" }}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-[#00c8ff]">
              <Icon name="FolderPlus" className="h-4 w-4" />
            </span>
            <h3 className="truncate text-[15px] font-medium text-fg">{ask.title}</h3>
          </div>

          {ask.message && (
            <p className="mt-2.5 line-clamp-2 max-w-xl text-[13px] leading-relaxed text-fg-2">{ask.message}</p>
          )}

          {/* Meta chips */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="mono inline-flex items-center gap-1.5 text-[11px] text-fg">
              <Icon name="Download" className="h-3 w-3 text-[#00c8ff]" />
              <span className="tnum">{received}</span> {received === 1 ? "received" : "received"}
            </span>
            <span className="mono inline-flex items-center gap-1.5 text-[11px] text-fg-3">
              <Icon name="HardDrive" className="h-3 w-3" />
              {formatBytes(ask.perSubmitterCapBytes)} <span className="text-fg-3">per upload</span>
            </span>
            {ask.expiresAt === null ? (
              <span className="mono inline-flex items-center gap-1.5 text-[11px] text-fg-3">
                <Icon name="Globe" className="h-3 w-3" /> No expiry
              </span>
            ) : expired ? (
              <span className="mono inline-flex items-center gap-1.5 text-[11px] text-[#ff8a9c]">
                <Icon name="Clock" className="h-3 w-3" /> Expired
              </span>
            ) : (
              <span className="mono inline-flex items-center gap-1.5 text-[11px] text-[#FFB020]">
                <Icon name="Clock" className="h-3 w-3" /> Closes in {formatCountdown(ask.expiresAt - now)}
              </span>
            )}
            <span className="mono inline-flex items-center gap-1.5 text-[11px] text-fg-3">
              <Icon name="CircleDot" className="h-3 w-3" /> Opened {formatRelative(ask.createdAt, now)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton value={link} variant="glass" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close Ask"
            onClick={onRemove}
            className="text-fg-3 hover:text-[#ff8a9c]"
          >
            <Icon name="Trash2" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* The shareable link, inline */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
        <Icon name="Link2" className="h-3.5 w-3.5 shrink-0 text-fg-3" />
        <span className="mono truncate text-[12px] text-fg-2">{link.replace(/^https?:\/\//, "")}</span>
      </div>
    </motion.li>
  );
}

/* ── Create an Ask ────────────────────────────────────────────────────── */
function CreateAskModal({
  open,
  origin,
  onClose,
  onCreate,
}: {
  open: boolean;
  origin: string;
  onClose: () => void;
  onCreate: (ask: AskRequest) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState<ExpiryId>("7d");
  const [capBytes, setCapBytes] = useState<number>(CAP_OPTIONS[1].bytes);
  const [created, setCreated] = useState<AskRequest | null>(null);

  // Reset internal state each time the modal opens.
  useEffect(() => {
    if (open) {
      setTitle("");
      setMessage("");
      setExpiry("7d");
      setCapBytes(CAP_OPTIONS[1].bytes);
      setCreated(null);
    }
  }, [open]);

  const submit = () => {
    const clean = title.trim();
    if (!clean) {
      toast.error("Name your Ask", "Give it a title so submitters know what to send.");
      return;
    }
    const opt = EXPIRY_OPTIONS.find((o) => o.id === expiry);
    const ms = opt?.ms ?? null;
    const id = shortId();
    const ask: AskRequest = {
      id,
      title: clean,
      message: message.trim() || undefined,
      expiresAt: ms === null ? null : Date.now() + ms,
      createdAt: Date.now(),
      perSubmitterCapBytes: capBytes,
      received: [],
    };
    onCreate(ask);
    setCreated(ask);
  };

  const link = created ? askLink(created.id) : "";

  return (
    <Modal open={open} onClose={onClose} title={created ? "Ask opened" : "Open an Ask"} size="md">
      <AnimatePresence mode="wait">
        {created ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center"
          >
            <p className="text-balance text-sm leading-relaxed text-fg-2">
              <span className="text-fg">{created.title}</span> is live. Anyone with the link can drop files straight
              into your Vault.
            </p>

            <div className="my-6 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <QRCode value={link} size={148} />
            </div>

            <div className="mb-4 flex w-full items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
              <Icon name="Link2" className="h-4 w-4 shrink-0 text-fg-3" />
              <span className="mono flex-1 truncate text-left text-[12px] text-fg-2">
                {link.replace(/^https?:\/\//, "")}
              </span>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <CopyButton value={link} className="w-full" />
              <Button variant="secondary" className="w-full" icon="Check" onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Title */}
            <div className="space-y-2">
              <label className="eyebrow block px-0.5">What are you collecting</label>
              <input
                value={title}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
                placeholder="Wedding photos"
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-[#00c8ff]/40"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="eyebrow block px-0.5">A note for submitters (optional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Send me your best shots from the night — full resolution, please."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-[#00c8ff]/40"
              />
            </div>

            {/* Expiry chips */}
            <div className="space-y-2">
              <label className="eyebrow block px-0.5">Window</label>
              <div className="grid grid-cols-4 gap-2">
                {EXPIRY_OPTIONS.map((o) => {
                  const active = expiry === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setExpiry(o.id)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-all",
                        active
                          ? "border-[#00c8ff]/50 bg-[#00c8ff]/10"
                          : "border-white/8 bg-white/[0.02] hover:border-white/15",
                      )}
                    >
                      <span className={cn("text-[12px] font-medium", active ? "text-fg" : "text-fg-2")}>
                        {o.label}
                      </span>
                      <span className="mono text-[10px] text-fg-3">{o.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Per-submitter cap */}
            <div className="space-y-2">
              <label className="eyebrow block px-0.5">Limit per submitter</label>
              <div className="grid grid-cols-3 gap-2">
                {CAP_OPTIONS.map((c) => {
                  const active = capBytes === c.bytes;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setCapBytes(c.bytes)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-3 transition-all",
                        active
                          ? "border-[#00c8ff]/50 bg-[#00c8ff]/10"
                          : "border-white/8 bg-white/[0.02] hover:border-white/15",
                      )}
                    >
                      <Icon
                        name="HardDrive"
                        className={cn("h-3.5 w-3.5", active ? "text-[#00c8ff]" : "text-fg-3")}
                      />
                      <span className={cn("mono text-[12px] font-medium", active ? "text-fg" : "text-fg-2")}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button variant="ghost" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" icon="FolderPlus" onClick={submit}>
                Open Ask
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
