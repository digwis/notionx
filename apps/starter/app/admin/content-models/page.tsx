// apps/starter/app/admin/content-models/page.tsx
//
// Thin delegate to the package's generic admin content-models page.

import { ContentModelsPage } from "@vinext/foundation/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

export default function AdminContentModelsPage() {
  return <ContentModelsPage context={buildAdminPageContext()} />;
}
