import test from "node:test";
import assert from "node:assert/strict";
import { getThemeToggleDisabled } from "./theme-toggle-state.ts";

test("theme toggle stays disabled before mount", () => {
  assert.equal(getThemeToggleDisabled(false), true);
});

test("theme toggle becomes interactive after mount", () => {
  assert.equal(getThemeToggleDisabled(true), false);
});
