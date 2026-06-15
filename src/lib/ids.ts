import { customAlphabet } from "nanoid";

// URL-safe, unambiguous alphabet (no 0/O/1/l/I confusion).
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const nano = customAlphabet(ALPHABET, 8);
const nanoLong = customAlphabet(ALPHABET, 12);

/** 8-char short id for share links: spacesend.app/r/{shortId} */
export function shortId(): string {
  return nano();
}

export function longId(): string {
  return nanoLong();
}

export function beamId(): string {
  return nano();
}

export function dropId(): string {
  return nano();
}

/** A 256-bit key, base64url encoded, for the URL hash fragment (#key). */
export function genKey(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return base64url(bytes);
}

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Validate a vanity slug / Tag. */
export function isValidTag(tag: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(tag);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{2,40}$/.test(slug);
}
