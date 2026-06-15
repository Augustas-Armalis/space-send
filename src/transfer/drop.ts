import { putBlob, getBlob, deleteDrop as idbDeleteDrop } from "./idb";
import type { FileMeta } from "./types";

/* ============================================================================
   Drop backend. In this build, bytes are persisted to IndexedDB so the entire
   cloud flow — upload progress, share link, recipient extract, hash verify —
   works end-to-end inside one browser. Swapping in R2/S3 means replacing
   putBlob/getBlob with presigned PUT/GET; the surface below is identical.
   ========================================================================== */

export interface UploadProgress {
  fileId: string;
  loaded: number;
  total: number;
  speed: number;
}

const READ_CHUNK = 4 * 1024 * 1024;

/** Upload one file's bytes to the local backend with genuine read progress. */
export async function uploadFile(
  dropId: string,
  meta: FileMeta,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  const total = file.size;
  let loaded = 0;
  let lastTime = Date.now();
  let lastLoaded = 0;
  let speed = 0;

  // Read in chunks to keep the UI alive + drive the progress ring honestly.
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

export async function getDropFile(dropId: string, fileId: string): Promise<Blob | undefined> {
  return getBlob(dropId, fileId);
}

export async function purgeDrop(dropId: string): Promise<void> {
  return idbDeleteDrop(dropId);
}
