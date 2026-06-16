// packages/create-nextion-app/src/registry/load-registry.ts
//
// The single entry point for reading a project's registry state.
//
// Behaviour:
//   - If `.nextion/registry.json` exists, read it directly.
//   - Else, throw — the directory is not a nextion project.

import { readRegistryManifest, REGISTRY_FILE } from "./registry-store.js";
import type { LoadedRegistry } from "./registry-types.js";

/**
 * Load a project's registry. Returns the `RegistryManifest` plus a
 * `managedFiles` snapshot (typed view of the manifest's `managedFiles`
 * block).
 *
 * Throws when no `registry.json` exists in the directory.
 */
export async function loadRegistry(projectDir: string): Promise<LoadedRegistry> {
  const manifest = await readRegistryManifest(projectDir);
  if (manifest === null) {
    throw new Error(
      `No Nextion project state found in ${projectDir}. ` +
        `Expected ${REGISTRY_FILE}.`,
    );
  }
  return { manifest, managedFiles: manifest.managedFiles };
}
