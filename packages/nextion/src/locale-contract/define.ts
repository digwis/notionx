// packages/nextion/src/locale-contract/define.ts
//
// Registry for locale-aware content sources. Mirrors the shape of
// `defineContentSource` in `content/models.ts` so call sites use the
// same `defineX` / `getRegisteredX` pattern. Re-registering the same
// id replaces the prior value, which keeps HMR + tests deterministic.

import type { LocaleContract } from "./contract";

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
  id: LocaleContract["id"]
): LocaleContract | undefined {
  return registry.find((c) => c.id === id);
}

export function getLocalizedContracts(): readonly LocaleContract[] {
  return registry;
}

export function clearLocalizedRegistryForTests(): void {
  registry.length = 0;
}
