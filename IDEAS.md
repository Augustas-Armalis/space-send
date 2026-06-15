# Space Send — Idea backlog

A scratchpad for ideas to turn into future prompts. Drop raw thoughts here;
each block below is written so it can be handed to Claude as a self-contained
build prompt later.

---

## 1. Resumable downloads on the receiver

**Goal:** If a Beam download is interrupted (connection lost, host's tab closed,
viewer navigates away), the receiver keeps what it already downloaded and can
**resume** later instead of starting over.

**Sketch:**
- As chunks arrive, the receiver writes them to a persistent store keyed by
  `(beamId, fileId)` — either:
  - the **File System Access API** writable stream (desktop) that stays on disk
    in a chosen folder, partially written and resumable, or
  - **IndexedDB / Origin Private File System** chunks for browsers without the
    save-picker.
- Persist a small manifest: `{ beamId, fileId, name, size, receivedBytes }`.
- On reconnect to the same Beam link (same path id), the receiver tells the host
  `resume from byte N`, and `streamTo` seeks to that offset instead of 0.
- A "Resume" tray on the viewer page lists partially-downloaded files with a
  progress bar and a **Continue** button; completed-but-unsaved files can be
  re-assembled and saved.
- Wire protocol additions: `extract` carries an optional `fromByte`; the host's
  `file-begin` echoes the start offset.

**Why it's nice:** big-file transfers over flaky links become reliable; "come
back later and finish" works.

---

## 2. Keep running in the background (display off / other tab)

**Goal:** Whether you're the **tower** (host) or a **receiver**, the transfer
keeps going when the screen turns off or you switch to another tab/site — it
only stops when that specific tab is closed.

**Sketch:**
- Browsers throttle timers in backgrounded tabs but **WebRTC data channels keep
  flowing**, so the core transfer largely continues. The work is making the
  *driving loop* not depend on throttled timers.
- Request a **Wake Lock** while a transfer is active (already wired via
  `preventSleep()` for hosting — extend to the receiver while downloading).
- Move the chunk pump so it's driven by the data channel's `bufferedamountlow`
  event (event-driven) rather than `setTimeout`, so background throttling
  doesn't stall it.
- Consider a **SharedWorker / dedicated Worker** that owns the RTCPeerConnection
  so the transfer survives even if the visible tab is hidden (the worker isn't
  throttled the same way). This is the robust version.
- Show a small "transfer running in background" affordance and an audible/visual
  ping on completion.

**Caveats to call out:** iOS Safari is aggressive about suspending background
tabs; treat mobile-host background mode as best-effort.

---

## 3. Auto-save received files to a folder (bash/computer side)

**Goal:** When receiving on your own computer, downloaded files (whole or the
parts that made it) land **directly in a folder** ("ready to resume / see /
continue"), no manual Save dialog per file.

**Sketch:**
- Desktop: use `showDirectoryPicker()` once to grant a target folder, then write
  every file (and partial file) straight into it via the File System Access API.
  Remember the directory handle (IndexedDB) so future Beams reuse it without
  re-prompting.
- Pairs naturally with idea #1 (resume) — partial files live in that folder with
  a sidecar `.part` manifest until complete.
- Optional: a tiny companion CLI/agent for true "lands in your bash" behaviour
  (a local helper the browser posts to) — only if the File System Access API
  isn't enough.

---

## 4. (Done — keeping for reference) Dedicated Tower page

Separate operator page with its own link, per-recipient % downloaded, live
bitrate, and actions. See `/tower` route. Future polish ideas:
- Per-recipient **pause/resume** and **priority** (serve one viewer faster).
- A shareable **read-only tower view** (watchers who see stats but can't act).
- Sound/notification when a recipient completes.

---

## 5. Misc / parking lot
- Multiple parallel data channels per peer for even higher throughput (needs
  per-chunk sequence numbers for reassembly).
- TURN over TCP/443 fallback already added; consider a paid/private TURN for
  guaranteed cross-network speed.
- Optional end-to-end password on a Beam (PAKE over the data channel).
