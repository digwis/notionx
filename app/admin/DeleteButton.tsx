"use client";

// 删除按钮：用 shadcn AlertDialog 替代原生 confirm()
// 点 "确认删除" 才提交 form 到 Server Action。

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { deletePostAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  slug: string;
  title: string;
};

export default function DeleteButton({ slug, title }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
      <form ref={formRef} action={deletePostAction} style={{ display: "none" }}>
        <input type="hidden" name="slug" value={slug} />
      </form>
    </AlertDialog>
  );
}
