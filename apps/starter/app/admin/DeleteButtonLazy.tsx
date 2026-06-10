// apps/starter/app/admin/DeleteButtonLazy.tsx
//
// Client-only dynamic loader for the admin delete button. Used by
// server components that need to embed the button without paying
// the alert-dialog cost on the first paint.

"use client";

import dynamic from "next/dynamic";

const DeleteButton = dynamic(() => import("./DeleteButton"));

export default DeleteButton;
