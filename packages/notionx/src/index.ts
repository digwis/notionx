// Public top-level entry. Subpath exports carry the bulk of the API.
export type {
  ContentSource,
  AuthConfig,
  AdminNavItem,
} from "./types";

export { defineContentSource } from "./content/models";
export { createNotionxWorker } from "./worker/bootstrap";
export { runNotionxDoctor } from "./doctor";
export type {
  DoctorFinding,
  RuntimeLike,
  RunNotionxDoctorOptions,
  NotionxDoctorFindingsReport,
} from "./doctor";

// Multilingual foundation: the built-in four-model locale contract
// and the lookup / path / switcher primitives. Re-exported from the
// root so generated projects can `import { ... } from "@notionx/core"`.
export type {
  LocaleContract,
  LocaleFallbackRule,
  FieldMap,
} from "./locale-contract/contract";
export {
  blogContract,
  blocksContract,
  pagesContract,
  siteSettingsContract,
} from "./locale-contract/built-in";
export {
  defineLocalizedContentSource,
  getRegisteredLocalizedSource,
  getLocalizedContracts,
} from "./locale-contract/define";
export {
  pickTranslation,
  pickTranslationOrDefault,
  hideWhenMissing,
} from "./locale-contract/lookup";
export {
  localizedListPath,
  localizedDetailPathFor,
  stripLocalePrefix,
} from "./locale-contract/paths";
export {
  buildLocaleSwitcherLinks,
  type LocaleSwitcherLink,
  type LocaleSwitcherTranslation,
} from "./locale-contract/locale-switcher";
export {
  listGenericNotionContentForLocale,
  getGenericNotionContentBySlugForLocale,
  createLocalizedGenericNotionContentSource,
  type LocalizedGenericContentSourceDeps,
} from "./content/localized-source";
export {
  localizeContentList,
  mapNotionPageToLocalizedContentTranslation,
  getAlternateLocalizedContentLinks,
  type LocalizedContentTranslation,
  type LocalizedContentFields,
} from "./content/localized";
