// packages/notionx-cli/src/locale-add/apply.ts
//
// Applies a planned set of `LocaleAddChange` records. The runner is
// idempotent: if a file already contains the requested locale, the
// corresponding change is recorded as `skipped`, not applied twice.

import type { LocaleAddChange, LocaleAddPlan } from "./plan.js";

export type LocaleAddSummary = {
  applied: string[];
  skipped: string[];
  failed: Array<{ label: string; error: string }>;
  translationSourceIds: Record<string, string>;
};

export async function runLocaleAddPlan(
  plan: LocaleAddPlan
): Promise<LocaleAddSummary> {
  const summary: LocaleAddSummary = {
    applied: [],
    skipped: [],
    failed: [],
    translationSourceIds: {},
  };

  for (const change of plan.changes) {
    try {
      if (change.kind === "notion") {
        const result = await change.apply();
        if (result?.dataSourceId) {
          summary.translationSourceIds[change.modelId] = result.dataSourceId;
        }
        summary.applied.push(change.label);
        continue;
      }
      await change.apply();
      summary.applied.push(change.label);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // If a file is missing on disk, treat as a no-op (the project
      // may not have that file because it was hand-rolled or moved).
      if (change.kind === "file" && /ENOENT/.test(message)) {
        summary.skipped.push(change.label);
        continue;
      }
      summary.failed.push({ label: change.label, error: message });
    }
  }

  return summary;
}
