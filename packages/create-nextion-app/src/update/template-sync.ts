import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { render, resolveTemplatesDir } from "../render.js";
import type { ProjectContext } from "../project-context.js";
import { scaffoldManagedFiles } from "./scaffold-files.js";
import { buildUpdateAnswers } from "./update-answers.js";

export interface UpdatePlanEntry {
  filePath: string;
  status: "updated" | "unchanged" | "missing" | "skipped";
  nextContent?: string;
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function buildUpdatePlan(
  context: ProjectContext
): Promise<UpdatePlanEntry[]> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nextion-update-"));
  try {
    const templatesDir = await resolveTemplatesDir();
    const answers = buildUpdateAnswers(context);
    await render(answers, templatesDir, tempRoot);

    return Promise.all(
      scaffoldManagedFiles.map(async (filePath) => {
        const projectPath = path.join(context.projectDir, filePath);
        const renderedPath = path.join(tempRoot, filePath);
        const currentContent = await readIfExists(projectPath);
        const nextContent = await readIfExists(renderedPath);

        if (nextContent === null) {
          return { filePath, status: "skipped" as const };
        }
        if (currentContent === null) {
          return { filePath, status: "missing" as const, nextContent };
        }
        if (currentContent === nextContent) {
          return { filePath, status: "unchanged" as const, nextContent };
        }
        return { filePath, status: "updated" as const, nextContent };
      })
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
