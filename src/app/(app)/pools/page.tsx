"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { Segmented } from "@/components/ui/Segmented";
import { toast } from "@/components/ui/Toast";
import { useTransfers } from "@/store/transfers";
import { useStash } from "@/store/stash";
import { shortId } from "@/lib/ids";
import { formatBytes, formatRelative, pluralize } from "@/lib/format";
import { poolHref } from "@/lib/site";
import { cn } from "@/lib/cn";
import { stagger, fadeUp } from "@/lib/motion";
import type { Pool } from "@/transfer/types";

/* ──────────────────────────────────────────────────────────────────────────
   Pools — shared gravity wells. Each Pool is a container your Crew orbit,
   dropping files in and pulling them out. This screen is the constellation of
   all your Pools plus the create flow.
   ──────────────────────────────────────────────────────────────────────── */

type PoolType = "cloud" | "live";
type MaxId = "1gb" | "10gb" | "100gb";

const GB = 1024 * 1024 * 1024;
const MAX_OPTIONS: { id: MaxId; label: string; bytes: number }[] = [
  { id: "1gb", label: "1 GB", bytes: GB },
  { id: "10gb", label: "10 GB", bytes: 10 * GB },
  { id: "100gb", label: "100 GB", bytes: 100 * GB },
];

function poolUsed(p: Pool): number {
  return p.files.reduce((acc, f) => acc + f.size, 0);
}

function lastActivity(p: Pool): number {
  return p.files.reduce((max, f) => Math.max(max, f.ts), p.createdAt);
}

export default function PoolsPage() {
  const hydrated = useTransfers((s) => s.hydrated);
  const pools = useTransfers((s) => s.pools);
  const addPool = useTransfers((s) => s.addPool);
  const myTag = useStash((s) => s.tag);
  const crew = useStash((s) => s.crew);

  const [createOpen, setCreateOpen] = useState(false);

  if (!hydrated) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
      </div>
    );
  }

  const newPoolButton = (
    <Button variant="primary" icon="Plus" onClick={() => setCreateOpen(true)}>
      New Pool
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title="Pools"
        sub="Shared gravity wells — your Crew drops files in and pulls them out."
        actions={newPoolButton}
      />

      {pools.length === 0 ? (
        <GlassPanel className="overflow-hidden p-0">
          <EmptyState
            title="No Pools yet."
            sub="Create a Pool to share files with your Crew — everyone drops in, everyone pulls out."
            action={
              <Button variant="primary" icon="Plus" onClick={() => setCreateOpen(true)}>
                New Pool
              </Button>
            }
          />
        </GlassPanel>
      ) : (
        <motion.div
          variants={stagger(0.05)}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {pools.map((p) => (
            <PoolTile key={p.id} pool={p} />
          ))}
        </motion.div>
      )}

      <CreatePoolModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        crew={crew}
        onCreate={(draft) => {
          addPool({
            id: shortId(),
            name: draft.name,
            type: draft.type,
            members: draft.members,
            host: myTag || "me",
            coHosts: [],
            maxBytes: draft.maxBytes,
            retention: "forever",
            permissions: "open",
            files: [],
            createdAt: Date.now(),
            online: draft.type === "live",
          });
          toast.success("Pool is live", `${draft.name} is ready for your Crew.`);
          setCreateOpen(false);
        }}
      />
    </Page>
  );
}

/* ── Pool tile ───────────────────────────────────────────────────────────── */

function PoolTile({ pool }: { pool: Pool }) {
  const used = poolUsed(pool);
  const pct = Math.min(1, pool.maxBytes > 0 ? used / pool.maxBytes : 0);
  const live = pool.type === "live";
  const lit = live && pool.online;
  const roster = pool.members;
  const shown = roster.slice(0, 4);
  const overflow = roster.length - shown.length;

  return (
    <motion.div variants={fadeUp}>
      <Link href={poolHref(pool.id)} className="group block focus:outline-none">
        <GlassPanel
          glow
          className="relative h-full overflow-hidden p-5 transition-colors hover:bg-white/[0.05]"
        >
          {/* Online ribbon along the top */}
          {lit && (
            <motion.span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, #00ff88, #00c8ff, #0099ff, transparent)" }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-medium text-fg">{pool.name}</h3>
              <p className="mono mt-1 text-[11px] text-fg-3">
                {pool.files.length} {pluralize(pool.files.length, "file")} · {formatRelative(lastActivity(pool))}
              </p>
            </div>
            <TypeBadge type={pool.type} online={pool.online} />
          </div>

          {/* Member roster — stacked OrbAvatars */}
          <div className="mt-4 flex items-center">
            {shown.length > 0 ? (
              <div className="flex items-center">
                {shown.map((tag, i) => (
                  <span key={tag} className={cn(i > 0 && "-ml-2")} style={{ zIndex: shown.length - i }}>
                    <OrbAvatar seed={tag} name={tag} size={26} ring={false} />
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="mono -ml-2 grid h-[26px] min-w-[26px] place-items-center rounded-full border border-white/10 bg-white/[0.06] px-1.5 text-[10px] text-fg-2">
                    +{overflow}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-fg-3">Just you so far</p>
            )}
          </div>

          {/* Size meter */}
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <motion.span
                className="block h-full rounded-full gradient-bg"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct * 100, used > 0 ? 4 : 0)}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 28 }}
              />
            </div>
            <p className="mono mt-2 text-[11px] tnum text-fg-3">
              <span className="text-fg-2">{formatBytes(used)}</span> / {formatBytes(pool.maxBytes)}
            </p>
          </div>
        </GlassPanel>
      </Link>
    </motion.div>
  );
}

function TypeBadge({ type, online }: { type: PoolType; online?: boolean }) {
  if (type === "live") {
    return (
      <span className="mono inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wide text-fg-2">
        <Icon name="Radio" className="h-3 w-3 text-cyan" />
        {online ? (
          <span className="inline-flex items-center gap-1 text-cyan">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-cyan"
              style={{ boxShadow: "0 0 8px #00c8ff" }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            Live
          </span>
        ) : (
          "Live"
        )}
      </span>
    );
  }
  return (
    <span className="mono inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wide text-fg-2">
      <Icon name="Cloud" className="h-3 w-3 text-blue" />
      Cloud
    </span>
  );
}

/* ── Create Pool modal ───────────────────────────────────────────────────── */

interface PoolDraft {
  name: string;
  type: PoolType;
  members: string[];
  maxBytes: number;
}

function CreatePoolModal({
  open,
  onClose,
  crew,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  crew: { tag: string; name: string }[];
  onCreate: (draft: PoolDraft) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PoolType>("cloud");
  const [maxId, setMaxId] = useState<MaxId>("10gb");
  const [members, setMembers] = useState<string[]>([]);

  const maxBytes = useMemo(
    () => MAX_OPTIONS.find((m) => m.id === maxId)?.bytes ?? 10 * GB,
    [maxId],
  );

  const reset = () => {
    setName("");
    setType("cloud");
    setMaxId("10gb");
    setMembers([]);
  };

  const close = () => {
    onClose();
    setTimeout(reset, 250);
  };

  const toggleMember = (tag: string) =>
    setMembers((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const canCreate = name.trim().length > 0;

  return (
    <Modal open={open} onClose={close} title="New Pool" size="md">
      <div className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <label className="eyebrow block px-0.5">Pool name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mission archive"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-[#00c8ff]/40"
          />
        </div>

        {/* Type */}
        <div className="space-y-2">
          <label className="eyebrow block px-0.5">Type</label>
          <Segmented<PoolType>
            layoutId="pool-type"
            value={type}
            onChange={setType}
            options={[
              { id: "cloud", label: "Cloud", icon: "Cloud" },
              { id: "live", label: "Live", icon: "Radio" },
            ]}
          />
          <p className="px-0.5 text-[12px] leading-relaxed text-fg-3">
            {type === "cloud"
              ? "Files orbit in the cloud — your Crew pulls them out anytime."
              : "A live well — files stream while hosts are online."}
          </p>
        </div>

        {/* Max size */}
        <div className="space-y-2">
          <label className="eyebrow block px-0.5">Max size</label>
          <div className="grid grid-cols-3 gap-2">
            {MAX_OPTIONS.map((m) => {
              const active = m.id === maxId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMaxId(m.id)}
                  className={cn(
                    "mono h-11 rounded-xl border text-sm tnum transition-colors",
                    active
                      ? "border-[#00c8ff]/40 bg-[#00c8ff]/10 text-fg"
                      : "border-white/10 bg-white/[0.03] text-fg-3 hover:text-fg-2",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Members */}
        <div className="space-y-2">
          <label className="eyebrow block px-0.5">
            Crew {members.length > 0 && <span className="text-fg-3">· {members.length} selected</span>}
          </label>
          {crew.length === 0 ? (
            <p className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[13px] text-fg-3">
              No Crew yet — you can add members to this Pool later.
            </p>
          ) : (
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto scrollbar-none">
              {crew.map((c) => {
                const selected = members.includes(c.tag);
                return (
                  <button
                    key={c.tag}
                    type="button"
                    onClick={() => toggleMember(c.tag)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors",
                      selected
                        ? "border-[#00c8ff]/40 bg-[#00c8ff]/10 text-fg"
                        : "border-white/10 bg-white/[0.03] text-fg-2 hover:text-fg",
                    )}
                  >
                    <OrbAvatar seed={c.tag} name={c.name || c.tag} size={22} ring={false} />
                    <span className="mono text-[12px]">@{c.tag}</span>
                    {selected && <Icon name="Check" className="h-3.5 w-3.5 text-cyan" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="Plus"
            disabled={!canCreate}
            onClick={() =>
              onCreate({ name: name.trim(), type, members, maxBytes })
            }
          >
            Create Pool
          </Button>
        </div>
      </div>
    </Modal>
  );
}
