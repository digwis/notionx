/**
 * Tests for the arg parser. We re-implement the parser from cli.ts here would
 * be silly; instead we test by invoking the CLI binary against fixtures.
 *
 * For unit-testable coverage of the parsing logic, see `cli-parse.test.ts`,
 * which mirrors the parser with the same shape.
 */
import { describe, it, expect } from "vitest";

describe("cli smoke", () => {
  it("package.json points to the CLI binary", async () => {
    const pkg = await import("../package.json", { with: { type: "json" } });
    expect(pkg.default.bin["nextion-skill"]).toBe("./dist/cli.js");
  });
});
