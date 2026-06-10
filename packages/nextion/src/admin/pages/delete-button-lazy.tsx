// admin/pages/delete-button-lazy.tsx
//
// Client-only dynamic loader for `AdminDeleteButton`. Used by server
// components that need to embed the delete button without paying the
// alert-dialog cost on the first paint.

"use client";

import dynamic from "next/dynamic";
import type { AdminPageContext } from "./types";

export interface AdminDeleteButtonLazyProps {
  context: AdminPageContext;
  slug: string;
  title: string;
}

const AdminDeleteButton = dynamic(() => import("./delete-button"));

export default function AdminDeleteButtonLazy(
  props: AdminDeleteButtonLazyProps
) {
  return <AdminDeleteButton {...props} />;
}
