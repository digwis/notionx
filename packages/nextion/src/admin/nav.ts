// Admin sidebar nav factory. Sorts items by `order` (ascending) and
// then by `labelKey` (locale-aware ascending) as a stable tiebreaker.
// When the caller passes `roles`, items whose `requireRole` is set and
// not in the supplied role list are filtered out — this is how the
// admin shell hides admin-only entries for plain logged-in viewers.

import type { AdminNavItem } from "../types";

export interface AdminNavOptions {
  /**
   * Roles the current viewer has. When supplied, any item whose
   * `requireRole` is set and not in this list is dropped. When omitted,
   * no role filtering is applied.
   */
  roles?: string[];
}

/**
 * Build the visible admin nav for a viewer. The returned array is a
 * fresh copy; mutating it does not affect the caller's input.
 */
export function createAdminNav(
  items: AdminNavItem[],
  options: AdminNavOptions = {}
): AdminNavItem[] {
  const visible = options.roles
    ? items.filter(
        (i) => !i.requireRole || options.roles!.includes(i.requireRole)
      )
    : items.slice();
  return visible.sort((a, b) => {
    const orderDiff = (a.order ?? 100) - (b.order ?? 100);
    return orderDiff !== 0 ? orderDiff : a.labelKey.localeCompare(b.labelKey);
  });
}
