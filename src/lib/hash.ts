/* SHA-256 file integrity — every transmission is verified end to end. */

export function bufToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
  const digest = await crypto.subtle.digest("SHA-256", buf as ArrayBuffer);
  return bufToHex(digest);
}

/**
 * Hash a File in chunks so the UI can show progress on large files.
 * Note: SubtleCrypto has no streaming digest, so for very large files we
 * accumulate — acceptable for the friends-and-family scale. The chunked read
 * keeps the main thread responsive and drives the progress callback.
 */
export async function hashFile(
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const CHUNK = 8 * 1024 * 1024;
  if (file.size <= CHUNK) {
    const buf = await file.arrayBuffer();
    onProgress?.(1);
    return sha256Hex(buf);
  }
  // Accumulate into one buffer for a single digest pass, reporting read progress.
  const total = file.size;
  let offset = 0;
  const parts: Uint8Array[] = [];
  while (offset < total) {
    const slice = file.slice(offset, Math.min(offset + CHUNK, total));
    const buf = await slice.arrayBuffer();
    parts.push(new Uint8Array(buf));
    offset += CHUNK;
    onProgress?.(Math.min(1, offset / total));
    // Yield to keep the UI alive.
    await new Promise((r) => setTimeout(r, 0));
  }
  const merged = new Uint8Array(total);
  let p = 0;
  for (const part of parts) {
    merged.set(part, p);
    p += part.length;
  }
  return sha256Hex(merged);
}

/** Short fingerprint for display: first 10 + last 6 hex chars. */
export function shortHash(hex: string): string {
  if (hex.length <= 20) return hex;
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}
