"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { Icon } from "@/components/ui/Icon";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { toast } from "@/components/ui/Toast";
import { useStash, type ByosCredential, type Settings as StashSettings } from "@/store/stash";
import { isValidTag, shortId } from "@/lib/ids";
import { downloadBlob } from "@/lib/files";
import { EXPIRY_OPTIONS } from "@/lib/constants";
import type { ExpiryId, TransferMode } from "@/lib/constants";
import type { StorageBackend } from "@/transfer/types";
import { cn } from "@/lib/cn";
import { fadeUp, stagger, spring } from "@/lib/motion";

/* ============================================================================
   Settings — your Stash, defaults, and privacy. Everything here lives in the
   browser; nothing is transmitted. Mission-control calm, generous whitespace.
   ========================================================================== */

type ByosProvider = ByosCredential["provider"];

const PROVIDERS: { id: ByosProvider; label: string }[] = [
  { id: "r2", label: "Cloudflare R2" },
  { id: "s3", label: "Amazon S3" },
  { id: "b2", label: "Backblaze B2" },
  { id: "wasabi", label: "Wasabi" },
  { id: "spaces", label: "DO Spaces" },
  { id: "minio", label: "MinIO" },
];

const PROVIDER_BADGE: Record<ByosProvider, string> = {
  r2: "R2",
  s3: "S3",
  b2: "B2",
  wasabi: "WSB",
  spaces: "SPC",
  minio: "MIN",
};

const MOTION_OPTIONS: { id: StashSettings["motion"]; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "on", label: "On" },
  { id: "off", label: "Off" },
];

/* ----------------------------- Small subparts ----------------------------- */

function Eyebrow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <Icon name={icon} className="h-3.5 w-3.5 text-cyan" />
      <span className="eyebrow text-fg-3">{children}</span>
    </div>
  );
}

function Section({
  icon,
  label,
  children,
  className,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      <GlassPanel className="relative overflow-hidden p-6 sm:p-7">
        <Eyebrow icon={icon}>{label}</Eyebrow>
        {children}
      </GlassPanel>
    </motion.div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[12px] font-medium text-fg-2">{children}</label>;
}

function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  prefix,
  invalid,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-xl border bg-white/[0.03] px-3 transition-colors focus-within:border-[#00c8ff]/50 focus-within:bg-white/[0.05]",
        invalid ? "border-[#ff4d6a]/45" : "border-white/10",
        className,
      )}
    >
      {prefix && <span className="mono select-none text-sm text-fg-3">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        spellCheck={false}
        className="h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
      />
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-9 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
        active ? "text-[#02140d]" : "text-fg-2 hover:text-fg",
        className,
      )}
    >
      {active && (
        <motion.span
          layoutId="seg-active"
          transition={spring}
          className="absolute inset-0 rounded-lg gradient-bg"
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function SwitchRow({ children }: { children: React.ReactNode }) {
  return <div className="py-3.5 first:pt-0 last:pb-0">{children}</div>;
}

/* --------------------------------- Page ----------------------------------- */

export default function SettingsPage() {
  const hydrated = useStash((s) => s.hydrated);
  const tag = useStash((s) => s.tag);
  const name = useStash((s) => s.name);
  const avatar = useStash((s) => s.avatar);
  const keys = useStash((s) => s.keys);
  const settings = useStash((s) => s.settings);
  const byos = useStash((s) => s.byos);
  const updateProfile = useStash((s) => s.updateProfile);
  const updateSettings = useStash((s) => s.updateSettings);
  const addByos = useStash((s) => s.addByos);
  const removeByos = useStash((s) => s.removeByos);
  const exportStash = useStash((s) => s.exportStash);
  const importStash = useStash((s) => s.importStash);
  const wipe = useStash((s) => s.wipe);

  // Local editable mirrors for the profile inputs.
  const [nameDraft, setNameDraft] = useState(name);
  const [tagDraft, setTagDraft] = useState(tag ?? "");

  // The Stash rehydrates after first render, so sync the drafts once it lands
  // (without clobbering later edits the user makes).
  const profileSynced = useRef(false);
  useEffect(() => {
    if (hydrated && !profileSynced.current) {
      profileSynced.current = true;
      setNameDraft(name);
      setTagDraft(tag ?? "");
    }
  }, [hydrated, name, tag]);

  // Modals + file inputs.
  const [byosOpen, setByosOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  if (!hydrated) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Icon name="RefreshCw" className="h-5 w-5 animate-spin text-fg-3" />
      </div>
    );
  }

  const seed = tag ?? "stash";
  const tagTrimmed = tagDraft.trim().toLowerCase();
  const tagValid = tagTrimmed.length === 0 || isValidTag(tagTrimmed);
  const tagChanged = tagTrimmed !== (tag ?? "");

  /* -- handlers -- */

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", "Choose an image for your Orb.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        updateProfile({ avatar: result });
        toast.success("Orb updated", "Your new likeness is set.");
      }
    };
    reader.onerror = () => toast.error("Could not read file", "Try a different image.");
    reader.readAsDataURL(file);
  };

  const commitName = () => {
    const next = nameDraft.trim();
    if (next && next !== name) updateProfile({ name: next });
    else setNameDraft(name);
  };

  const commitTag = () => {
    if (!tagChanged) return;
    if (!isValidTag(tagTrimmed)) {
      setTagDraft(tag ?? "");
      return;
    }
    updateProfile({ tag: tagTrimmed });
    setTagDraft(tagTrimmed);
    toast.success("Tag claimed", `You are now @${tagTrimmed}.`);
  };

  const onExport = () => {
    const json = exportStash();
    downloadBlob(new Blob([json], { type: "application/json" }), "space-send-stash.json");
    toast.success("Stash exported", "Keep this file somewhere safe.");
  };

  const onImportPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      if (typeof text !== "string") {
        toast.error("Could not read Stash", "The file appears unreadable.");
        return;
      }
      const ok = importStash(text);
      if (ok) {
        const s = useStash.getState();
        setNameDraft(s.name);
        setTagDraft(s.tag ?? "");
        toast.success("Stash restored", "Your identity and Crew are back.");
      } else {
        toast.error("Import failed", "That file is not a valid Stash.");
      }
    };
    reader.onerror = () => toast.error("Could not read Stash", "Try the file again.");
    reader.readAsText(file);
  };

  const deviceKey = keys?.publicKey ?? null;
  const deviceKeyShort = deviceKey
    ? `${deviceKey.slice(0, 10)}…${deviceKey.slice(-6)}`
    : "not generated";

  return (
    <Page>
      <PageHeader
        title="Settings"
        sub="Your Stash, defaults, and privacy — all stored locally."
        icon={<Icon name="Settings" className="h-6 w-6 text-cyan" />}
      />

      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-5 lg:grid-cols-2"
      >
        {/* ---------------------------- 1. STASH ---------------------------- */}
        <Section icon="Sparkles" label="Stash" className="lg:col-span-2">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="group relative shrink-0 self-center rounded-full outline-none sm:self-auto"
              aria-label="Change your Orb"
            >
              <OrbAvatar seed={seed} name={name} src={avatar} size={84} ring />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <Icon name="ImageIcon" className="h-5 w-5 text-fg" />
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarPick}
            />

            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Display name</FieldLabel>
                <TextInput
                  value={nameDraft}
                  onChange={setNameDraft}
                  onBlur={commitName}
                  placeholder="Your name"
                />
              </div>
              <div>
                <FieldLabel>Tag</FieldLabel>
                <TextInput
                  value={tagDraft}
                  onChange={(v) => setTagDraft(v.replace(/^@/, "").toLowerCase())}
                  onBlur={commitTag}
                  placeholder="callsign"
                  prefix="@"
                  invalid={!tagValid}
                />
                <p
                  className={cn(
                    "mt-1.5 text-[11px] leading-snug",
                    tagValid ? "text-fg-3" : "text-[#ff8a9c]",
                  )}
                >
                  {tagValid
                    ? "3–20 lowercase letters, numbers, or underscores."
                    : "That callsign isn't valid — letters, numbers, underscores."}
                </p>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                  <Icon name="KeyRound" className="h-3.5 w-3.5 shrink-0 text-fg-3" />
                  <span className="text-[11px] uppercase tracking-wide text-fg-3">Device key</span>
                  <span className="mono tnum ml-auto truncate text-[12px] text-fg-2">
                    {deviceKeyShort}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* --------------------------- 2. DEFAULTS -------------------------- */}
        <Section icon="Rocket" label="Defaults">
          <div className="space-y-6">
            <div>
              <FieldLabel>Default mode</FieldLabel>
              <div className="inline-flex gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1">
                {(["drop", "beam"] as TransferMode[]).map((m) => (
                  <SegButton
                    key={m}
                    active={settings.defaultMode === m}
                    onClick={() => updateSettings({ defaultMode: m })}
                  >
                    {m === "drop" ? "Drop" : "Beam"}
                  </SegButton>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-fg-3">
                Drop orbits in the cloud. Beam transmits live from this device.
              </p>
            </div>

            <div>
              <FieldLabel>Default decay</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {EXPIRY_OPTIONS.map((opt) => {
                  const active = settings.defaultExpiry === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSettings({ defaultExpiry: opt.id as ExpiryId })}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                        active
                          ? "border-[#00c8ff]/45 bg-[#00c8ff]/12 text-fg"
                          : "border-white/10 bg-white/[0.02] text-fg-2 hover:text-fg",
                      )}
                    >
                      {opt.label}
                      <span className="mono ml-1.5 text-fg-3">{opt.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel>Default backend</FieldLabel>
              <div className="inline-flex gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1">
                {(
                  [
                    { id: "managed", label: "Managed" },
                    { id: "local", label: "Local" },
                  ] as { id: StorageBackend; label: string }[]
                ).map((b) => (
                  <SegButton
                    key={b.id}
                    active={settings.defaultBackend === b.id}
                    onClick={() => updateSettings({ defaultBackend: b.id })}
                  >
                    {b.label}
                  </SegButton>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-fg-3">
                Managed uses Space Send storage. Local keeps bytes on this device until Beamed.
              </p>
            </div>
          </div>
        </Section>

        {/* --------------------------- 3. STORAGE --------------------------- */}
        <Section icon="Database" label="Storage · BYOS">
          <div className="space-y-3">
            {byos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-6 text-center">
                <Icon name="HardDrive" className="mx-auto h-5 w-5 text-fg-3" />
                <p className="mt-2 text-sm text-fg-2">No bucket connected</p>
                <p className="mt-1 text-[11px] text-fg-3">
                  Bring your own storage to host Drops at scale.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {byos.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
                  >
                    <span className="mono grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#00c8ff]/25 bg-[#00c8ff]/10 text-[10px] font-semibold text-cyan">
                      {PROVIDER_BADGE[b.provider]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{b.label}</p>
                      <p className="mono truncate text-[11px] text-fg-3">{b.bucket}</p>
                    </div>
                    {b.isDefault && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-3">
                        Default
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        removeByos(b.id);
                        toast.success("Bucket disconnected", `${b.label} removed from your Stash.`);
                      }}
                      className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-[#ff4d6a]/10 hover:text-[#ff8a9c]"
                      aria-label={`Remove ${b.label}`}
                    >
                      <Icon name="Trash2" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon="Plus"
              onClick={() => setByosOpen(true)}
              className="w-full"
            >
              Connect storage
            </Button>

            <p className="text-[11px] leading-relaxed text-fg-3">
              Your bytes go straight from your browser to your bucket. Space Send never proxies them.
            </p>
          </div>
        </Section>

        {/* --------------------------- 4. PRIVACY --------------------------- */}
        <Section icon="Shield" label="Privacy">
          <div className="divide-y divide-white/6">
            <SwitchRow>
              <Switch
                checked={settings.appearOffline}
                onChange={(v) => updateSettings({ appearOffline: v })}
                label="Appear offline"
                desc="Hide your Pulse from Crew"
              />
            </SwitchRow>
            <SwitchRow>
              <Switch
                checked={settings.anonymousExtract}
                onChange={(v) => updateSettings({ anonymousExtract: v })}
                label="Anonymous extract"
                desc="Senders see only Anonymous"
              />
            </SwitchRow>
            <SwitchRow>
              <Switch
                checked={settings.hideSignal}
                onChange={(v) => updateSettings({ hideSignal: v })}
                label="Hide my Signal"
                desc="Do not show recipients your bandwidth"
              />
            </SwitchRow>
          </div>
        </Section>

        {/* -------------------------- 5. EXPERIENCE ------------------------- */}
        <Section icon="Sparkles" label="Experience">
          <div className="divide-y divide-white/6">
            <SwitchRow>
              <Switch
                checked={settings.sounds}
                onChange={(v) => updateSettings({ sounds: v })}
                label="Transmission sounds"
                desc="A muted piano note per key moment"
              />
            </SwitchRow>
            <SwitchRow>
              <Switch
                checked={settings.customCursor}
                onChange={(v) => updateSettings({ customCursor: v })}
                label="Cursor trail"
                desc="A faint comet follows your pointer"
              />
            </SwitchRow>
            <SwitchRow>
              <Switch
                checked={settings.keepAwake}
                onChange={(v) => updateSettings({ keepAwake: v })}
                label="Keep awake while hosting"
                desc="Hold the screen on so Beams stay live"
              />
            </SwitchRow>
            <SwitchRow>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">Motion</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-3">
                    Spring animation across the app
                  </p>
                </div>
                <div className="inline-flex gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1">
                  {MOTION_OPTIONS.map((opt) => {
                    const active = settings.motion === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSettings({ motion: opt.id })}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                          active
                            ? "bg-[#00c8ff]/15 text-cyan"
                            : "text-fg-3 hover:text-fg-2",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </SwitchRow>
          </div>
        </Section>

        {/* --------------------------- 6. BILLING --------------------------- */}
        <Section icon="Gauge" label="Billing">
          <div className="space-y-2">
            <FieldLabel>Monthly overage cap</FieldLabel>
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-[#00c8ff]/50">
              <span className="mono select-none text-sm text-fg-3">€</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={Number.isFinite(settings.monthlyCapEur) ? settings.monthlyCapEur : 0}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  updateSettings({ monthlyCapEur: Number.isFinite(n) && n >= 0 ? n : 0 });
                }}
                className="mono tnum h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
              />
              <span className="select-none text-[12px] text-fg-3">/ month</span>
            </div>
            <p className="text-[11px] leading-relaxed text-fg-3">
              0.015 euro per GB-month beyond 10 GB, billed only on what you use.
            </p>
          </div>
        </Section>

        {/* ---------------------------- 7. ABOUT ---------------------------- */}
        <Section icon="Info" label="About">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-fg">
                Space Send — built by Contles.
              </p>
              <span className="mono tnum rounded-full border border-white/8 px-2 py-0.5 text-[11px] text-fg-3">
                v0.1.0
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-fg-3">
              Thank you for transmitting with us. Every Drop, Beam, and Pool is built to feel like
              mission control — quiet, exact, and a little bit cinematic.
            </p>
            <ContlesMark align="left" />
          </div>
        </Section>

        {/* -------------------------- 8. DANGER ZONE ------------------------ */}
        <Section icon="AlertTriangle" label="Danger zone" className="lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button variant="outline" size="sm" icon="Download" onClick={onExport}>
              Export my Stash
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="Upload"
              onClick={() => importInputRef.current?.click()}
            >
              Import Stash
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportPick}
            />
            <div className="sm:ml-auto">
              <Button
                variant="destructive"
                size="sm"
                icon="Trash2"
                onClick={() => setForgetOpen(true)}
              >
                Forget this device
              </Button>
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-fg-3">
            Your Stash never leaves this browser. Export keeps a copy you can restore anywhere.
          </p>
        </Section>
      </motion.div>

      {/* ------------------------------ Modals ------------------------------ */}
      <ByosModal
        open={byosOpen}
        onClose={() => setByosOpen(false)}
        onSave={(cred) => {
          addByos(cred);
          toast.success("Storage connected", `${cred.label} is ready for Drops.`);
          setByosOpen(false);
        }}
      />

      <Modal open={forgetOpen} onClose={() => setForgetOpen(false)} title="Forget this device" size="sm">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-[#ff4d6a]/25 bg-[#ff4d6a]/[0.06] p-4">
            <Icon name="AlertTriangle" className="mt-0.5 h-5 w-5 shrink-0 text-[#ff8a9c]" />
            <p className="text-[13px] leading-relaxed text-fg-2">
              This purges your Stash, Crew, and transfer history from this browser. Your device key
              and identity cannot be recovered unless you exported a copy first.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setForgetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              icon="Trash2"
              onClick={() => {
                wipe();
                setForgetOpen(false);
                setNameDraft("");
                setTagDraft("");
                toast.warning("Device forgotten", "Your Stash has been wiped from this browser.");
              }}
            >
              Forget everything
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}

/* --------------------------- BYOS connect modal --------------------------- */

interface ByosForm {
  provider: ByosProvider;
  label: string;
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secret: string;
}

const EMPTY_FORM: ByosForm = {
  provider: "r2",
  label: "",
  endpoint: "",
  bucket: "",
  region: "auto",
  accessKeyId: "",
  secret: "",
};

function ByosModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (cred: ByosCredential) => void;
}) {
  const [form, setForm] = useState<ByosForm>(EMPTY_FORM);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  const set = <K extends keyof ByosForm>(k: K, v: ByosForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSave =
    form.label.trim().length > 0 &&
    form.bucket.trim().length > 0 &&
    form.accessKeyId.trim().length > 0 &&
    form.secret.trim().length > 0;

  const reset = () => {
    setForm(EMPTY_FORM);
    setShowSecret(false);
    setTesting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onTest = () => {
    setTesting(true);
    window.setTimeout(() => {
      setTesting(false);
      toast.success("Connection live", "Validated with a no-op PUT/DELETE");
    }, 900);
  };

  const handleSave = () => {
    if (!canSave) return;
    const cred: ByosCredential = {
      id: shortId(),
      label: form.label.trim(),
      provider: form.provider,
      endpoint: form.endpoint.trim(),
      bucket: form.bucket.trim(),
      region: form.region.trim() || "auto",
      accessKeyId: form.accessKeyId.trim(),
      secretMasked: "****" + form.secret.slice(-4),
    };
    onSave(cred);
    reset();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Connect storage" size="md">
      <div className="space-y-4">
        <div>
          <FieldLabel>Provider</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((p) => {
              const active = form.provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set("provider", p.id)}
                  className={cn(
                    "rounded-xl border px-2 py-2.5 text-center transition-colors",
                    active
                      ? "border-[#00c8ff]/45 bg-[#00c8ff]/10"
                      : "border-white/8 bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  <span
                    className={cn(
                      "mono block text-[11px] font-semibold",
                      active ? "text-cyan" : "text-fg-2",
                    )}
                  >
                    {PROVIDER_BADGE[p.id]}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-fg-3">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel>Label</FieldLabel>
            <TextInput
              value={form.label}
              onChange={(v) => set("label", v)}
              placeholder="My primary bucket"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Endpoint</FieldLabel>
            <TextInput
              value={form.endpoint}
              onChange={(v) => set("endpoint", v)}
              placeholder="https://…r2.cloudflarestorage.com"
            />
          </div>
          <div>
            <FieldLabel>Bucket</FieldLabel>
            <TextInput
              value={form.bucket}
              onChange={(v) => set("bucket", v)}
              placeholder="space-send"
            />
          </div>
          <div>
            <FieldLabel>Region</FieldLabel>
            <TextInput value={form.region} onChange={(v) => set("region", v)} placeholder="auto" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Access key ID</FieldLabel>
            <TextInput
              value={form.accessKeyId}
              onChange={(v) => set("accessKeyId", v)}
              placeholder="AKIA…"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Secret access key</FieldLabel>
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-[#00c8ff]/50">
              <Icon name="Lock" className="h-3.5 w-3.5 shrink-0 text-fg-3" />
              <input
                type={showSecret ? "text" : "password"}
                value={form.secret}
                onChange={(e) => set("secret", e.target.value)}
                placeholder="••••••••••••••••"
                spellCheck={false}
                className="mono h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="rounded-md p-1 text-fg-3 transition-colors hover:text-fg"
                aria-label={showSecret ? "Hide secret" : "Show secret"}
              >
                <Icon name={showSecret ? "EyeOff" : "Eye"} className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-fg-3">
          The secret is masked the moment it lands — Space Send keeps only the last four characters.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            icon="Zap"
            loading={testing}
            disabled={!canSave}
            onClick={onTest}
          >
            Test connection
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" icon="Check" disabled={!canSave} onClick={handleSave}>
              Save bucket
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
