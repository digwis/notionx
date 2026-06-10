import { blogContentModel, movieContentModel } from "./models.ts";
import { prewarmNotionMoviesSearchIndex } from "../notion/movies.ts";
import { prewarmNotionPostsSearchIndex } from "../notion/posts.ts";

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

type PrewarmTarget = {
  modelId: string;
  run: () => Promise<{ total: number; indexed: number; skipped: boolean }>;
};

const prewarmTargets: readonly PrewarmTarget[] = [
  {
    modelId: blogContentModel.id,
    run: prewarmNotionPostsSearchIndex,
  },
  {
    modelId: movieContentModel.id,
    run: prewarmNotionMoviesSearchIndex,
  },
];

function logContentPrewarm(fields: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ tag: "content_prewarm", ...fields }));
  } catch {
    // Ignore logging serialization errors.
  }
}

export async function prewarmPublicContentSearchIndex(options?: {
  models?: readonly string[];
}): Promise<ContentPrewarmResult> {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const t0 = performance.now();
  const requestedModels = new Set(options?.models?.filter(Boolean));
  const targets =
    requestedModels.size > 0
      ? prewarmTargets.filter((target) => requestedModels.has(target.modelId))
      : prewarmTargets;

  const models: ContentPrewarmModelResult[] = [];
  for (const target of targets) {
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
