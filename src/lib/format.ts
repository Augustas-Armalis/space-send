/* Human-readable formatting — mission-control precise, never sloppy. */

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  const d = i === 0 ? 0 : decimals;
  return `${value.toFixed(d)} ${units[i]}`;
}

/** Split a byte size into value + unit, for independent digit choreography. */
export function splitBytes(bytes: number, decimals = 1): { value: string; unit: string } {
  if (!Number.isFinite(bytes) || bytes <= 0) return { value: "0", unit: "B" };
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  return { value: value.toFixed(i === 0 ? 0 : decimals), unit: units[i] };
}

export function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

export function splitSpeed(bytesPerSec: number): { value: string; unit: string } {
  const { value, unit } = splitBytes(bytesPerSec, 1);
  return { value, unit: `${unit}/s` };
}

/** "2d 14h", "3m 12s", "—" when unknown. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 1) return "<1s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatETA(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return formatDuration(seconds);
}

/** "2h ago", "just now", "3d ago" */
export function formatRelative(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** Drains toward zero: "2d 14h", "expired" */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "expired";
  return formatDuration(msRemaining / 1000);
}

export function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function pluralize(n: number, word: string, plural?: string): string {
  return n === 1 ? word : (plural ?? `${word}s`);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return clamp((done / total) * 100, 0, 100);
}
