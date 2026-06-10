import { describe, it, expect } from "vitest";
import { selectRuntime } from "../../src/platform/selection";

describe("selectRuntime", () => {
  it("returns the cloudflare runtime when CF bindings are present", () => {
    const env = { DB: {}, R2: {} } as Record<string, unknown>;
    expect(selectRuntime(env).kind).toBe("cloudflare");
  });

  it("throws a clear error when no runtime can be detected", () => {
    expect(() => selectRuntime({} as Record<string, unknown>)).toThrow(/runtime/i);
  });
});
