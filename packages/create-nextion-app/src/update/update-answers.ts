import { DEFAULT_ANSWERS, type Answers } from "../prompt.js";
import type { ProjectContext } from "../project-context.js";

export function buildUpdateAnswers(context: ProjectContext): Answers {
  return {
    projectName: context.metadata.projectName,
    targetDir: context.projectDir,
    defaultLocale: context.metadata.defaultLocale,
    supportedLocales: [...context.metadata.supportedLocales],
    nextionSource: context.metadata.nextionSource,
    uiPreset: context.metadata.uiPreset,
    enableSiteSettings: context.metadata.enableSiteSettings ?? true,
    contentSource: {
      id: context.metadata.contentSource.id,
      title: context.metadata.contentSource.title,
      fields: context.metadata.contentSource.fields.map((field) => ({
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
