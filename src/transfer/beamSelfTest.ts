import { BeamHost, BeamReceiver, type HostFile } from "./beam";
import type { BeamManifest, FileMeta } from "./types";

/* Dev-only loopback throughput test. Spins up a BeamHost and a BeamReceiver in
   the same page (they signal each other and connect over loopback ICE), streams
   a generated file end-to-end, and reports throughput + integrity. Attached to
   window.__beamSelfTest in development so we can measure the engine in-browser.

   Usage in console:  await window.__beamSelfTest(50, { turbo: true }) */

export interface SelfTestResult {
  ok: boolean;
  bytes: number;
  seconds: number;
  MBps: number;
  Mbps: number;
  lanes: "normal" | "turbo";
  note?: string;
}

export async function beamSelfTest(sizeMB = 50, opts: { turbo?: boolean } = {}): Promise<SelfTestResult> {
  const size = Math.floor(sizeMB * 1024 * 1024);
  // Build a file with a verifiable pattern (every 64th byte is its index mod 256).
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i += 251) data[i] = i & 0xff;
  const file = new File([data], "selftest.bin", { type: "application/octet-stream" });
  const meta: FileMeta = { id: "f1", name: "selftest.bin", size, mime: "application/octet-stream" };
  const hostFile: HostFile = { meta, file };
  const manifest: BeamManifest = {
    files: [{ id: "f1", name: "selftest.bin", size, mime: "application/octet-stream" }],
    totalSize: size,
  };
  const beamId = "selftest-" + Math.floor(performance.now()).toString(36);

  const refs: { host?: BeamHost; recv?: BeamReceiver } = {};

  try {
    return await new Promise<SelfTestResult>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("self-test timed out (60s)")), 60_000);
      let t0 = 0;

      refs.host = new BeamHost(beamId, "selftest-host", [hostFile], manifest, {});
      if (opts.turbo) refs.host.setTurbo(true);

      refs.recv = new BeamReceiver(beamId, "selftest-recv", {
        onManifest: () => {
          t0 = performance.now();
          // save:false → measure without triggering a browser download
          refs.recv!.download(meta, { save: false }).catch(reject);
        },
        onFileComplete: (_id, verified) => {
          clearTimeout(timeout);
          const seconds = (performance.now() - t0) / 1000;
          const MBps = size / 1e6 / seconds;
          resolve({
            ok: verified,
            bytes: size,
            seconds: Number(seconds.toFixed(3)),
            MBps: Number(MBps.toFixed(1)),
            Mbps: Number((MBps * 8).toFixed(1)),
            lanes: opts.turbo ? "turbo" : "normal",
          });
        },
        onError: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });
    });
  } finally {
    try {
      refs.recv?.close();
    } catch {
      /* noop */
    }
    try {
      refs.host?.close();
    } catch {
      /* noop */
    }
  }
}
