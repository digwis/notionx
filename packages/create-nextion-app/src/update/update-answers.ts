import { DEFAULT_ANSWERS, type Answers } from "../prompt.js";
import type { ProjectContext } from "../project-context.js";

export function buildUpdateAnswers(context: ProjectContext): Answers {
  // Legacy / hand-authored projects explicitly opted into the
  // "workspace:*" protocol via the `compatibility: legacy-vinext`
  // marker. We must not let a normal `update` run rewrite the
  // generated `package.json` to pull a real semver from npm —
  // that would silently break the workspace symlink the rest of
  // the monorepo (and the user's other apps) depends on.
  //
  // This is the only behavioural difference the `compatibility`
  // field introduces; everything else (template-rendered
  // `wrangler.jsonc`, `README.md`, `.dev.vars.example`) is still
  // produced by the update plan, and the user can still refuse
  // to apply it via the interactive prompt.
  const isLegacyWorkspace =
    context.metadata.compatibility === "legacy-vinext" ||
    context.metadata.nextionSource === "workspace:*";

  return {
    projectName: context.metadata.projectName,
    targetDir: context.projectDir,
    defaultLocale: context.metadata.defaultLocale,
    supportedLocales: [...context.metadata.supportedLocales],
    nextionSource: isLegacyWorkspace
      ? "workspace:*"
      : context.metadata.nextionSource,
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
