/* Native bridges. No-ops on the web; light up inside the Tauri shell (which sets
   window.__TAURI__ because tauri.conf has withGlobalTauri:true — so the web app
   needs zero @tauri-apps dependencies). Also wraps the browser Wake Lock API so
   a hosting browser tab keeps the screen awake during a Beam. */

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

interface TauriGlobal {
  core?: { invoke?: Invoke };
}

function tauriInvoke(): Invoke | null {
  if (typeof window === "undefined") return null;
  const t = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
  return t?.core?.invoke ?? null;
}

export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let wakeLock: WakeLockSentinel | null = null;

/** Keep the machine/tab awake while hosting. Native caffeinate on Mac, Wake Lock on web. */
export async function preventSleep(): Promise<void> {
  const invoke = tauriInvoke();
  if (invoke) {
    try {
      await invoke("prevent_sleep");
      return;
    } catch {
      /* fall through to web */
    }
  }
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch {
    /* user agent may reject — honest fallback handled by the UI copy */
  }
}

export async function allowSleep(): Promise<void> {
  const invoke = tauriInvoke();
  if (invoke) {
    try {
      await invoke("allow_sleep");
    } catch {
      /* noop */
    }
  }
  try {
    await wakeLock?.release();
  } catch {
    /* noop */
  }
  wakeLock = null;
}
