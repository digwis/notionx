// packages/notionx-cli/src/locale-add/format.ts
//
// Pretty-prints a locale-add summary. The output mirrors the style
// of `notionx update` so the two commands feel like the same tool.

import * as p from "@clack/prompts";
import type { LocaleAddPlan } from "./plan.js";
import type { LocaleAddSummary } from "./apply.js";

export function formatLocaleAddDryRun(plan: LocaleAddPlan): string[] {
  const lines: string[] = [];
  lines.push(`planned changes for locale "${plan.locale}":`);
  for (const change of plan.changes) {
    lines.push(`  - [${change.risk}] ${change.label}: ${change.description}`);
  }
  return lines;
}

export function logLocaleAddDryRun(plan: LocaleAddPlan): void {
  p.log.info("dry run — no files written");
  for (const line of formatLocaleAddDryRun(plan)) {
    p.log.info(line);
  }
}

export function logLocaleAddSummary(summary: LocaleAddSummary): void {
  if (summary.applied.length > 0) {
    p.log.info("applied:");
    for (const label of summary.applied) p.log.info(`  - ${label}`);
  }
  if (summary.skipped.length > 0) {
    p.log.info("skipped (already applied):");
    for (const label of summary.skipped) p.log.info(`  - ${label}`);
  }
  if (summary.failed.length > 0) {
    p.log.error("failed:");
    for (const failure of summary.failed) {
      p.log.error(`  - ${failure.label}: ${failure.error}`);
    }
  }
}
