import { describe, it, expect } from "vitest";
import { runNotionxDoctor } from "../../src/doctor";

describe("runNotionxDoctor", () => {
  it("reports a missing database binding as an error", async () => {
    const report = await runNotionxDoctor({
      env: {} as Record<string, string | undefined>,
      runtime: { getBinding: () => undefined },
      sources: [],
    });
    expect(report.findings.some((f) => f.code === "missing-db-binding")).toBe(true);
  });
});
