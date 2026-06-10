import test from "node:test";
import assert from "node:assert/strict";
import {
  getThemeToggleDisabled,
  nextExplicitTheme,
} from "./theme-toggle-state.ts";

test("theme toggle stays disabled before mount", () => {
  assert.equal(getThemeToggleDisabled(false), true);
});

test("theme toggle becomes interactive after mount", () => {
  assert.equal(getThemeToggleDisabled(true), false);
});

test("theme toggle switches by the resolved visual theme", () => {
  assert.equal(nextExplicitTheme("light"), "dark");
  assert.equal(nextExplicitTheme("dark"), "light");
  assert.equal(nextExplicitTheme(undefined), "dark");
});
