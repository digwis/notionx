// apps/moviebluebook/app/admin/users/page.tsx
//
// Thin delegate to the package's generic admin user-management page.

import { UsersPage } from "@vinext/foundation/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

type Props = {
  searchParams: Promise<{
    revoked?: string;
    deleted?: string;
    roleUpdated?: string;
    error?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <UsersPage
      context={buildAdminPageContext()}
      searchParams={sp}
    />
  );
}
