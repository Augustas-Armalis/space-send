<div align="center">

# Space Send

### Transmit anything. Instantly.

A next-gen file transfer, reimagined. Drop files into the cloud or **Beam** them live —
peer-to-peer, straight from your device. No login. End-to-end encrypted. Mission-control aesthetic.

**Built by [Contles](https://contles.com/?ref=spacesend).**

</div>

---

## What this is

Space Send is WeTransfer's elegance rebuilt from scratch with a darker aesthetic, a no-login
philosophy, and **two radically different transfer modes**:

- **Drop** — a cloud transfer. Files leave your device, land in your **Vault**, and a link
  materializes. Zero wait for the recipient.
- **Beam** — a live peer-to-peer session over WebRTC. *Your device becomes the signal tower*;
  data streams directly to whoever has the link. No cloud, no upload wait, DTLS-encrypted.

Everything is local-first: your identity (**Stash**), your contacts (**Crew**), and your history
(**Trail**) live only in your browser. There are no accounts, no passwords, no email.

This repository is a **fully runnable web app** plus the scaffolding for the cloud signaling
Worker and the macOS (Tauri) shell.

---

## Run it — the easy way (no terminal)

In Finder, open the **Space Send** folder and **double-click one of these**:

- **`Space Send.app`** — a real app icon. Double-click it (or drag it to your Dock). It starts the
  app and opens your browser automatically.
- **`Start Space Send.command`** — same thing, shown in a Terminal window so you can see what's
  happening. First run installs dependencies (takes a minute); after that it's instant.
- **`Stop Space Send.command`** — shuts the app down when you're done.

These launchers find Node.js for you — which is why plain `npm` in a fresh Terminal said
*"command not found"*: your Node was installed with **nvm**, which isn't on the PATH unless your
shell loads it. The launchers handle that automatically.

> First time only: if macOS asks, right-click `Space Send.app` → **Open** → **Open** to confirm.

## Quick start (terminal)

```bash
npm install
npm run dev
# open http://localhost:3000
```

First launch walks you through a 4-step onboarding (pick a **Tag**, generate a device key pair),
then drops you on the send screen. That's it.

> If `npm` says *"command not found"* in your terminal, load nvm first:
> `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"` — or just use the double-click
> launchers above, which do this for you.

```bash
npm run build     # production build (all 16 routes)
npm run start     # serve the production build
npm run typecheck # tsc --noEmit, strict
```

### What works out of the box (zero config)

| Flow | Status | Notes |
|---|---|---|
| Onboarding + local **Stash** | ✅ | Ed25519 device key via WebCrypto, stored in `localStorage` |
| **Drop** (cloud) end-to-end | ✅ | Bytes persisted to **IndexedDB** as the local storage backend |
| Recipient **Extract** + SHA-256 verify | ✅ | Real chunked read, hash check, file download |
| **Beam** (live P2P) between two tabs | ✅ | Real `RTCPeerConnection` + BroadcastChannel signaling |
| Vault, Beams, Pools, Crew, Constellation, Trail, Settings, Ask | ✅ | Fully built + animated |
| All link controls (password, burn-after, expiry, E2E toggle) | ✅ | Wired into the share flow |

### What needs a service to go cross-device / production

| Capability | How to enable |
|---|---|
| **Beam across different devices/networks** | Deploy `packages/signaling-worker` and set `NEXT_PUBLIC_SIGNAL_URL` (see below). STUN is built in; add TURN for hostile NATs. |
| **Drop across different browsers/devices** | Swap the IndexedDB backend for Cloudflare R2 / S3 presigned uploads. The `StorageBackend` surface (`src/transfer/drop.ts`) is intentionally identical — replace `putBlob`/`getBlob`. |
| **Pay-as-you-go storage** | Wire Stripe metered billing (architecture documented inline; gated behind a `BETA_UNLOCK_ALL` flag concept). |
| **macOS app** | Build `apps/desktop` with the Tauri CLI + Rust toolchain. |

> The local demo is honest: a Drop's bytes live in *your* browser's IndexedDB, so the recipient
> link works in the **same browser** (e.g. a second tab). Cross-device Drop is one storage-adapter
> swap away. Beam already works cross-device the moment the signaling Worker is deployed.

---

## Project structure

```
.
├── src/
│   ├── app/
│   │   ├── (app)/                 # In-app screens (wrapped in the nav shell)
│   │   │   ├── page.tsx           # Landing + Send (the primary upload surface)
│   │   │   ├── vault, beams, pools, crew, constellation, trail, settings, ask, about, privacy
│   │   ├── r/[id]/                # Drop recipient (Extract)
│   │   ├── x/[id]/                # Beam recipient (live Extract over WebRTC)
│   │   ├── u/[id]/                # Ask — public upload page
│   │   ├── pool/[id]/             # Public Pool view
│   │   ├── layout.tsx             # Root: fonts, metadata, global Providers
│   │   └── globals.css            # The entire design system (tokens, glass, gradient, keyframes)
│   ├── components/
│   │   ├── brand/                 # Orb, Starfield, AuroraRibbon, Wordmark, ContlesMark
│   │   ├── ui/                    # GlassPanel, MagneticButton, StorageRing, FileCard, …
│   │   ├── shell/                 # AppShell (sidebar/tabs), Providers, CursorTrail, EasterEggs
│   │   ├── send/                  # useSend controller, SendComposer, ShareCard
│   │   ├── recipient/             # Shared recipient UI
│   │   └── onboarding/            # First-launch flow
│   ├── transfer/                  # The engine: types, beam (WebRTC), drop (IDB), signaling, idb
│   ├── store/                     # Zustand: stash (profile/crew), transfers (vault/beams/…), ui
│   └── lib/                       # format, hash, crypto, ids, files, avatar, constants, motion, desktop
├── packages/signaling-worker/     # Cloudflare Worker + Durable Object (SDP/ICE relay)
└── apps/desktop/                  # Tauri 2 macOS shell (loads the same web UI)
```

> The brief calls for a Turborepo (`apps/web`, `apps/desktop`, `packages/*`). Here the web app
> lives at the repo root for a frictionless `npm run dev`; the worker and desktop shell sit under
> `packages/` and `apps/` so the split maps cleanly when you formalize the monorepo.

---

## The signaling Worker (cross-device Beams)

A tiny Cloudflare Worker + Durable Object brokers WebRTC offers/answers/ICE. **No file bytes ever
pass through it** — it only relays signaling JSON, one Durable Object "room" per Beam id.

```bash
cd packages/signaling-worker
npm install
npx wrangler deploy
```

Then point the web app at it:

```bash
# .env.local
NEXT_PUBLIC_SIGNAL_URL=wss://space-send-signaling.<your-account>.workers.dev
```

With no `NEXT_PUBLIC_SIGNAL_URL` set, the app falls back to **BroadcastChannel** signaling, which
powers the local two-tab Beam demo with real peer connections.

For peers behind strict NATs, add a TURN relay (e.g. Metered.ca free tier):

```bash
NEXT_PUBLIC_TURN_URL=turn:...
NEXT_PUBLIC_TURN_USER=...
NEXT_PUBLIC_TURN_CRED=...
```

---

## The macOS app (Tauri 2)

`apps/desktop` is a Tauri 2 shell that loads the **same** web UI and adds native superpowers —
the signature one being **prevent-sleep while hosting a Beam** (via `caffeinate`), plus native
notifications and file dialogs.

```bash
# Requires the Rust toolchain + Tauri CLI
cd apps/desktop
npm install
npm run tauri dev      # loads http://localhost:3000
npm run tauri build    # produces a .dmg
```

The web app calls native commands through `window.__TAURI__` (`withGlobalTauri: true`), so it needs
**zero** `@tauri-apps` dependencies — see `src/lib/desktop.ts`, which no-ops on the web and
lights up inside the shell. A Windows/Linux build is a config change away.

---

## Publish to GitHub Pages

This repo ships a static-export setup and a GitHub Actions workflow
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) that builds and deploys on every
push to `main`. Share links use query params (`/r/?d=…`, `/x/?b=…#key`, `/u/?a=…`, `/pool/?p=…`)
so every page resolves on a server-less static host.

**One-time setup:**

```bash
# 1. Create a repo on github.com (e.g. "space-send"), then:
git add -A
git commit -m "Space Send"
git branch -M main
git remote add origin https://github.com/<you>/space-send.git
git push -u origin main
```

```text
# 2. On github.com → your repo → Settings → Pages →
#    "Build and deployment" → Source: GitHub Actions.
```

That's it. The Action builds and publishes; your site goes live at
**`https://<you>.github.io/space-send/`** in ~2 minutes. Every future `git push` redeploys.

> The workflow auto-derives the base path from the repo name. If you instead name the repo
> `<you>.github.io` (a root user-site), set both `PAGES_BASE_PATH` and `NEXT_PUBLIC_BASE_PATH` to
> `""` in the workflow.

**What works on the live static site:**

| | Status on GitHub Pages |
|---|---|
| The full UI, onboarding, Stash, Crew, Constellation, Vault, Settings, Trail | ✅ Fully working |
| **Beam** between two tabs on the same machine | ✅ Works (BroadcastChannel) |
| **Beam** across different devices | ✅ once you deploy the free signaling Worker (below) and add the `NEXT_PUBLIC_SIGNAL_URL` repo secret |
| **Drop** opened in the same browser | ✅ Works (IndexedDB) |
| **Drop** opened on a *different* device | ⚠️ Needs cloud storage (R2/S3) — bytes live in the sender's browser; swap the storage adapter to enable |

To unlock cross-device **Beam** (the headline feature), deploy the Worker and add the secret:

```bash
cd packages/signaling-worker && npm install && npx wrangler deploy
# Then: GitHub repo → Settings → Secrets and variables → Actions → New secret
#   Name:  NEXT_PUBLIC_SIGNAL_URL
#   Value: wss://space-send-signaling.<your-account>.workers.dev
# Re-run the deploy workflow (push any commit) and Beams work device-to-device.
```

### Other hosts

The same app deploys to **Vercel**, **Netlify**, or **Cloudflare Pages** with zero config
(`npm run build`, no `GITHUB_PAGES` env) — those keep server features and don't need the static
export. Cloudflare is the natural long-term home: Pages + Workers (signaling) + R2 (storage) all on
one free account.

---

## Security & privacy

- **Beams are end-to-end encrypted** by default — WebRTC data channels are DTLS-encrypted, and the
  per-session key lives in the URL hash fragment (`/x/{id}#{key}`), which never reaches any server.
- **Drops** offer an optional E2E toggle; with it on, ciphertext is all the backend ever sees.
- **Password protection** uses PBKDF2 (210k iterations).
- **SHA-256 integrity** on every file, verified on the recipient end (the cyan ✓).
- **Minimal metadata** — no IP logs beyond edge abuse protection, no UA storage, no fingerprinting.
- Strict security headers are configured in `next.config.mjs`.

---

## The language of Space Send

Orb · Drop · Beam · Stage · Extract · Ask · Pool · Crew · Constellation · Project · Vault · Trail ·
Tag · Aurora · Pulse · Spark · Signal · Vector · Probe · Stash · Echo.

The product speaks like calm mission control — *"Beam locked"*, not *"Connected!"*. See
`src/lib/constants.ts` for the full copy dictionary, and `/about` in the running app for the
vocabulary in context.

---

## Tech

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Framer Motion ·
Zustand · WebRTC · WebCrypto (Ed25519, AES-GCM, PBKDF2, SHA-256) · Cloudflare Workers + Durable
Objects · Tauri 2.

---

<div align="center">

Made with restraint. **Built by [Contles](https://contles.com/?ref=spacesend).**

</div>
