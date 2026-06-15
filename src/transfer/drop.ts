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
// Files at/above this go through R2 multipart (90 MB parts) so they don't hit
// the Worker's ~100 MB single-request body limit. Smaller files use one PUT.
const MULTIPART_THRESHOLD = 90 * 1024 * 1024;
const PART_SIZE = 90 * 1024 * 1024;

/** Upload one file's bytes to the active backend with genuine read progress. */
export async function uploadFile(
  dropId: string,
  meta: FileMeta,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  const total = file.size;

  if (hasCloud()) {
    if (file.size >= MULTIPART_THRESHOLD) {
      await uploadMultipart(dropId, meta, file, onProgress);
    } else {
      await uploadToCloud(dropId, meta, file, onProgress);
    }
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

/** Single-PUT cloud upload via XMLHttpRequest for real upload progress. */
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
    xhr.setRequestHeader("x-file-name", encodeURIComponent(meta.name));
    // Scale the timeout to file size (assume a pessimistic ~0.5 MB/s floor) so
    // a slow connection on a big-ish file doesn't get killed mid-flight.
    xhr.timeout = Math.max(60_000, (file.size / (0.5 * 1024 * 1024)) * 1000);
    let lastLoaded = 0;
    let lastTime = Date.now();
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
      else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText);
          if (j.message) msg = j.message;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
}

/** Multipart upload for large files — splits into 90 MB parts so each request
 *  stays under the Worker's body limit. Aggregates progress across parts. */
async function uploadMultipart(
  dropId: string,
  meta: FileMeta,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  const base = `${CLOUD_ORIGIN}/drop/${dropId}/file/${meta.id}/mpu`;
  // 1. Create
  const createRes = await fetch(base, {
    method: "POST",
    headers: {
      "x-total-size": String(file.size),
      "x-file-name": encodeURIComponent(meta.name),
      "x-content-type": meta.mime || "application/octet-stream",
    },
  });
  if (!createRes.ok) {
    let msg = `Couldn't start upload (${createRes.status})`;
    try {
      const j = await createRes.json();
      if (j.message) msg = j.message;
    } catch {
      /* keep */
    }
    throw new Error(msg);
  }
  const { uploadId } = (await createRes.json()) as { uploadId: string };

  // 2. Upload parts sequentially with aggregated progress.
  const partCount = Math.ceil(file.size / PART_SIZE);
  const parts: { partNumber: number; etag: string }[] = [];
  let uploadedBytes = 0;
  let lastTime = Date.now();
  let lastBytes = 0;
  try {
    for (let i = 0; i < partCount; i++) {
      const start = i * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const blob = file.slice(start, end);
      const partBase = uploadedBytes;
      const etag = await putPart(`${base}/${uploadId}/${i + 1}`, blob, (loadedInPart) => {
        const now = Date.now();
        const dt = (now - lastTime) / 1000;
        const total = partBase + loadedInPart;
        let speed = 0;
        if (dt > 0.3) {
          speed = (total - lastBytes) / dt;
          lastBytes = total;
          lastTime = now;
        }
        onProgress?.({ fileId: meta.id, loaded: total, total: file.size, speed });
      });
      parts.push({ partNumber: i + 1, etag });
      uploadedBytes = end;
      onProgress?.({ fileId: meta.id, loaded: uploadedBytes, total: file.size, speed: 0 });
    }
  } catch (e) {
    // Roll back the multipart so the reservation is released.
    try {
      await fetch(`${base}/${uploadId}?size=${file.size}`, { method: "DELETE" });
    } catch {
      /* best effort */
    }
    throw e;
  }

  // 3. Complete
  const done = await fetch(`${base}/${uploadId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parts }),
  });
  if (!done.ok) throw new Error(`Couldn't finalize upload (${done.status})`);
}

function putPart(url: string, blob: Blob, onPart: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = Math.max(120_000, (blob.size / (0.5 * 1024 * 1024)) * 1000);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPart(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText).etag);
        } catch {
          reject(new Error("Bad part response"));
        }
      } else reject(new Error(`Part upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Part upload timed out"));
    xhr.send(blob);
  });
}

/** Upload the manifest to R2 with retries. The manifest is what makes the
 *  share link work for anyone other than the sender — if it doesn't land, the
 *  recipient page can't find the Drop. So this RETRIES 3x with backoff and
 *  THROWS if it ultimately fails, instead of silently swallowing the error. */
export async function putManifest(record: DropRecord, signal?: AbortSignal): Promise<void> {
  if (!hasCloud()) return;
  // Slim the manifest before it goes to R2. The big offender is a base64
  // avatar data URL in `sender.avatar` (can be hundreds of KB) — recipients
  // render initials, so we never ship the image. We also drop any local-only
  // bookkeeping that a recipient on another device doesn't need.
  const lean: DropRecord = {
    ...record,
    sender: record.sender
      ? {
          tag: record.sender.tag ?? null,
          name: record.sender.name ?? "",
          avatar: record.sender.avatar && record.sender.avatar.startsWith("data:") ? null : record.sender.avatar ?? null,
        }
      : record.sender,
  };
  const body = JSON.stringify(lean);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(dropManifestUrl(record.id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
        signal,
      });
      if (res.ok) return;
      lastErr = new Error(`Manifest upload failed: ${res.status} ${await res.text()}`);
    } catch (e) {
      lastErr = e;
      if (signal?.aborted) throw e;
    }
    // Linear backoff: 500ms, 1500ms before the next try.
    await new Promise((r) => setTimeout(r, 500 + attempt * 1000));
  }
  throw lastErr ?? new Error("Manifest upload failed");
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

/** Fetch the shared global Drop catalog from the Worker → R2. This is the
 *  source of truth for Vault — everyone on the internal team sees the same
 *  list because there are no per-user accounts. */
export async function fetchAllDrops(): Promise<DropRecord[]> {
  if (!CLOUD_ORIGIN) return [];
  try {
    const res = await fetch(`${CLOUD_ORIGIN}/list`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { drops?: DropRecord[] };
    return data.drops ?? [];
  } catch {
    return [];
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
