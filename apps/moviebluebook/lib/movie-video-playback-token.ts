import { workerEnv } from "./env";
import type { AuthViewer } from "./auth";

const PLAYBACK_TOKEN_TTL_SECONDS = 60 * 60 * 4;

type PlaybackTokenPayload = {
  movieId: string;
  blockId: string;
  subject: string;
  exp: number;
};

function getSecret() {
  return workerEnv.ADMIN_PASSWORD || "vinext-admin-2026";
}

function subjectForViewer(viewer: AuthViewer) {
  return viewer.user ? `user:${viewer.user.uid}` : `admin:${viewer.email}`;
}

function base64UrlEncode(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

async function hmac(message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return [...new Uint8Array(sig)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= left[index]! ^ right[index]!;
  }
  return diff === 0;
}

export async function createMovieVideoPlaybackToken(input: {
  viewer: AuthViewer;
  movieId: string;
  blockId: string;
}) {
  const payload: PlaybackTokenPayload = {
    movieId: input.movieId,
    blockId: input.blockId,
    subject: subjectForViewer(input.viewer),
    exp: Math.floor(Date.now() / 1000) + PLAYBACK_TOKEN_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded)}`;
}

export async function verifyMovieVideoPlaybackToken(input: {
  token: string | null;
  viewer: AuthViewer;
  movieId: string;
  blockId: string;
}) {
  if (!input.token) return false;

  const [encoded, sig] = input.token.split(".");
  if (!encoded || !sig) return false;
  if (!(await timingSafeEqual(sig, await hmac(encoded)))) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as PlaybackTokenPayload;
    return (
      payload.movieId === input.movieId &&
      payload.blockId === input.blockId &&
      payload.subject === subjectForViewer(input.viewer) &&
      payload.exp >= Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
