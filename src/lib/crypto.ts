import { base64url } from "./ids";

/**
 * Device key pair. The public key is your cryptographic identity; the private
 * key never leaves the device. Ed25519 where the browser supports it (Web
 * Crypto), with a graceful random-identity fallback so the app never blocks on
 * an unsupported runtime.
 */
export interface DeviceKeys {
  publicKey: string; // base64url
  privateKeyJwk?: JsonWebKey;
  algorithm: "Ed25519" | "fallback";
  createdAt: number;
}

export async function generateDeviceKeys(): Promise<DeviceKeys> {
  try {
    const subtle = crypto.subtle as SubtleCrypto & {
      generateKey: SubtleCrypto["generateKey"];
    };
    // Ed25519 is supported in recent Chromium/Safari/Firefox.
    const pair = (await subtle.generateKey({ name: "Ed25519" } as unknown as AlgorithmIdentifier, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const rawPub = await subtle.exportKey("raw", pair.publicKey);
    const privJwk = await subtle.exportKey("jwk", pair.privateKey);
    return {
      publicKey: base64url(new Uint8Array(rawPub)),
      privateKeyJwk: privJwk,
      algorithm: "Ed25519",
      createdAt: Date.now(),
    };
  } catch {
    // Fallback: a random identity. Not signature-capable, but stable + unique.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return {
      publicKey: base64url(bytes),
      algorithm: "fallback",
      createdAt: Date.now(),
    };
  }
}

/** Derive an AES-GCM key from a passphrase (URL fragment) for E2E payloads. */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 210_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptChunk(key: CryptoKey, data: ArrayBuffer): Promise<{ iv: Uint8Array; ct: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, data);
  return { iv, ct };
}

export async function decryptChunk(key: CryptoKey, iv: Uint8Array, ct: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct);
}

/** PBKDF2 password hash for link password-protection (stored: salt + hash). */
export async function hashPassword(password: string, salt?: Uint8Array): Promise<{ salt: string; hash: string }> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: s as BufferSource, iterations: 210_000, hash: "SHA-256" },
    baseKey,
    256,
  );
  return { salt: base64url(s), hash: base64url(new Uint8Array(bits)) };
}
