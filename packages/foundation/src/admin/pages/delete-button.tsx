// admin/pages/delete-button.tsx
//
// Generic admin "Delete" button. Wraps a destructive form action in
// an alert dialog. Used in the admin review queue and other places
// where an admin needs to confirm a destructive action. The
// `deletePostAction` is supplied via `context.actions.deletePost`;
// UI primitives come from `context.ui`.

"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { AdminPageContext } from "./types";

export interface AdminDeleteButtonProps {
  context: AdminPageContext;
  slug: string;
  title: string;
}

export default function AdminDeleteButton({
  context,
  slug,
  title,
}: AdminDeleteButtonProps) {
  const { ui, actions } = context;
  const { Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } = ui;

  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const deleteAction = actions?.deletePost;

  if (!deleteAction) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          删除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确定要删除这篇文章吗？</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{title}</span>
            <br />
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{slug}</code>
            <br />
            <br />
            此操作不可撤销。文章将从 D1 数据库和博客列表中永久移除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => formRef.current?.requestSubmit()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      <form ref={formRef} action={deleteAction} style={{ display: "none" }}>
        <input type="hidden" name="slug" value={slug} />
      </form>
    </AlertDialog>
  );
}
