const HASH_PREFIX = "pbkdf2_sha256";
// Cloudflare Workers WebCrypto currently rejects PBKDF2 iteration counts above 100000.
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(input: string): Uint8Array {
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const normalizedSalt = Uint8Array.from(salt) as unknown as BufferSource;
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: normalizedSalt,
      iterations,
    },
    baseKey,
    256
  );
  return new Uint8Array(derived);
}

async function constantTimeEqual(
  left: Uint8Array,
  right: Uint8Array
): Promise<boolean> {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i]! ^ right[i]!;
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  return [
    HASH_PREFIX,
    String(PBKDF2_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(derived),
  ].join("$");
}

/** 注册/改密时的强度校验，失败返回中文错误信息。 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "密码至少需要 8 位";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "密码需要同时包含字母和数字";
  }
  return null;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [prefix, iterationsStr, saltB64, hashB64] = storedHash.split("$");
  if (
    prefix !== HASH_PREFIX ||
    !iterationsStr ||
    !saltB64 ||
    !hashB64
  ) {
    return false;
  }

  const iterations = Number(iterationsStr);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const derived = await deriveKey(password, salt, iterations);
  return constantTimeEqual(derived, expected);
}
