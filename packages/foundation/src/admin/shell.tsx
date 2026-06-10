// admin/shell.tsx
//
// The `AdminShell` is the top-level wrapper for every page rendered
// under `/admin`. It composes a header (brand + user info + slot for
// the consumer's secondary links), a sidebar (built from the supplied
// `nav` prop, sorted and role-filtered by `createAdminNav`), and a
// main content area.
//
// The package stays unopinionated about the design system by taking
// a `ui` prop with render slots for the few interactive bits (the
// brand link, sidebar links, the logout form). Consumers wire their
// own shadcn/radix/Tailwind components in. The defaults are plain
// HTML elements that work without any setup.

import type { ReactNode } from "react";
import type { AdminNavItem } from "../types";
import { createAdminNav } from "./nav";
import { AdminHeader } from "./header";
import { AdminSidebar } from "./sidebar";

/**
 * Minimal viewer shape the shell needs to render the header. The
 * consumer's full `AdminViewer` may carry more fields; only the
 * fields the shell actually reads are required here.
 */
export interface AdminShellViewer {
  email: string;
  name?: string | null;
  picture?: string | null;
  isAdmin?: boolean;
  role?: string | null;
}

/**
 * Slots the consumer can fill with their own design-system primitives.
 * Every slot is optional — the shell falls back to plain HTML when a
 * slot is not provided so projects without shadcn still render.
 */
export interface AdminShellUI {
  /** Render a brand link (e.g. the "vinext Admin" mark). */
  BrandLink?: (props: { href: string; children: ReactNode }) => ReactNode;
  /** Render a single sidebar entry. */
  SidebarLink?: (props: {
    href: string;
    active: boolean;
    external?: boolean;
    children: ReactNode;
  }) => ReactNode;
  /** Render a single header link/button (e.g. theme toggle, logout). */
  HeaderAction?: (props: { children: ReactNode }) => ReactNode;
}

export interface AdminShellProps {
  /** Raw nav items. The shell sorts and role-filters them. */
  nav: AdminNavItem[];
  /** Currently authenticated viewer. */
  viewer: AdminShellViewer;
  /** Current pathname; used to mark the active sidebar entry. */
  pathname?: string;
  /** Brand label rendered in the header. Defaults to "Admin". */
  brandLabel?: string;
  /** Brand link target. Defaults to "/admin". */
  brandHref?: string;
  /** Extra links rendered in the header (e.g. "view site"). */
  headerLinks?: ReactNode;
  /** Extra actions rendered in the header right cluster (logout, etc.). */
  headerActions?: ReactNode;
  /** Slots for design-system primitives. */
  ui?: AdminShellUI;
  /** Roles the viewer has; controls role-gated nav items. */
  viewerRoles?: string[];
  children: ReactNode;
}

/**
 * Default `<a>` for sidebar links. Renders an external `target` when
 * the nav item is marked external.
 */
function defaultSidebarLink({
  href,
  active,
  external,
  children,
}: {
  href: string;
  active: boolean;
  external?: boolean;
  children: ReactNode;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={
          "block rounded-md px-3 py-2 text-sm font-medium " +
          (active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")
        }
      >
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      className={
        "block rounded-md px-3 py-2 text-sm font-medium " +
        (active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")
      }
    >
      {children}
    </a>
  );
}

/**
 * Top-level admin chrome. Re-exports the sidebar/header pieces so
 * projects that want to rearrange the layout (e.g. put the sidebar
 * on the right) can swap them in.
 */
export function AdminShell({
  nav,
  viewer,
  pathname,
  brandLabel = "Admin",
  brandHref = "/admin",
  headerLinks,
  headerActions,
  ui,
  viewerRoles,
  children,
}: AdminShellProps) {
  const items = createAdminNav(nav, { roles: viewerRoles });
  const activeHref = pathname ?? "/admin";
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader
        viewer={viewer}
        brandLabel={brandLabel}
        brandHref={brandHref}
        headerLinks={headerLinks}
        headerActions={headerActions}
        ui={ui}
      />
      <div className="container mx-auto flex max-w-6xl gap-8 px-4 py-8">
        <AdminSidebar
          items={items}
          activeHref={activeHref}
          renderLink={ui?.SidebarLink ?? defaultSidebarLink}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export type { AdminNavItem };
export { AdminHeader } from "./header";
export { AdminSidebar } from "./sidebar";
