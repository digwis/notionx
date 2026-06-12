// packages/create-nextion-app/src/provision/password-hash.ts
//
// PBKDF2-SHA256 password hashing that produces output compatible with
// `@notionx/core`'s `verifyPassword`.
//
// The `@notionx/core` package keeps `hashPassword` as an internal
// module (not exported via package.json) on purpose, so the scaffolder
// can't import it directly. We re-implement the same algorithm here
// using Node.js WebCrypto so the hashed value baked into the
// generated `migrations/0002_admin_seed.sql` is byte-for-byte
// compatible.
//
// Format (must stay in sync with packages/nextion/src/auth/passwords.ts):
//   pbkdf2_sha256$<iterations>$<saltB64>$<derivedB64>

const HASH_PREFIX = "pbkdf2_sha256";
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return Buffer.from(bin, "binary").toString("base64");
}

export async function hashPasswordForScaffold(
  password: string
): Promise<string> {
  // Node 22+ exposes globalThis.crypto.subtle; older versions need
  // the `node:crypto` webcrypto polyfill. Use the latter for
  // broadest compatibility with the minimum Node version we ship.
  const { webcrypto } = await import("node:crypto");
  const subtle = webcrypto.subtle;
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    baseKey,
    DERIVED_BITS
  );
  return [
    HASH_PREFIX,
    String(PBKDF2_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(new Uint8Array(derived)),
  ].join("$");
}
