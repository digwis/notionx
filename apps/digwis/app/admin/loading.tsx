import { LoadingPage } from "@notionx/core/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

export default function AdminLoading() {
  return <LoadingPage context={buildAdminPageContext()} />;
}
