import { putBlob, getBlob, deleteDrop as idbDeleteDrop } from "./idb";
import { CLOUD_ORIGIN, dropFileUrl, dropManifestUrl, dropPurgeUrl, hasCloud } from "@/lib/site";
import type { DropRecord, FileMeta } from "./types";

/* ============================================================================
   Drop backend. Two modes:

   • Cloud (when NEXT_PUBLIC_SIGNAL_URL is set): bytes + manifest go to the
     shared Worker → Cloudflare R2 bucket, so Drop links open on any device.
   • Local (no env var): bytes go to IndexedDB so the cloud flow still works
     end-to-end inside one browser for dev / offline / static hosts.
   ========================================================================== */

export interface UploadProgress {
  fileId: string;
  loaded: number;
  total: number;
  speed: number;
}

const READ_CHUNK = 4 * 1024 * 1024;

/** Upload one file's bytes to the active backend with genuine read progress. */
export async function uploadFile(
  dropId: string,
  meta: FileMeta,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  const total = file.size;

  if (hasCloud()) {
    await uploadToCloud(dropId, meta, file, onProgress);
    onProgress?.({ fileId: meta.id, loaded: total, total, speed: 0 });
    return;
  }

  // Local IDB path — read in chunks for honest progress, then persist.
  let loaded = 0;
  let lastTime = Date.now();
  let lastLoaded = 0;
  let speed = 0;
  const parts: BlobPart[] = [];
  while (loaded < total) {
    const slice = file.slice(loaded, Math.min(loaded + READ_CHUNK, total));
    const buf = await slice.arrayBuffer();
    parts.push(buf);
    loaded += buf.byteLength;
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    if (dt > 0.1) {
      speed = (loaded - lastLoaded) / dt;
      lastTime = now;
      lastLoaded = loaded;
    }
    onProgress?.({ fileId: meta.id, loaded, total, speed });
    await new Promise((r) => setTimeout(r, 0));
  }
  const blob = new Blob(parts, { type: meta.mime });
  await putBlob(dropId, meta.id, blob);
  onProgress?.({ fileId: meta.id, loaded: total, total, speed });
}

/** Cloud upload via XMLHttpRequest to get real upload progress events. */
function uploadToCloud(
  dropId: string,
  meta: FileMeta,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", dropFileUrl(dropId, meta.id));
    xhr.setRequestHeader("x-content-type", meta.mime || "application/octet-stream");
    const started = Date.now();
    let lastLoaded = 0;
    let lastTime = started;
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      let speed = 0;
      if (dt > 0.1) {
        speed = (e.loaded - lastLoaded) / dt;
        lastLoaded = e.loaded;
        lastTime = now;
      }
      onProgress?.({ fileId: meta.id, loaded: e.loaded, total: e.total, speed });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export async function putManifest(record: DropRecord): Promise<void> {
  if (!hasCloud()) return;
  const res = await fetch(dropManifestUrl(record.id), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Manifest upload failed: ${res.status}`);
}

export async function fetchManifest(dropId: string): Promise<DropRecord | null> {
  if (!CLOUD_ORIGIN) return null;
  try {
    const res = await fetch(dropManifestUrl(dropId));
    if (!res.ok) return null;
    return (await res.json()) as DropRecord;
  } catch {
    return null;
  }
}

export async function getDropFile(dropId: string, fileId: string): Promise<Blob | undefined> {
  // Try local first — sender side, or recipient who already has it cached.
  const local = await getBlob(dropId, fileId);
  if (local) return local;
  if (!CLOUD_ORIGIN) return undefined;
  try {
    const res = await fetch(dropFileUrl(dropId, fileId));
    if (!res.ok) return undefined;
    return await res.blob();
  } catch {
    return undefined;
  }
}

export async function purgeDrop(dropId: string): Promise<void> {
  await idbDeleteDrop(dropId);
  if (!hasCloud()) return;
  try {
    await fetch(dropPurgeUrl(dropId), { method: "DELETE" });
  } catch {
    /* best effort */
  }
}
