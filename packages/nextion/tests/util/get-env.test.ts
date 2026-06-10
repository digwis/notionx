import { describe, it, expect } from "vitest";
import { getEnv } from "../../src/util/get-env";

describe("getEnv", () => {
  it("returns the primary value when set", () => {
    process.env.TEST_PRIMARY = "primary";
    expect(getEnv("TEST_PRIMARY")).toBe("primary");
    delete process.env.TEST_PRIMARY;
  });

  it("falls back to the next name when primary is unset", () => {
    delete process.env.TEST_PRIMARY;
    process.env.TEST_FALLBACK = "fallback";
    expect(getEnv("TEST_PRIMARY", "TEST_FALLBACK")).toBe("fallback");
    delete process.env.TEST_FALLBACK;
  });

  it("returns undefined when none are set", () => {
    expect(getEnv("TEST_MISSING_A", "TEST_MISSING_B")).toBeUndefined();
  });
});
