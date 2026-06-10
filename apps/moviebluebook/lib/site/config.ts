import type { ContentModelDefinition } from "../content/model.ts";
import {
  blogContentModel,
  contentModels,
} from "../content/models.ts";
import { defaultLocale, localizedMovieListPath } from "../i18n/config.ts";

export type SiteRuntimeTarget = "cloudflare-workers";

export type SiteThemePreset =
  | "minimal"
  | "editorial"
  | "catalog"
  | "dashboard";

export type SiteConfig = {
  name: string;
  description: string;
  defaultRuntime: SiteRuntimeTarget;
  content: {
    primaryModelId: string;
    models: readonly ContentModelDefinition[];
  };
  navigation: {
    main: readonly {
      label: string;
      href: string;
      modelId?: string;
    }[];
    adminHref: string;
  };
  ui: {
    themePreset: SiteThemePreset;
    shadcnStyle: "new-york";
    cssVariables: boolean;
  };
};

export const siteConfig: SiteConfig = {
  name: "vinext",
  description:
    "A Notion-powered content foundation for vinext on Cloudflare Workers, D1, R2, and Cloudflare Images.",
  defaultRuntime: "cloudflare-workers",
  content: {
    primaryModelId: blogContentModel.id,
    models: contentModels,
  },
  navigation: {
    main: contentModels
      .filter((model) => model.visibility.public)
      .map((model) => ({
        label: model.ui.navLabel,
        href:
          model.id === "movies"
            ? localizedMovieListPath(defaultLocale)
            : model.routes.listPath,
        modelId: model.id,
      })),
    adminHref: "/login",
  },
  ui: {
    themePreset: "catalog",
    shadcnStyle: "new-york",
    cssVariables: true,
  },
};
