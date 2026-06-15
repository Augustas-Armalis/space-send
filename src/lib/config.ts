/* ============================================================================
   Public runtime config — Space Send is an internal tool, so everything here
   is intentionally baked into the client. No secrets live in the Worker URL:
   it only relays WebRTC handshakes (Beam) and stores share-link blobs (Drop)
   behind unguessable ids. Hardcoding it means cross-device Beam and Drop work
   on the static GitHub Pages build with zero environment configuration.

   To point at a different Worker, either edit SIGNAL_URL below or set
   NEXT_PUBLIC_SIGNAL_URL at build time (the env var wins).
   ========================================================================== */

/** The deployed signaling + storage Worker (wss:// for the WebSocket). */
const HARDCODED_SIGNAL_URL = "wss://space-send-signaling.spacesend.workers.dev";

/** Resolved Worker WebSocket URL — env override first, then the baked-in value. */
export const SIGNAL_URL: string =
  process.env.NEXT_PUBLIC_SIGNAL_URL || HARDCODED_SIGNAL_URL;

/** https:// origin of the same Worker, for blob/manifest fetches over HTTP. */
export const CLOUD_ORIGIN: string = SIGNAL_URL
  .replace(/^wss:\/\//, "https://")
  .replace(/^ws:\/\//, "http://")
  .replace(/\/$/, "");

/** Whether a cloud backend is configured at all (always true with a hardcoded
 *  URL, but kept as a flag so a blank override cleanly disables cloud). */
export const HAS_CLOUD: boolean = SIGNAL_URL.length > 0;

/* Optional TURN relay for peers behind hostile NATs (corporate / some mobile
   carriers). Leave blank to rely on STUN only, which covers most networks. */
export const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL || "";
export const TURN_USER = process.env.NEXT_PUBLIC_TURN_USER || "";
export const TURN_CRED = process.env.NEXT_PUBLIC_TURN_CRED || "";
