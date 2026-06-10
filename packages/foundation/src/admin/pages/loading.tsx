// admin/pages/loading.tsx
//
// Generic "loading" placeholder used by Next.js when admin pages
// are streaming. Renders a few skeleton rows to keep the layout
// from shifting. UI primitives come from `context.ui`.

import type { AdminPageContext } from "./types";

export interface AdminLoadingPageProps {
  context: AdminPageContext;
}

export default function AdminLoadingPage({ context }: AdminLoadingPageProps) {
  const { ui } = context;
  const { Skeleton } = ui;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>

      <div className="rounded-md border p-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-11/12" />
        </div>
      </div>
    </div>
  );
}
