import type {
  LoadedRegistry,
  RegistryManifest,
} from "./registry/registry-types.js";

export interface DiffSummary {
  installed: string[];
  ownership: {
    platform: number;
    bridge: number;
    user: number;
  };
}

export function buildDiffSummary(input: {
  registry: LoadedRegistry;
}): DiffSummary {
  return {
    installed: input.registry.manifest.installed.map(
      (item) => `${item.id}@${item.version}`
    ),
    ownership: {
      platform: input.registry.managedFiles.platform.length,
      bridge: input.registry.managedFiles.bridge.length,
      user: input.registry.managedFiles.user.length,
    },
  };
}

export function formatDiffSummary(summary: DiffSummary): string[] {
  return [
    "installed:",
    ...summary.installed.map((item) => `  - ${item}`),
    "ownership:",
    `  - platform: ${summary.ownership.platform}`,
    `  - bridge: ${summary.ownership.bridge}`,
    `  - user: ${summary.ownership.user}`,
  ];
}

/**
 * Kept for callers that still want the upgrade-preview shape.
 * v2's `notionx update --dry-run` is the canonical preview path;
 * this helper only formats a summary of what would happen.
 */
export interface UpgradePreviewSummary {
  safe: string[];
  review: string[];
  conflict: string[];
}

export function formatUpgradePreview(summary: UpgradePreviewSummary): string[] {
  return [
    "upgrade preview:",
    "  safe:",
    ...summary.safe.map((label) => `    - ${label}`),
    "  review:",
    ...summary.review.map((label) => `    - ${label}`),
    "  conflict:",
    ...summary.conflict.map((label) => `    - ${label}`),
  ];
}

/**
 * Convenience: extract a v1-style "templates" view from a v2
 * manifest. Used by the `diff` command so its output stays
 * stable across the v1→v2 transition.
 */
export function templatesView(manifest: RegistryManifest): string[] {
  return manifest.installed.map((item) => `${item.id}@${item.version}`);
}
