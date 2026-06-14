// packages/create-nextion-app/src/nextion-source.test.ts
//
// Covers the `nextionSource` resolver:
//   - explicit CLI overrides pass through unchanged
//   - the monorepo dev path emits `workspace:*` when the target
//     lives inside the `nextion` monorepo
//   - the default path fetches the live version from the npm
//     registry, with a hardcoded caret-range fallback when the
//     registry is unreachable

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  isMonorepoDevMode,
  MONOREPO_PROTOCOL,
  resolveNextionSource,
} from "./nextion-source.js";

const ORIGINAL_FETCH = globalThis.fetch;

// A scratch monorepo laid out as
//
//   <root>/packages/nextion/package.json  (name: "@notionx/core")
//   <root>/apps/scratch/digwis            (the target)
//
// `isMonorepoDevMode` should return `true` for a target that is
// two levels deep from the monorepo root.
let scratchRoot = "";
let scratchAppDir = "";

beforeAll(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), "nextion-src-test-"));
  const pkgDir = join(scratchRoot, "packages", "nextion");
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({ name: "@notionx/core", version: "1.0.0" })
  );
  scratchAppDir = resolve(scratchRoot, "apps", "scratch", "digwis");
  mkdirSync(scratchAppDir, { recursive: true });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

afterAll(() => {
  if (scratchRoot) {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
});

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response);
}

describe("isMonorepoDevMode", () => {
  it("returns true when the target is inside the nextion monorepo", () => {
    expect(isMonorepoDevMode(scratchAppDir)).toBe(true);
  });

  it("returns false for a path that has no monorepo neighbour", () => {
    const orphan = mkdtempSync(join(tmpdir(), "nextion-orphan-"));
    try {
      expect(isMonorepoDevMode(orphan)).toBe(false);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it("returns false when the neighbour package is not @notionx/core", () => {
    const other = mkdtempSync(join(tmpdir(), "nextion-other-"));
    try {
      const pkgDir = join(other, "packages", "nextion");
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(
        join(pkgDir, "package.json"),
        JSON.stringify({ name: "something-else", version: "0.1.0" })
      );
      const target = join(other, "apps", "scratch", "digwis");
      mkdirSync(target, { recursive: true });
      expect(isMonorepoDevMode(target)).toBe(false);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });
});

describe("resolveNextionSource", () => {
  it("returns the override unchanged when supplied", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      resolveNextionSource("^1.2.3", scratchAppDir)
    ).resolves.toBe("^1.2.3");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("short-circuits to workspace:* when the target is inside the monorepo", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      resolveNextionSource(undefined, scratchAppDir)
    ).resolves.toBe(MONOREPO_PROTOCOL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats an empty-string override the same as an absent one", async () => {
    globalThis.fetch = mockFetch({ version: "1.0.0" }) as unknown as typeof fetch;
    const orphan = mkdtempSync(join(tmpdir(), "nextion-empty-"));
    try {
      await expect(
        resolveNextionSource("", orphan)
      ).resolves.toBe("^1.0.0");
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it("prefixes the live npm version with a caret when no override is set and target is outside the monorepo", async () => {
    globalThis.fetch = mockFetch({ version: "1.0.0" }) as unknown as typeof fetch;
    const orphan = mkdtempSync(join(tmpdir(), "nextion-live-"));
    try {
      await expect(
        resolveNextionSource(undefined, orphan)
      ).resolves.toBe("^1.0.0");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/@notionx/core/latest",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it("falls back to a hardcoded caret range on HTTP errors", async () => {
    globalThis.fetch = mockFetch("not found", { ok: false, status: 404 }) as unknown as typeof fetch;
    const orphan = mkdtempSync(join(tmpdir(), "nextion-404-"));
    try {
      await expect(
        resolveNextionSource(undefined, orphan)
      ).resolves.toMatch(/^\^/);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it("falls back to a hardcoded caret range on network errors", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    const orphan = mkdtempSync(join(tmpdir(), "nextion-net-"));
    try {
      await expect(
        resolveNextionSource(undefined, orphan)
      ).resolves.toMatch(/^\^/);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it("falls back when the registry response is missing a version field", async () => {
    globalThis.fetch = mockFetch({}) as unknown as typeof fetch;
    const orphan = mkdtempSync(join(tmpdir(), "nextion-empty-body-"));
    try {
      await expect(
        resolveNextionSource(undefined, orphan)
      ).resolves.toMatch(/^\^/);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});
