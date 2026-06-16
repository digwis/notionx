import { DEFAULT_ANSWERS, type Answers } from "../prompt.js";
import type { LoadedRegistry } from "../registry/registry-types.js";
import { provision } from "./index.js";
import { defaultProvisionMode } from "./options.js";
import { inspectProvisionRepair } from "./inspect.js";

export { inspectProvisionRepair } from "./inspect.js";

export function buildRepairAnswers(registry: LoadedRegistry): Answers {
  const m = registry.manifest;
  return {
    projectName: m.projectName,
    targetDir: process.cwd(),
    defaultLocale: m.defaultLocale,
    supportedLocales: [...m.supportedLocales],
    nextionSource: m.nextionCore,
    enableSiteSettings: m.enableSiteSettings,
    enableBlocks: m.enableBlocks,
    enableAuth: m.enableAuth,
    enableAdmin: m.enableAdmin,
    enablePages: m.enablePages,
    enableSearch: m.enableSearch,
    contentSource: {
      id: m.contentSource.id,
      title: m.contentSource.title,
      fields: m.contentSource.fields.map((field) => ({
        key: field.key,
        notionName: field.notionName,
      })),
    },
    adminEmail: DEFAULT_ANSWERS.adminEmail,
    adminPassword: DEFAULT_ANSWERS.adminPassword,
    notionParentPage: DEFAULT_ANSWERS.notionParentPage,
    notionSeedCount: DEFAULT_ANSWERS.notionSeedCount,
  };
}

export async function runProvisionRepair(
  registry: LoadedRegistry,
  projectDir: string,
  answers: Answers = buildRepairAnswers(registry),
  options: { conflictChoice?: "apply-all" | "safe-only" } = {}
) {
  if (options.conflictChoice) {
    const entries = await inspectProvisionRepair(projectDir);
    const applicable = entries.filter((entry) =>
      options.conflictChoice === "apply-all" ? true : entry.risk === "safe"
    );

    for (const entry of applicable) {
      await entry.apply();
    }

    return { answers, appliedEntries: applicable };
  }

  return provision(answers, projectDir, {
    interactive: false,
    mode: defaultProvisionMode("repair"),
  });
}
