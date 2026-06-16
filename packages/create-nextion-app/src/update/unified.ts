import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectContext } from "../project-context.js";
import type { UpdatePlanEntry } from "./template-sync.js";
import type {
  UnifiedUpdateEntry,
  UnifiedUpdatePlan,
  UnifiedUpdateSummary,
} from "./types.js";
import { toUnifiedUpdateRisk } from "./ownership.js";

function toFileEntry(
  context: ProjectContext,
  entry: UpdatePlanEntry
): UnifiedUpdateEntry | null {
  if (entry.status === "unchanged" || entry.status === "skipped") {
    return null;
  }
  if (entry.nextContent === undefined) {
    return null;
  }

  const risk = toUnifiedUpdateRisk({
    filePath: entry.filePath,
    status: entry.status,
    managedFiles: context.managedFiles,
  });

  return {
    label: `file:${entry.filePath}`,
    kind: "file",
    risk,
    group: "codeTemplate",
    async apply() {
      const filePath = path.join(context.projectDir, entry.filePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, entry.nextContent!, "utf8");
    },
  };
}

export async function buildUnifiedUpdatePlan(input: {
  context: ProjectContext;
  templateEntries: UpdatePlanEntry[];
  repairEntries: UnifiedUpdateEntry[];
}): Promise<UnifiedUpdatePlan> {
  const fileEntries = input.templateEntries
    .map((entry) => toFileEntry(input.context, entry))
    .filter((entry): entry is UnifiedUpdateEntry => entry !== null);
  const allEntries = [...fileEntries, ...input.repairEntries];
  const safe = allEntries.filter((entry) => entry.risk === "safe");
  const review = allEntries.filter((entry) => entry.risk === "review");
  const conflicts = allEntries.filter((entry) => entry.risk === "conflict");

  return {
    safe,
    review,
    conflicts,
    conflictGroups: {
      codeTemplate: conflicts.filter((entry) => entry.group === "codeTemplate"),
      notionContent: conflicts.filter((entry) => entry.group === "notionContent"),
      cloudflareBinding: conflicts.filter(
        (entry) => entry.group === "cloudflareBinding"
      ),
    },
  };
}

export async function runUnifiedUpdate(
  context: ProjectContext,
  input: {
    templateEntries: UpdatePlanEntry[];
    repairEntries: UnifiedUpdateEntry[];
    conflictChoice: "apply-all" | "safe-only";
  }
): Promise<UnifiedUpdateSummary> {
  const plan = await buildUnifiedUpdatePlan({
    context,
    templateEntries: input.templateEntries,
    repairEntries: input.repairEntries,
  });

  for (const entry of plan.safe) {
    await entry.apply();
  }

  const appliedConflicts: UnifiedUpdateEntry[] = [];
  if (input.conflictChoice === "apply-all") {
    for (const entry of plan.conflicts) {
      await entry.apply();
      appliedConflicts.push(entry);
    }
  }

  return {
    appliedSafe: plan.safe,
    appliedConflicts,
    reviewRemaining: plan.review,
    conflictsRemaining:
      input.conflictChoice === "apply-all" ? [] : plan.conflicts,
    needsInstall: [...plan.safe, ...appliedConflicts].some(
      (entry) => entry.label === "file:package.json"
    ),
    compatibilityPreserved:
      context.metadata.compatibility === "legacy-vinext" ||
      context.metadata.nextionSource === "workspace:*",
  };
}

export function formatUnifiedUpdateSummary(
  summary: UnifiedUpdateSummary
): string[] {
  const lines: string[] = [];

  if (summary.appliedSafe.length > 0) {
    lines.push("safe updates:");
    for (const entry of summary.appliedSafe) {
      lines.push(`  - ${entry.label}`);
    }
  }

  if (summary.reviewRemaining.length > 0) {
    lines.push("review items:");
    for (const entry of summary.reviewRemaining) {
      lines.push(`  - ${entry.label}`);
    }
  }

  if (summary.appliedConflicts.length > 0) {
    lines.push("conflict updates:");
    for (const entry of summary.appliedConflicts) {
      lines.push(`  - ${entry.label}`);
    }
  }

  if (summary.conflictsRemaining.length > 0) {
    lines.push("conflicts remaining:");
    for (const entry of summary.conflictsRemaining) {
      lines.push(`  - ${entry.label}`);
    }
  }

  if (summary.compatibilityPreserved) {
    lines.push("compatibility:");
    lines.push("  - legacy mode preserved: `nextionSource` left as `workspace:*`");
  }

  if (summary.needsInstall) {
    lines.push("follow-up:");
    lines.push("  - run `pnpm install`");
  }

  return lines;
}
