// packages/create-nextion-app/src/provision/password-hash.ts
//
// Hashes the admin password at scaffold time so it can be baked into
// `migrations/0002_admin_seed.sql` and verified by `@notionx/core`'s
// `verifyPassword` on the first admin login.
//
// Why a local copy instead of importing from `@notionx/core`:
//   - The scaffolder is a Node CLI, not a Cloudflare Worker. It must
//     run on Node 22+ for the user, in a place where the runtime
//     package may not be installed yet (e.g. in CI for a brand-new
//     project that doesn't exist on disk).
//   - PBKDF2-SHA256 is a 30-line algorithm. Keeping a local copy is
//     simpler than wiring a workspace import + build dep.
//   - The generated project imports the *canonical* implementation
//     from `@notionx/core`; the only thing that matters is that the
//     wire format matches so `verifyPassword` can decode it.
//
// Wire format (must stay in lockstep with
// `packages/nextion/src/auth/passwords.ts#hashPassword`):
//
//   pbkdf2_sha256$<iterations>$<salt-base64>$<derived-key-base64>
//
// The `iterations` field is technically variable, but the runtime
// caps it at 100000 because Cloudflare Workers WebCrypto refuses
// higher counts. We bake 100000 in here so the seed row verifies
// in the same Workers environment the rest of the app runs in.

const HASH_PREFIX = "pbkdf2_sha256";
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BITS = 256;

function bytesToBase64(bytes: Uint8Array): string {
  // Manual base64 because `Buffer` exists in Node 22 but we want
  // this module to also work in any other env (e.g. edge test
  // runners) that has `btoa` but not `Buffer`. `btoa` is available
  // in Node 16+ and all modern browsers.
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  // Node 22 exposes `crypto.subtle` globally. The scaffolder's
  // package.json already requires Node >= 22, so we don't need a
  // `node:crypto` import here.
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      iterations,
    },
    baseKey,
    DERIVED_KEY_BITS
  );
  return new Uint8Array(derived);
}

/**
 * Hash `password` the same way `@notionx/core`'s `hashPassword` does.
 *
 * The output is a single string suitable for direct interpolation
 * into a SQL literal — e.g.
 *
 *   `INSERT INTO users (email, password_hash) VALUES ('admin@example.com', '${hash}')`
 *
 * `render.ts` calls this exactly once per scaffold run (for the
 * admin password) and bakes the result into a migration file. The
 * 100k PBKDF2 iteration count takes ~200ms on a developer laptop —
 * visible in the spinner, but not annoying.
 */
export async function hashPasswordForScaffold(
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return [
    HASH_PREFIX,
    String(PBKDF2_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(derived),
  ].join("$");
}
