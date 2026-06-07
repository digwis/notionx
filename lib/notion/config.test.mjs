import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/notion/config.ts"),
  "utf8"
);

test("notion config merges only non-empty environment values", () => {
  assert.match(source, /function mergeEnv/);
  assert.match(source, /const value = readString\(source, name\)/);
  assert.match(source, /if \(value\) merged\[name\] = value/);
});
