// apps/starter/app/admin/settings/page.tsx
//
// Thin delegate to the package's generic admin settings page.

import { SettingsPage } from "@vinext/foundation/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

export default async function AdminSettingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <SettingsPage
      context={buildAdminPageContext()}
      searchParams={sp}
    />
  );
}
