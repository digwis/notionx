// packages/nextion/src/locale-contract/contract.ts
//
// Canonical types for the multilingual foundation. A `LocaleContract`
// pins the Notion data-source name, the base field map, the translation
// field map, and the lookup fallback rule for one built-in model. The
// shape mirrors the `moviebluebook` `base + translations` pattern,
// generalized to the four built-in starter models.

export type LocaleFallbackRule =
  | "default-locale"   // fall back to default locale copy
  | "strict-missing"   // hide / 404 when missing
  | "hide";            // exclude from list / detail when missing

export type FieldMap = Record<string, string>;

/** Built-in locale contract ids. The four core models use these. */
export type BuiltInLocaleContractId =
  | "blog"
  | "pages"
  | "blocks"
  | "site-settings";

export type LocaleContract = {
  /**
   * Stable identifier. Built-in models use a `BuiltInLocaleContractId`
   * literal; user code can register custom contracts with any string
   * via `defineLocaleContract`.
   */
  id: BuiltInLocaleContractId | (string & {});
  /** Notion data source name for the base side. */
  baseSourceName: string;
  /** Notion data source name for the translation side. */
  translationSourceName: string;
  /** Base-side Notion property names. */
  baseFields: FieldMap;
  /** Translation-side Notion property names. */
  translationFields: FieldMap;
  /** Lookup fallback rule for this model. */
  fallback: LocaleFallbackRule;
  /** Default list route for this model (used by path helpers). */
  listPath: string;
  /** Path segment used inside the detail route. */
  detailParam: string;
};

export function isBuiltInLocaleContractId(
  value: string
): value is BuiltInLocaleContractId {
  return (
    value === "blog" ||
    value === "pages" ||
    value === "blocks" ||
    value === "site-settings"
  );
}

/**
 * @deprecated kept for backward compatibility. Prefer
 * `isBuiltInLocaleContractId` for the same check.
 */
export const isLocaleContractId = isBuiltInLocaleContractId;
