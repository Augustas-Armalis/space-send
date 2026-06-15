/* Link building. We use query-param routes (/r/?d=…, /x/?b=…#key, /u/?a=…,
   /pool/?p=…) instead of path segments so every share link resolves on a purely
   static host like GitHub Pages — no server, no per-id prerender needed.

   BASE_PATH supports project-page hosting (e.g. github.io/<repo>/). It is set at
   build time via NEXT_PUBLIC_BASE_PATH and mirrors next.config's basePath. */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function abs(path: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${BASE_PATH}${path}`;
}

/** Absolute links — for clipboard, QR codes, native share. */
export const dropLink = (id: string) => abs(`/r/?d=${id}`);
export const beamLink = (id: string, key = "") => abs(`/x/?b=${id}${key ? `#${key}` : ""}`);
export const askLink = (id: string) => abs(`/u/?a=${id}`);
export const poolLink = (id: string) => abs(`/pool/?p=${id}`);

/** Internal hrefs for next/link + router.push — Next prepends basePath itself,
    so these must NOT include BASE_PATH. */
export const poolHref = (id: string) => `/pool/?p=${id}`;
export const beamHref = (id: string) => `/x/?b=${id}`;

/* ============================================================================
   Cloud backend (signaling + R2 storage). Both endpoints live on the same
   Cloudflare Worker host — see src/lib/config.ts for the hardcoded URL.
   ========================================================================== */

import { CLOUD_ORIGIN, HAS_CLOUD } from "./config";

export { CLOUD_ORIGIN };

export const hasCloud = (): boolean => HAS_CLOUD;

export const dropManifestUrl = (dropId: string) => `${CLOUD_ORIGIN}/drop/${dropId}/manifest`;
export const dropFileUrl = (dropId: string, fileId: string) => `${CLOUD_ORIGIN}/drop/${dropId}/file/${fileId}`;
export const dropPurgeUrl = (dropId: string) => `${CLOUD_ORIGIN}/drop/${dropId}`;
