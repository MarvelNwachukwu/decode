// Standalone: no imports. So the same file can be loaded by the web app
// (via shared/crypto.js) and the Chrome extension (via a symlink/copy) with
// identical behavior and no path-resolution surprises.
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;
const PBKDF2_ITERATIONS = 200_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64) {
  const clean = b64.replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encrypt(plaintext, password) {
  if (!plaintext) throw new Error("Nothing to encrypt");
  if (!password) throw new Error("Key required");

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );

  const cipher = new Uint8Array(cipherBuf);
  const out = new Uint8Array(salt.length + iv.length + cipher.length);
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(cipher, salt.length + iv.length);
  return toBase64(out);
}

export async function decrypt(b64, password) {
  if (!b64) throw new Error("Nothing to decrypt");
  if (!password) throw new Error("Key required");

  let bytes;
  try {
    bytes = fromBase64(b64);
  } catch {
    throw new Error("Wrong key or corrupted message");
  }
  if (bytes.length < SALT_BYTES + IV_BYTES + 1) {
    throw new Error("Wrong key or corrupted message");
  }

  const salt = bytes.slice(0, SALT_BYTES);
  const iv = bytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const cipher = bytes.slice(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(password, salt);

  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  } catch {
    throw new Error("Wrong key or corrupted message");
  }
  return dec.decode(plainBuf);
}

// Heuristic: does this string look like our base64 payload?
// Used by the UI to flip between encrypt/decrypt mode automatically.
// Our ciphertext is a contiguous base64 blob: no internal whitespace, length
// divisible by 4, strict base64 alphabet. Those three together rule out almost
// all plaintext (which tends to contain spaces, punctuation, or unicode).
export function looksLikeCiphertext(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 60) return false;
  if (t.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(t);
}
