"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { useStash } from "@/store/stash";
import { isValidTag } from "@/lib/ids";
import { EXPIRY_OPTIONS, type ExpiryId, type TransferMode } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { fadeUp } from "@/lib/motion";

/* Settings, trimmed for internal-team use: who you are, your send defaults, and
   a way to reset this browser. No accounts, no BYOS, no dead toggles. */

export default function SettingsPage() {
  const hydrated = useStash((s) => s.hydrated);
  const tag = useStash((s) => s.tag);
  const name = useStash((s) => s.name);
  const avatar = useStash((s) => s.avatar);
  const settings = useStash((s) => s.settings);
  const updateProfile = useStash((s) => s.updateProfile);
  const updateSettings = useStash((s) => s.updateSettings);
  const wipe = useStash((s) => s.wipe);

  const [nameDraft, setNameDraft] = useState(name);
  const [tagDraft, setTagDraft] = useState(tag ?? "");
  const synced = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hydrated && !synced.current) {
      synced.current = true;
      setNameDraft(name);
      setTagDraft(tag ?? "");
    }
  }, [hydrated, name, tag]);

  if (!hydrated) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
      </div>
    );
  }

  const tagTrimmed = tagDraft.trim().toLowerCase();
  const tagValid = tagTrimmed.length === 0 || isValidTag(tagTrimmed);

  const commitName = () => {
    const next = nameDraft.trim();
    if (next && next !== name) {
      updateProfile({ name: next });
      toast.success("Name updated", next);
    } else setNameDraft(name);
  };

  const commitTag = () => {
    if (tagTrimmed === (tag ?? "")) return;
    if (!isValidTag(tagTrimmed)) {
      setTagDraft(tag ?? "");
      return;
    }
    updateProfile({ tag: tagTrimmed });
    setTagDraft(tagTrimmed);
    toast.success("Tag set", `@${tagTrimmed}`);
  };

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", "Choose an image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && updateProfile({ avatar: reader.result });
    reader.readAsDataURL(file);
  };

  const doWipe = () => {
    if (typeof window !== "undefined" && !window.confirm("Reset this browser? Clears your profile and local history (cloud files are untouched).")) return;
    wipe();
    toast.warning("Reset", "This browser is back to a clean slate.");
  };

  const MODES: { id: TransferMode; label: string; icon: string }[] = [
    { id: "drop", label: "Drop", icon: "Cloud" },
    { id: "beam", label: "Beam", icon: "Radio" },
  ];

  return (
    <Page>
      <PageHeader
        title="Settings"
        sub="Your profile and send defaults. Everything is stored on this device only."
        icon={<Icon name="Settings" className="h-6 w-6 text-cyan" />}
      />

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-5">
        {/* Profile */}
        <GlassPanel glow className="p-5 sm:p-6">
          <Eyebrow icon="User">Profile</Eyebrow>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="relative mx-auto shrink-0 transition-transform hover:scale-105 sm:mx-0"
              aria-label="Change avatar"
            >
              <OrbAvatar seed={tag ?? "anon"} name={name} src={avatar} size={72} ring />
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-[#0a0a14]">
                <Icon name="Plus" className="h-3 w-3 text-fg-2" />
              </span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />

            <div className="flex-1 space-y-3">
              <div>
                <label className="eyebrow mb-1.5 block">Display name</label>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="Anonymous"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-[#00c8ff]/40"
                />
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Tag</label>
                <div
                  className={cn(
                    "flex h-11 items-center rounded-xl border bg-white/[0.03] px-3.5 transition-colors",
                    tagDraft.length === 0 ? "border-white/10" : tagValid ? "border-[#00ff88]/40" : "border-[#ff4d6a]/40",
                  )}
                >
                  <span className="mono text-fg-3">@</span>
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    onBlur={commitTag}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    placeholder="anon"
                    maxLength={20}
                    className="mono ml-0.5 h-full flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-fg-3">3–20 chars · lowercase, numbers, underscore. Just a label — no account.</p>
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Defaults */}
        <GlassPanel className="p-5 sm:p-6">
          <Eyebrow icon="Rocket">Send defaults</Eyebrow>
          <div className="mt-4 space-y-4">
            <div>
              <label className="eyebrow mb-2 block">Default mode</label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => updateSettings({ defaultMode: m.id })}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors",
                      settings.defaultMode === m.id
                        ? "border-[#00c8ff]/40 bg-[#00c8ff]/[0.08] text-fg"
                        : "border-white/8 bg-white/[0.02] text-fg-3 hover:text-fg-2",
                    )}
                  >
                    <Icon name={m.icon} className="h-4 w-4" /> {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="eyebrow mb-2 block">Default Drop expiry</label>
              <div className="grid grid-cols-4 gap-1.5">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSettings({ defaultExpiry: opt.id as ExpiryId })}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-xl border py-2 text-center transition-colors",
                      settings.defaultExpiry === opt.id
                        ? "border-[#00c8ff]/40 bg-[#00c8ff]/[0.08] text-fg"
                        : "border-white/8 bg-white/[0.02] text-fg-3 hover:text-fg-2",
                    )}
                  >
                    <span className="text-[12px] font-medium leading-tight">{opt.label}</span>
                    <span className="mono text-[9px] text-fg-3">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Appearance */}
        <GlassPanel className="p-5 sm:p-6">
          <Eyebrow icon="Sparkles">Appearance</Eyebrow>
          <div className="mt-3 space-y-1">
            <Row>
              <div>
                <p className="text-[13px] font-medium text-fg">Reduce motion</p>
                <p className="text-[11px] text-fg-3">Calmer animations across the app.</p>
              </div>
              <Switch checked={settings.motion === "off"} onChange={(v) => updateSettings({ motion: v ? "off" : "auto" })} />
            </Row>
            <Row>
              <div>
                <p className="text-[13px] font-medium text-fg">Keep awake while hosting a Beam</p>
                <p className="text-[11px] text-fg-3">Stops the screen sleeping mid-transfer.</p>
              </div>
              <Switch checked={settings.keepAwake} onChange={(v) => updateSettings({ keepAwake: v })} />
            </Row>
          </div>
        </GlassPanel>

        {/* Reset */}
        <GlassPanel className="p-5 sm:p-6">
          <Eyebrow icon="Trash2">Reset</Eyebrow>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-fg-3">
              Clears your profile and local history on this browser. Files already in the cloud are not deleted — use Vault → Wipe all for that.
            </p>
            <Button variant="destructive" icon="Trash2" onClick={doWipe} className="shrink-0">
              Reset this browser
            </Button>
          </div>
        </GlassPanel>
      </motion.div>
    </Page>
  );
}

function Eyebrow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-fg-3">
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0">{children}</div>;
}
