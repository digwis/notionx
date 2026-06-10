// packages/foundation/src/content/prewarm.ts
//
// Generic content search index prewarming. The function takes a list
// of (modelId, runner) targets and runs them. The starter wires the
// project-specific runners in its `lib/content/prewarm.ts` shim.

export type ContentPrewarmModelResult = {
  modelId: string;
  ok: boolean;
  total: number;
  indexed: number;
  skipped: boolean;
  error?: string;
};

export type ContentPrewarmResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  models: ContentPrewarmModelResult[];
};

export type PrewarmTarget = {
  modelId: string;
  run: () => Promise<{ total: number; indexed: number; skipped: boolean }>;
};

function logContentPrewarm(fields: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ tag: "content_prewarm", ...fields }));
  } catch {
    // Ignore logging serialization errors.
  }
}

export async function prewarmPublicContentSearchIndex(
  targets: readonly PrewarmTarget[],
  options?: { models?: readonly string[] }
): Promise<ContentPrewarmResult> {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const t0 = performance.now();
  const requestedModels = new Set(options?.models?.filter(Boolean));
  const selected =
    requestedModels.size > 0
      ? targets.filter((target) => requestedModels.has(target.modelId))
      : targets;

  const models: ContentPrewarmModelResult[] = [];
  for (const target of selected) {
    try {
      const result = await target.run();
      models.push({
        modelId: target.modelId,
        ok: true,
        total: result.total,
        indexed: result.indexed,
        skipped: result.skipped,
      });
    } catch (error) {
      models.push({
        modelId: target.modelId,
        ok: false,
        total: 0,
        indexed: 0,
        skipped: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const output: ContentPrewarmResult = {
    ok: models.every((model) => model.ok),
    startedAt,
    finishedAt,
    durationMs: Math.round((performance.now() - t0) * 100) / 100,
    models,
  };

  logContentPrewarm({
    ok: output.ok,
    started_at: output.startedAt,
    finished_at: output.finishedAt,
    duration_ms: output.durationMs,
    models: output.models,
  });

  return output;
}
