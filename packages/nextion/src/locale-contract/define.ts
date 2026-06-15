// packages/nextion/src/locale-contract/define.ts
//
// Registry for locale-aware content sources. Mirrors the shape of
// `defineContentSource` in `content/models.ts` so call sites use the
// same `defineX` / `getRegisteredX` pattern. Re-registering the same
// id replaces the prior value, which keeps HMR + tests deterministic.

import type {
  FieldMap,
  LocaleContract,
  LocaleFallbackRule,
} from "./contract";

const registry: LocaleContract[] = [];

export function defineLocalizedContentSource(
  contract: LocaleContract
): LocaleContract {
  const existing = registry.findIndex((c) => c.id === contract.id);
  if (existing >= 0) registry[existing] = contract;
  else registry.push(contract);
  return contract;
}

export function getRegisteredLocalizedSource(
  id: string
): LocaleContract | undefined {
  return registry.find((c) => c.id === id);
}

export function getLocalizedContracts(): readonly LocaleContract[] {
  return registry;
}

export function clearLocalizedRegistryForTests(): void {
  registry.length = 0;
}

/**
 * Register a custom locale contract for a non-built-in model (for
 * example `products`, `events`, `recipes`). The contract is added to
 * the same registry the four built-in models use, so the LocaleSwitcher
 * and the path helpers pick it up automatically.
 *
 * The `id` is widened to `string` at the boundary so user code can
 * register any model. Built-in ids are still typed via the
 * `BuiltInLocaleContractId` literal union for the four shipped
 * contracts.
 */
export function defineLocaleContract(input: {
  id: string;
  baseSourceName: string;
  translationSourceName: string;
  listPath: string;
  baseFields: FieldMap;
  translationFields: FieldMap;
  fallback?: LocaleFallbackRule;
  detailParam?: string;
}): LocaleContract {
  const contract: LocaleContract = {
    id: input.id,
    baseSourceName: input.baseSourceName,
    translationSourceName: input.translationSourceName,
    listPath: input.listPath,
    baseFields: input.baseFields,
    translationFields: input.translationFields,
    fallback: input.fallback ?? "default-locale",
    detailParam: input.detailParam ?? "slug",
  };
  return defineLocalizedContentSource(contract);
}
