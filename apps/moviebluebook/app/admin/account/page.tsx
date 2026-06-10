// apps/moviebluebook/app/admin/account/page.tsx
//
// Thin delegate to the package's generic admin account page.

import { AccountPage } from "@vinext/foundation/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

export default async function AdminAccountPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <AccountPage
      context={buildAdminPageContext()}
      searchParams={sp}
    />
  );
}
