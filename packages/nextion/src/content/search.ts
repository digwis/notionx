// packages/nextion/src/content/search.ts
//
// Generic text-search helpers for content sources.

export function normalizeSearchQuery(query: string | null | undefined) {
  return String(query ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function searchTerms(query: string | null | undefined) {
  const normalized = normalizeSearchQuery(query);
  return normalized ? normalized.split(" ") : [];
}

function searchableText(values: readonly unknown[]) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string | number | boolean =>
      ["string", "number", "boolean"].includes(typeof value)
    )
    .map((value) => String(value))
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}

export function matchesSearchQuery(
  values: readonly unknown[],
  query: string | null | undefined
) {
  const terms = searchTerms(query);
  if (terms.length === 0) return true;

  const haystack = searchableText(values);
  return terms.every((term) => haystack.includes(term));
}

export function filterItemsBySearch<TItem>(
  items: readonly TItem[],
  valuesForItem: (item: TItem) => readonly unknown[],
  query: string | null | undefined
) {
  return items.filter((item) => matchesSearchQuery(valuesForItem(item), query));
}
