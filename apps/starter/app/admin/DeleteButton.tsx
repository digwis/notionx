// apps/starter/app/admin/DeleteButton.tsx
//
// Client-side thin delegate to the package's generic admin delete
// button. The package owns the alert-dialog state machine; the
// starter wires in the design system and the delete-post action.

"use client";

import { DeleteButton } from "@vinext/foundation/admin/pages";
import { buildAdminPageContext } from "@/lib/admin/context";

type Props = {
  slug: string;
  title: string;
};

export default function AdminDeleteButton({ slug, title }: Props) {
  return (
    <DeleteButton
      context={buildAdminPageContext()}
      slug={slug}
      title={title}
    />
  );
}
