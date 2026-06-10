import { describe, it, expect } from "vitest";
import { runFoundationDoctor } from "../../src/doctor";

describe("runFoundationDoctor", () => {
  it("reports a missing database binding as an error", async () => {
    const report = await runFoundationDoctor({
      env: {} as Record<string, string | undefined>,
      runtime: { getBinding: () => undefined },
      sources: [],
    });
    expect(report.findings.some((f) => f.code === "missing-db-binding")).toBe(true);
  });
});
