// apps/moviebluebook/app/admin/loading.tsx
//
// Thin delegate to the package's generic admin loading placeholder.

import { LoadingPage } from "@vinext/foundation/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

export default function AdminLoading() {
  return <LoadingPage context={buildAdminPageContext()} />;
}
