# Space Send — macOS (Tauri 2)

A native shell around the **same** Space Send web UI, with native superpowers bolted on.

## Native capabilities

- **Prevent-sleep while hosting a Beam** — `prevent_sleep` / `allow_sleep` commands spawn and kill
  macOS `caffeinate -dimsu`, so a live session survives the lid action and idle timer. The web app
  calls these automatically when a Beam starts/ends (`src/lib/desktop.ts`).
- **Native notifications & file dialogs** — via `tauri-plugin-notification` and `tauri-plugin-dialog`.
- **Transparent, overlay-titlebar window** — matches the deep-space chrome.
- Structured so a **Windows/Linux** build is just a config change.

## Prerequisites

- [Rust toolchain](https://rustup.rs)
- Tauri 2 system deps (Xcode Command Line Tools on macOS)

## Develop & build

```bash
npm install

# Dev — boots the Next dev server (port 3000) and opens the native window
npm run tauri dev

# Production .dmg — runs `next build` then bundles
npm run tauri build
```

## Notes

- The window loads `http://localhost:3000` in dev (`devUrl`) and the built web output in production
  (`frontendDist` → repo-root build). Because the recipient routes are client-rendered, you can
  alternatively point the production window at the hosted `spacesend.app`.
- App icons: run `npm run tauri icon path/to/1024.png` to generate the `icons/` set
  (`icon.icns`, `icon.png`, …) referenced by `tauri.conf.json`.
- **Code signing & notarization**: set `bundle.macOS.signingIdentity` to your Developer ID and add
  notarization to your CI. The placeholder identity `-` produces an unsigned local build.
