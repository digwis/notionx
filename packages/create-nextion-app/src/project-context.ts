import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseScaffoldMetadata,
  SCAFFOLD_METADATA_FILE,
  type ScaffoldMetadata,
} from "./metadata.js";
import {
  INSTALLATIONS_FILE,
  MANAGED_FILES_FILE,
  type InstallationManifest,
  type ManagedFilesManifest,
} from "./template-contracts.js";

export interface ProjectContext {
  projectDir: string;
  metadata: ScaffoldMetadata;
  installations: InstallationManifest;
  managedFiles: ManagedFilesManifest;
}

function parseInstallations(raw: string): InstallationManifest {
  return JSON.parse(raw) as InstallationManifest;
}

function parseManagedFiles(raw: string): ManagedFilesManifest {
  return JSON.parse(raw) as ManagedFilesManifest;
}

export async function loadProjectContext(
  projectDir: string
): Promise<ProjectContext> {
  const metadataPath = path.join(projectDir, SCAFFOLD_METADATA_FILE);
  const installationsPath = path.join(projectDir, INSTALLATIONS_FILE);
  const managedFilesPath = path.join(projectDir, MANAGED_FILES_FILE);

  let metadataRaw: string;
  let installationsRaw: string;
  let managedFilesRaw: string;

  try {
    [metadataRaw, installationsRaw, managedFilesRaw] = await Promise.all([
      readFile(metadataPath, "utf8"),
      readFile(installationsPath, "utf8"),
      readFile(managedFilesPath, "utf8"),
    ]);
  } catch {
    throw new Error(
      `No Nextion project metadata found in ${projectDir}. Expected ${SCAFFOLD_METADATA_FILE}, ${INSTALLATIONS_FILE}, and ${MANAGED_FILES_FILE}.`
    );
  }

  return {
    projectDir,
    metadata: parseScaffoldMetadata(metadataRaw),
    installations: parseInstallations(installationsRaw),
    managedFiles: parseManagedFiles(managedFilesRaw),
  };
}
