/* ============================================================================
   Space Send — brand constants, named vocabulary & copy dictionary.
   Voice: mission control. Calm, precise, slightly cinematic.
   "Beam locked" not "Connected!".  No exclamation marks in errors. No emoji.
   ========================================================================== */

export const BRAND = {
  name: "Space Send",
  tagline: "Transmit anything. Instantly.",
  taglineAlts: ["Your files. Launched.", "Drop it into orbit.", "Signal sent."],
  builtBy: "Contles",
  builtByUrl: "https://contles.com/?ref=spacesend",
  domain: "spacesend.app",
} as const;

/** The signature gradient stops, green → blue, in order. Never reverse. */
export const GRADIENT_STOPS = ["#00FF88", "#00E5C8", "#00C8FF", "#0099FF"] as const;
export const GRADIENT_CSS = "linear-gradient(135deg, #00FF88, #00E5C8 38%, #00C8FF 68%, #0099FF)";

/** Per-role accent — pick the nearest stop to the element's role. */
export const ROLE_COLOR = {
  orbCore: "#00E5C8",
  orbInner: "#00FF88",
  pulse: "#00C8FF",
  signal: "#0099FF",
  verify: "#00C8FF",
} as const;

export type TransferMode = "drop" | "beam";

export const EXPIRY_OPTIONS = [
  { id: "24h", label: "24 orbits", sub: "(24h)", ms: 24 * 3600_000 },
  { id: "7d", label: "7 cycles", sub: "(7d)", ms: 7 * 24 * 3600_000 },
  { id: "30d", label: "30 cycles", sub: "(30d)", ms: 30 * 24 * 3600_000 },
  { id: "never", label: "Never", sub: "(∞)", ms: null },
] as const;

export type ExpiryId = (typeof EXPIRY_OPTIONS)[number]["id"];

export const BEAM_DURATIONS = [
  { id: "until", label: "Until extracted", sub: "Closes after pickup", ms: null },
  { id: "15m", label: "15 minutes", sub: "(15m)", ms: 15 * 60_000 },
  { id: "1h", label: "1 hour", sub: "(1h)", ms: 3600_000 },
  { id: "6h", label: "6 hours", sub: "(6h)", ms: 6 * 3600_000 },
  { id: "24h", label: "24 hours", sub: "(24h)", ms: 24 * 3600_000 },
  { id: "open", label: "Keep open", sub: "Until you stop", ms: -1 },
] as const;

export const MANAGED_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB free tier
export const FREE_PER_FILE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB per file (Drop, via multipart)

/** The product's whole vocabulary — surfaced everywhere. */
export const VOCAB = {
  orb: "Orb",
  drop: "Drop",
  beam: "Beam",
  stage: "Stage",
  extract: "Extract",
  ask: "Ask",
  pool: "Pool",
  crew: "Crew",
  constellation: "Constellation",
  project: "Project",
  vault: "Vault",
  trail: "Trail",
  tag: "Tag",
  aurora: "Aurora",
  pulse: "Pulse",
  spark: "Spark",
  signal: "Signal",
  vector: "Vector",
  probe: "Probe",
  stash: "Stash",
  echo: "Echo",
} as const;

/** Exact recipient-facing copy — from the brief, verbatim. */
export const COPY = {
  dropZoneEmpty: "Drop files into the void.",
  dropZoneSub: (limit: string) => `Or tap to select — anything up to ${limit} per file.`,
  releaseBeam: "Release to Stage.",
  releaseDrop: "Release to Drop.",
  ctaGetLink: "Get your link",
  modeDrop: "Drop",
  modeBeam: "Beam",
  modeTooltip: "Drop: files orbit in the cloud. Beam: transmit live from this device.",
  messagePlaceholder: "Add a transmission note…",
  expiryLabel: "Orbit decays in",
  transmissionReady: "Transmission ready.",
  transmissionReadySub: "Share this link — anyone with it can extract your files.",
  qrLabel: "Scan to extract",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  newTransmission: "New transmission",
  // Beam sender
  staged: "Staged. Awaiting signal.",
  stagedSub: "Share the link — your device transmits the moment someone Extracts.",
  awaitingExtract: "Awaiting Extract…",
  // Recipient
  extract: "Extract",
  extractAll: "Extract all",
  establishingSignal: "Establishing signal…",
  signalLocked: "Signal locked. Extracting.",
  inspectBefore: "Inspect before extracting",
  verified: "Transmission verified",
  allExtracted: "All files extracted.",
  transmissionComplete: "Transmission complete.",
  saveToDevice: "Save to device",
  // Errors / empty (no exclamation marks, no apologies)
  expiredTitle: "This transmission has ended.",
  expiredSub: "The files have left orbit. Ask the sender to Drop again.",
  hostOfflineTitle: "Signal lost.",
  hostOfflineSub:
    "The sender's device is offline. Beams require the host to be live — try again when they're back, or ask for a Drop instead.",
  interrupted: "Signal interrupted — resuming.",
  severed: (n: number) => `Beam severed at ${n}%.`,
  resumeExtraction: "Resume extraction",
  invalidTitle: "Nothing here.",
  invalidSub: "This link doesn't match any known transmission. It may have expired, or been mistyped.",
  vaultFullTitle: "Vault at capacity.",
  vaultFullSub: "The sender's storage is full. They'll need to clear orbit before Dropping more files.",
  lockedTitle: "This transmission is locked.",
  lockedPlaceholder: "Enter access code",
  unlock: "Unlock",
  accessDeniedTitle: "Access denied.",
  accessDeniedSub: "That code doesn't match. Try again.",
} as const;

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string; // lucide icon name
}

export const NAV: NavItem[] = [
  { id: "send", label: "Send", href: "/", icon: "Rocket" },
  { id: "vault", label: "Vault", href: "/vault", icon: "Database" },
  { id: "beams", label: "Beams", href: "/beams", icon: "Radio" },
  { id: "pools", label: "Pools", href: "/pools", icon: "Waves" },
  { id: "settings", label: "Settings", href: "/settings", icon: "Settings" },
];

/** Mobile bottom-tab subset. */
export const MOBILE_NAV: NavItem[] = [
  { id: "send", label: "Send", href: "/", icon: "Rocket" },
  { id: "vault", label: "Vault", href: "/vault", icon: "Database" },
  { id: "beams", label: "Beams", href: "/beams", icon: "Radio" },
  { id: "pools", label: "Pools", href: "/pools", icon: "Waves" },
];
