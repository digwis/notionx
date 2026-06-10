import test from "node:test";
import assert from "node:assert/strict";
import { perfSpan, perfSpanSync } from "./perf-trace.ts";

test("perfSpan records success and forwards return value", async () => {
  const out = await perfSpan({ span: "test.ok" }, async () => 42);
  assert.equal(out, 42);
});

test("perfSpan rethrows errors", async () => {
  await assert.rejects(async () => {
    await perfSpan({ span: "test.err" }, async () => {
      throw new Error("boom");
    });
  }, /boom/);
});

test("perfSpanSync returns value", () => {
  const out = perfSpanSync({ span: "test.sync" }, () => "ok");
  assert.equal(out, "ok");
});
