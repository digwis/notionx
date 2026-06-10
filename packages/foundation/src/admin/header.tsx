// admin/header.tsx
//
// Top bar for the admin shell. Renders the brand mark, any extra
// header links supplied by the consumer, and a user-info cluster
// (avatar + name + admin badge). The consumer can drop additional
// actions into the right cluster via the `headerActions` slot.

import type { ReactNode } from "react";
import type { AdminShellViewer, AdminShellUI } from "./shell";

export interface AdminHeaderProps {
  viewer: AdminShellViewer;
  brandLabel: string;
  brandHref: string;
  headerLinks?: ReactNode;
  headerActions?: ReactNode;
  ui?: AdminShellUI;
}

function defaultBrandLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 text-sm font-semibold"
    >
      {children}
    </a>
  );
}

export function AdminHeader({
  viewer,
  brandLabel,
  brandHref,
  headerLinks,
  headerActions,
  ui,
}: AdminHeaderProps) {
  const BrandLink = ui?.BrandLink ?? defaultBrandLink;
  return (
    <header className="border-b bg-muted/30">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <BrandLink href={brandHref}>
            <span aria-hidden="true">●</span>
            {brandLabel}
          </BrandLink>
          {headerLinks}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs">
            {viewer.picture && (
              <img
                src={viewer.picture}
                alt=""
                className="h-5 w-5 rounded-full"
              />
            )}
            <span className="hidden font-medium sm:inline">
              {viewer.name || viewer.email}
            </span>
            {viewer.isAdmin && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Admin
              </span>
            )}
          </div>
          {headerActions}
        </div>
      </div>
    </header>
  );
}
