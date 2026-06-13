import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectContext } from "../project-context.js";
import { buildUpdatePlan, type UpdatePlanEntry } from "./template-sync.js";

export interface UpdateSummary {
  updated: UpdatePlanEntry[];
  missing: UpdatePlanEntry[];
  unchanged: UpdatePlanEntry[];
  skipped: UpdatePlanEntry[];
  needsInstall: boolean;
  /**
   * `true` when the project's `.nextion/scaffold.json` opted into
   * the `legacy-vinext` compatibility marker (or already pins
   * `nextionSource: "workspace:*"`). The CLI should mention this
   * in its summary so the operator knows the run kept the
   * workspace symlink instead of resolving a real semver.
   */
  compatibilityPreserved: boolean;
}

export async function runUpdate(context: ProjectContext): Promise<UpdateSummary> {
  const plan = await buildUpdatePlan(context);
  const summary: UpdateSummary = {
    updated: [],
    missing: [],
    unchanged: [],
    skipped: [],
    needsInstall: false,
    compatibilityPreserved:
      context.metadata.compatibility === "legacy-vinext" ||
      context.metadata.nextionSource === "workspace:*",
  };

  for (const entry of plan) {
    if (
      (entry.status === "updated" || entry.status === "missing") &&
      entry.nextContent !== undefined
    ) {
      const filePath = path.join(context.projectDir, entry.filePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, entry.nextContent, "utf8");
      summary[entry.status].push(entry);
      if (entry.filePath === "package.json") {
        summary.needsInstall = true;
      }
      continue;
    }

    if (entry.status === "unchanged") {
      summary.unchanged.push(entry);
      continue;
    }

    summary.skipped.push(entry);
  }

  return summary;
}
