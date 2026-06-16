export const INSTALLATIONS_FILE = ".nextion/installations.json";
export const MANAGED_FILES_FILE = ".nextion/managed-files.json";
export const DEFAULT_SITE_TEMPLATE = "blog" as const;

export type TemplateKind = "site-template" | "feature-module";
export type OwnershipKind = "platformManaged" | "bridge" | "userOwned";

export interface TemplateInstallationRecord {
  name: string;
  kind: TemplateKind;
  version: number;
  params: Record<string, string>;
}

export interface InstallationManifest {
  templates: TemplateInstallationRecord[];
  modules: TemplateInstallationRecord[];
}

export interface ManagedFilesManifest {
  platformManaged: string[];
  bridge: string[];
  userOwned: string[];
}

export function buildDefaultInstallationManifest(input: {
  contentSourceId: string;
  siteTemplate?: string;
}): InstallationManifest {
  const siteTemplate = input.siteTemplate ?? DEFAULT_SITE_TEMPLATE;
  return {
    templates: [
      {
        name: siteTemplate,
        kind: "site-template",
        version: 1,
        params: { contentSourceId: input.contentSourceId },
      },
    ],
    modules: [],
  };
}

export function buildDefaultManagedFilesManifest(input?: {
  siteTemplate?: string;
}): ManagedFilesManifest {
  const siteTemplate = input?.siteTemplate ?? DEFAULT_SITE_TEMPLATE;
  const userOwned = [
    "app/page.tsx",
    "components/site/site-header.tsx",
    "components/site/site-footer.tsx",
    "lib/content/models.ts",
  ];

  if (siteTemplate === "blog") {
    userOwned.push("app/blog/page.tsx", "app/blog/[slug]/page.tsx");
  }

  return {
    platformManaged: [
      "package.json",
      "wrangler.jsonc",
      "next.config.ts",
      ".dev.vars.example",
    ],
    bridge: ["worker/index.ts"],
    userOwned,
  };
}
