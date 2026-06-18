// packages/notionx-cli/src/locale-add/validate.ts
//
// Conservative validator for `notionx locale add <locale>`. The
// command only ever adds, never removes. The validator refuses:
//
//   - empty / whitespace-only input
//   - malformed locales (anything that is not a BCP-47-ish tag of
//     letters, digits, and a single hyphen)
//   - duplicates against the existing `supportedLocales` list
//   - the default locale (adding the default is a no-op)
//
// A well-formed, non-duplicate locale is returned with a normalized
// casing (`zh-cn` → `zh-CN` style, where the region part is upper
// case and the language part is lower case).

const LOCALE_RE = /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/;

export type ValidateLocaleAddInput = {
  locale: string;
  supportedLocales: readonly string[];
  defaultLocale: string;
};

export type ValidateLocaleAddResult =
  | { ok: true; locale: string }
  | { ok: false; reason: string };

function normalize(locale: string): string | null {
  const trimmed = locale.trim();
  if (!trimmed) return null;
  if (!LOCALE_RE.test(trimmed)) return null;
  const [lang, region] = trimmed.split("-");
  return region
    ? `${lang.toLowerCase()}-${region.toUpperCase()}`
    : lang.toLowerCase();
}

export function validateLocaleAdd(
  input: ValidateLocaleAddInput
): ValidateLocaleAddResult {
  const normalized = normalize(input.locale);
  if (!normalized) {
    return { ok: false, reason: `Not a valid locale tag: "${input.locale}"` };
  }
  if (normalized === input.defaultLocale) {
    return {
      ok: false,
      reason: `"${normalized}" is already the default locale`,
    };
  }
  if (input.supportedLocales.includes(normalized)) {
    return {
      ok: false,
      reason: `"${normalized}" is already in supportedLocales`,
    };
  }
  return { ok: true, locale: normalized };
}
