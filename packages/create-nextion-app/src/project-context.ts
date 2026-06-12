import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseScaffoldMetadata,
  SCAFFOLD_METADATA_FILE,
  type ScaffoldMetadata,
} from "./metadata.js";

export interface ProjectContext {
  projectDir: string;
  metadata: ScaffoldMetadata;
}

export async function loadProjectContext(
  projectDir: string
): Promise<ProjectContext> {
  const metadataPath = path.join(projectDir, SCAFFOLD_METADATA_FILE);
  let raw: string;
  try {
    raw = await readFile(metadataPath, "utf8");
  } catch {
    throw new Error(
      `No Nextion scaffold metadata found in ${projectDir}. Expected ${SCAFFOLD_METADATA_FILE}.`
    );
  }

  return {
    projectDir,
    metadata: parseScaffoldMetadata(raw),
  };
}
