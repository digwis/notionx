// apps/starter/app/admin/page.tsx
//
// Thin delegate to the package's generic admin dashboard. Builds
// an `AdminPageContext` and forwards the page's `searchParams`.

import { DashboardPage } from "@vinext/foundation/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

type Props = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function AdminDashboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <DashboardPage
      context={buildAdminPageContext()}
      searchParams={sp}
    />
  );
}
