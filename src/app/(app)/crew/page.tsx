"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Page, PageHeader } from "@/components/shell/Page";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PulseDot } from "@/components/ui/PulseDot";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { toast } from "@/components/ui/Toast";

import { useStash } from "@/store/stash";
import { isValidTag } from "@/lib/ids";
import { formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CrewMember } from "@/transfer/types";

type Presence = "online" | "offline";

/** Deterministic presence so a member looks the same on every render. */
function presenceFor(member: CrewMember): Presence {
  const seed = member.tag.charCodeAt(0) + member.interactions;
  return seed % 3 === 0 ? "online" : "offline";
}

/* ------------------------------------------------------------------ */
/*  Quick-action icon button                                          */
/* ------------------------------------------------------------------ */

function QuickAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border border-white/8 bg-white/[0.02]",
        "text-fg-3 transition-colors duration-200",
        "hover:bg-white/[0.06] hover:text-fg",
        danger && "hover:border-danger/40 hover:text-danger",
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Crew row                                                           */
/* ------------------------------------------------------------------ */

function CrewRow({
  member,
  onDrop,
  onBeam,
  onAsk,
  onRemove,
}: {
  member: CrewMember;
  onDrop: () => void;
  onBeam: () => void;
  onAsk: () => void;
  onRemove: () => void;
}) {
  const presence = presenceFor(member);
  const lastSignal = member.lastSignal || member.addedAt;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="glass group flex items-center gap-4 rounded-2xl border border-white/8 px-4 py-3.5"
    >
      <OrbAvatar seed={member.tag} name={member.name} size={44} presence={presence} ring />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-fg">{member.name || member.tag}</p>
          <span className="mono truncate text-xs text-fg-3">@{member.tag}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-fg-3">
          Last signal: {formatRelative(lastSignal)}
        </p>
      </div>

      {/* Interactions pill */}
      <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1 sm:flex">
        <Icon name="Zap" className="h-3 w-3 text-cyan" />
        <span className="mono tnum text-xs text-fg-2">{member.interactions}</span>
      </div>

      {/* Quick actions */}
      <div className="flex shrink-0 items-center gap-1.5 opacity-70 transition-opacity duration-200 group-hover:opacity-100">
        <QuickAction icon="CloudUpload" label={`Drop to @${member.tag}`} onClick={onDrop} />
        <QuickAction icon="Radio" label={`Beam to @${member.tag}`} onClick={onBeam} />
        <QuickAction icon="FolderPlus" label={`Ask @${member.tag}`} onClick={onAsk} />
        <QuickAction icon="Trash2" label="Remove from Crew" onClick={onRemove} danger />
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/*  Add-to-Crew modal                                                 */
/* ------------------------------------------------------------------ */

function AddCrewModal({
  open,
  onClose,
  existing,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  existing: CrewMember[];
  onAdd: (member: { tag: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");

  const clean = tag.trim().toLowerCase();
  const valid = isValidTag(clean);
  const duplicate = existing.some((c) => c.tag === clean);
  const showValidity = clean.length > 0;

  function reset() {
    setName("");
    setTag("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function submit() {
    if (!valid) {
      toast.error("Invalid Tag", "Use 3 to 20 lowercase letters, numbers, or underscores.");
      return;
    }
    if (duplicate) {
      toast.error("Already in Crew", `@${clean} is already on your signal network.`);
      return;
    }
    onAdd({ tag: clean, name: name.trim() });
    reset();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add to Crew" size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-5"
      >
        <p className="text-sm text-fg-3">
          Add a Crew member by Tag to Beam directly, invite to Pools, or track who is live. Stored
          locally on your Stash.
        </p>

        {/* Display name */}
        <label className="block space-y-2">
          <span className="eyebrow text-fg-3">Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova Reyes"
            maxLength={40}
            className={cn(
              "w-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5",
              "text-sm text-fg placeholder:text-fg-3",
              "transition-colors duration-200 focus:border-white/20 focus:outline-none",
            )}
          />
        </label>

        {/* Tag */}
        <label className="block space-y-2">
          <span className="eyebrow text-fg-3">Tag</span>
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-white/[0.02] px-3.5 transition-colors duration-200",
              showValidity && valid && !duplicate && "border-green/40",
              showValidity && (!valid || duplicate) && "border-danger/40",
              !showValidity && "border-white/8 focus-within:border-white/20",
            )}
          >
            <span className="mono text-sm text-fg-3">@</span>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value.toLowerCase().replace(/\s+/g, ""))}
              placeholder="callsign"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mono w-full bg-transparent py-2.5 text-sm text-fg placeholder:text-fg-3 focus:outline-none"
            />
            <AnimatePresence mode="wait">
              {showValidity && (
                <motion.span
                  key={valid && !duplicate ? "ok" : "bad"}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  className="shrink-0"
                >
                  {valid && !duplicate ? (
                    <Icon name="Check" className="h-4 w-4 text-green" />
                  ) : (
                    <Icon name="X" className="h-4 w-4 text-danger" />
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-xs text-fg-3">
            {duplicate
              ? "This Tag is already in your Crew."
              : "3 to 20 lowercase letters, numbers, or underscores."}
          </p>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="Plus" disabled={!valid || duplicate}>
            Add to Crew
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function CrewPage() {
  const router = useRouter();
  const hydrated = useStash((s) => s.hydrated);
  const crew = useStash((s) => s.crew);
  const addCrew = useStash((s) => s.addCrew);
  const removeCrew = useStash((s) => s.removeCrew);

  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const onlineCount = useMemo(
    () => crew.filter((m) => presenceFor(m) === "online").length,
    [crew],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return crew;
    return crew.filter(
      (m) => m.name.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q),
    );
  }, [crew, query]);

  if (!hydrated) {
    return (
      <Page>
        <div className="grid min-h-[40vh] place-items-center">
          <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
        </div>
      </Page>
    );
  }

  function handleAdd(member: { tag: string; name: string }) {
    addCrew({ tag: member.tag, name: member.name || member.tag, interactions: 0 });
    toast.success("Added to Crew", `@${member.tag} joined your signal network.`);
    setAddOpen(false);
  }

  function handleRemove(member: CrewMember) {
    removeCrew(member.tag);
    toast.info("Removed from Crew", `@${member.tag} left your signal network.`);
  }

  function handleDrop(member: CrewMember) {
    toast.info(`Drop to @${member.tag}`, "Opening Send");
    router.push("/");
  }

  function handleBeam(member: CrewMember) {
    toast.info(`Beam to @${member.tag}`, "Opening Send");
    router.push("/");
  }

  function handleAsk(member: CrewMember) {
    toast.info(`Ask @${member.tag}`, "Opening Send");
    router.push("/");
  }

  return (
    <Page>
      <PageHeader
        title="Crew"
        sub="The people you Beam and Drop with. Private and local-only."
        icon={<Icon name="Users" className="h-6 w-6 text-cyan" />}
        actions={
          <>
            <Link href="/constellation">
              <Button variant="glass" icon="Sparkles">
                Constellation
              </Button>
            </Link>
            <Button variant="primary" icon="Plus" onClick={() => setAddOpen(true)}>
              Add to Crew
            </Button>
          </>
        }
      />

      {crew.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          <EmptyState
            title="Your signal network is empty."
            sub="Add Crew members by Tag to Beam directly, invite to Pools, or track who is live."
            action={
              <Button variant="primary" icon="Plus" onClick={() => setAddOpen(true)}>
                Add first contact
              </Button>
            }
          />
        </motion.div>
      ) : (
        <div className="space-y-5">
          {/* Summary + search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PulseDot state="online" />
              <span className="text-sm text-fg-2">
                <span className="mono tnum text-fg">{onlineCount}</span> Crew online
              </span>
              <span className="text-fg-3">·</span>
              <span className="text-sm text-fg-3">
                {crew.length} {pluralize(crew.length, "contact")} total
              </span>
            </div>

            <label className="relative flex w-full items-center sm:w-72">
              <Icon
                name="Search"
                className="pointer-events-none absolute left-3 h-4 w-4 text-fg-3"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or @tag"
                className={cn(
                  "w-full rounded-xl border border-white/8 bg-white/[0.02] py-2.5 pl-9 pr-3",
                  "text-sm text-fg placeholder:text-fg-3",
                  "transition-colors duration-200 focus:border-white/20 focus:outline-none",
                )}
              />
            </label>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl border border-white/8 px-6 py-12 text-center">
              <Icon name="Search" className="h-5 w-5 text-fg-3" />
              <p className="text-sm text-fg-2">No Crew match that signal.</p>
              <p className="text-xs text-fg-3">Try a different name or Tag.</p>
            </div>
          ) : (
            <motion.ul layout className="space-y-2.5">
              <AnimatePresence initial={false} mode="popLayout">
                {filtered.map((member) => (
                  <CrewRow
                    key={member.tag}
                    member={member}
                    onDrop={() => handleDrop(member)}
                    onBeam={() => handleBeam(member)}
                    onAsk={() => handleAsk(member)}
                    onRemove={() => handleRemove(member)}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      )}

      <AddCrewModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existing={crew}
        onAdd={handleAdd}
      />
    </Page>
  );
}
