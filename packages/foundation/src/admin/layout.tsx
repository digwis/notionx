// admin/layout.tsx
//
// Convenience Next.js layout that fetches the current viewer through
// a caller-supplied async function and renders the `AdminShell`.
// Projects that need extra wrapping (e.g. a custom redirect on
// unauthenticated viewers) can keep using `AdminShell` directly and
// skip this helper.

import type { ReactNode } from "react";
import { AdminShell, type AdminShellViewer, type AdminShellUI } from "./shell";
import type { AdminNavItem } from "../types";

export interface AdminLayoutProps {
  nav: AdminNavItem[];
  /** Resolves the currently authenticated viewer. Return `null` for guests. */
  getViewer: () => Promise<AdminShellViewer | null>;
  /** Path the user is redirected to when `getViewer` returns `null`. */
  loginPath?: string;
  /** Current pathname; used to mark the active sidebar entry. */
  pathname?: string;
  brandLabel?: string;
  brandHref?: string;
  headerLinks?: ReactNode;
  headerActions?: ReactNode;
  ui?: AdminShellUI;
  /**
   * Roles the viewer has. Pass `viewer.isAdmin ? ["admin"] : ["user"]`
   * (or your role catalog) to enable role-based nav filtering.
   */
  viewerRoles?: string[];
  children: ReactNode;
}

/**
 * Async Next.js layout. If the viewer is missing, renders a minimal
 * "Redirecting…" placeholder and the consumer's `_redirect` mechanism
 * (set `loginPath` and let the consumer wrap in a `redirect()` from
 * `next/navigation`). For simpler use, pass a `getViewer` that throws
 * a redirect.
 */
export async function AdminLayout({
  nav,
  getViewer,
  loginPath = "/login",
  pathname,
  brandLabel,
  brandHref,
  headerLinks,
  headerActions,
  ui,
  viewerRoles,
  children,
}: AdminLayoutProps) {
  const viewer = await getViewer();
  if (!viewer) {
    // The consumer should pass a `getViewer` that throws/redirects
    // when the user is unauthenticated. This branch is a safety net
    // for callers that prefer a non-throwing getter.
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Redirecting to{" "}
        <a className="ml-1 underline" href={loginPath}>
          {loginPath}
        </a>
        …
      </div>
    );
  }
  return (
    <AdminShell
      nav={nav}
      viewer={viewer}
      pathname={pathname}
      brandLabel={brandLabel}
      brandHref={brandHref}
      headerLinks={headerLinks}
      headerActions={headerActions}
      ui={ui}
      viewerRoles={viewerRoles}
    >
      {children}
    </AdminShell>
  );
}
