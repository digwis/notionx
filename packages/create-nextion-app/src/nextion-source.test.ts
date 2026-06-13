// packages/create-nextion-app/src/nextion-source.test.ts
//
// Covers the `nextionSource` resolver: explicit CLI values pass
// through unchanged, the default fetches the live version from the
// npm registry, and network failures fall back to a hardcoded caret
// range so a scaffolder never hangs because npm is down.

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveNextionSource } from "./nextion-source.js";

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response);
}

describe("resolveNextionSource", () => {
  it("returns the override unchanged when supplied", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(resolveNextionSource("^1.2.3")).resolves.toBe("^1.2.3");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats an empty-string override the same as an absent one", async () => {
    globalThis.fetch = mockFetch({ version: "0.5.2" }) as unknown as typeof fetch;

    await expect(resolveNextionSource("")).resolves.toBe("^0.5.2");
  });

  it("prefixes the live npm version with a caret when no override is set", async () => {
    globalThis.fetch = mockFetch({ version: "0.5.2" }) as unknown as typeof fetch;

    await expect(resolveNextionSource(undefined)).resolves.toBe("^0.5.2");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/@notionx/core/latest",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("falls back to a hardcoded caret range on HTTP errors", async () => {
    globalThis.fetch = mockFetch("not found", { ok: false, status: 404 }) as unknown as typeof fetch;

    await expect(resolveNextionSource(undefined)).resolves.toMatch(/^\^/);
  });

  it("falls back to a hardcoded caret range on network errors", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    await expect(resolveNextionSource(undefined)).resolves.toMatch(/^\^/);
  });

  it("falls back when the registry response is missing a version field", async () => {
    globalThis.fetch = mockFetch({}) as unknown as typeof fetch;

    await expect(resolveNextionSource(undefined)).resolves.toMatch(/^\^/);
  });
});
