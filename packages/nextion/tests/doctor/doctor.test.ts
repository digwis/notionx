import { describe, it, expect } from "vitest";
import { runNextionDoctor } from "../../src/doctor";

describe("runNextionDoctor", () => {
  it("reports a missing database binding as an error", async () => {
    const report = await runNextionDoctor({
      env: {} as Record<string, string | undefined>,
      runtime: { getBinding: () => undefined },
      sources: [],
    });
    expect(report.findings.some((f) => f.code === "missing-db-binding")).toBe(true);
  });
});
