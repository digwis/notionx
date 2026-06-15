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

export type LocaleContract = {
  /** Stable identifier; matches the registered content-source id. */
  id: "blog" | "pages" | "blocks" | "site-settings";
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

export function isLocaleContractId(
  value: string
): value is LocaleContract["id"] {
  return (
    value === "blog" ||
    value === "pages" ||
    value === "blocks" ||
    value === "site-settings"
  );
}
