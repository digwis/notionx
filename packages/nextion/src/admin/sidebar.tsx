// admin/sidebar.tsx
//
// Vertical sidebar that renders the sorted, role-filtered nav. The
// `renderLink` prop is supplied by `AdminShell` — it defaults to a
// plain `<a>` and consumers can override it with their design-system
// link primitive.

import type { ReactNode } from "react";
import type { AdminNavItem } from "../types";

export interface AdminSidebarLinkRenderProps {
  href: string;
  active: boolean;
  external?: boolean;
  children: ReactNode;
}

export type AdminSidebarLinkRenderer = (
  props: AdminSidebarLinkRenderProps
) => ReactNode;

export interface AdminSidebarProps {
  items: AdminNavItem[];
  activeHref: string;
  renderLink: AdminSidebarLinkRenderer;
}

function isActive(itemHref: string, currentHref: string): boolean {
  if (itemHref === currentHref) return true;
  // Treat the dashboard ("/admin") as active only when the current
  // path is exactly "/admin" — don't let it greedily match every
  // nested admin page.
  if (itemHref === "/admin") return currentHref === "/admin";
  return currentHref === itemHref || currentHref.startsWith(itemHref + "/");
}

export function AdminSidebar({
  items,
  activeHref,
  renderLink,
}: AdminSidebarProps) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Admin"
      className="hidden w-56 shrink-0 md:block"
    >
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            {renderLink({
              href: item.href,
              active: isActive(item.href, activeHref),
              external: item.external,
              children: item.labelKey,
            })}
          </li>
        ))}
      </ul>
    </nav>
  );
}
