import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("admin layout no longer runs bootstrap on every request", () => {
  const source = read("app/admin/layout.tsx");
  assert.doesNotMatch(source, /ensureAdminBootstrap/);
});

test("settings helpers use request-scoped cache wrappers", () => {
  const source = read("lib/settings.ts");
  assert.match(source, /cache\(/);
});

test("turnstile field no longer posts debug events to localhost", () => {
  const source = read("components/TurnstileField.tsx");
  assert.doesNotMatch(source, /127\.0\.0\.1:7777/);
  assert.doesNotMatch(source, /reportDebug/);
});

test("admin list uses a lazy delete button wrapper", () => {
  const source = read("app/admin/page.tsx");
  assert.match(source, /DeleteButtonLazy/);
});

test("new post page uses a lazy form wrapper", () => {
  const source = read("app/admin/new/page.tsx");
  assert.match(source, /NewPostFormLazy/);
});

test("admin route defines a dedicated content-only loading state", () => {
  const source = read("app/admin/loading.tsx");
  assert.match(source, /Skeleton/);
  assert.doesNotMatch(source, /vinext Admin/);
});
