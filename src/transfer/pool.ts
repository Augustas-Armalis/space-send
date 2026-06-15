import { CLOUD_ORIGIN } from "@/lib/config";

/* ============================================================================
   Pool client — a shared R2 "drop folder". Anyone with the link can upload,
   browse, download, and remove files. No accounts; the pool id in the URL is
   the capability. Backed by the worker's /pool/<id> endpoints.
   ========================================================================== */

export interface PoolFileInfo {
  id: string;
  name: string;
  size: number;
  mime: string;
  uploader: string;
  ts: number;
}

export async function listPool(poolId: string): Promise<PoolFileInfo[]> {
  try {
    const res = await fetch(`${CLOUD_ORIGIN}/pool/${poolId}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { files?: PoolFileInfo[] };
    return (data.files ?? []).sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export interface PoolUploadProgress {
  loaded: number;
  total: number;
  speed: number;
}

/** Upload one file into a pool with real progress. Resolves on 2xx, rejects
 *  with the worker's structured error (e.g. bucket_full / file_too_large). */
export function uploadToPool(
  poolId: string,
  fileId: string,
  file: File,
  uploader: string,
  onProgress?: (p: PoolUploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${CLOUD_ORIGIN}/pool/${poolId}/file/${fileId}`);
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-uploader", encodeURIComponent(uploader || "anon"));
    xhr.timeout = 120_000;
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
      onProgress?.({ loaded: e.loaded, total: e.total, speed });
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
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
}

export function poolFileUrl(poolId: string, fileId: string): string {
  return `${CLOUD_ORIGIN}/pool/${poolId}/file/${fileId}`;
}

export async function deletePoolFile(poolId: string, fileId: string): Promise<void> {
  try {
    await fetch(`${CLOUD_ORIGIN}/pool/${poolId}/file/${fileId}`, { method: "DELETE" });
  } catch {
    /* best effort */
  }
}
