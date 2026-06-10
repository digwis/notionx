// apps/moviebluebook/lib/content/prewarm.ts
//
// Wires the foundation's generic `prewarmPublicContentSearchIndex`
// helper to the starter's project-specific Notion prewarm runners.
// The function shape is preserved (`(options?) => Promise<...>`) so
// the existing call sites in `app/api/content/prewarm/route.ts` and
// the worker's `scheduled` handler keep working unchanged.
import {
  prewarmPublicContentSearchIndex as foundationPrewarm,
  type ContentPrewarmModelResult,
  type ContentPrewarmResult,
  type PrewarmTarget,
} from "@vinext/foundation/content";
import { prewarmNotionMoviesSearchIndex } from "../notion/movies.ts";
import { prewarmNotionPostsSearchIndex } from "../notion/posts.ts";
import { blogContentModel, movieContentModel } from "./models.ts";

export type { ContentPrewarmModelResult, ContentPrewarmResult };

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

export async function prewarmPublicContentSearchIndex(options?: {
  models?: readonly string[];
}): Promise<ContentPrewarmResult> {
  return foundationPrewarm(prewarmTargets, options);
}
