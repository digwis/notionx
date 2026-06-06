import Link from "next/link";
import { Plus } from "lucide-react";
import { getPostsForAdmin } from "@/lib/posts";
import { getAdminViewer } from "@/lib/admin-viewer";
import { perfSpan } from "@/lib/perf-trace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DeleteButtonLazy from "./DeleteButtonLazy";

type Props = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function AdminDashboard({ searchParams }: Props) {
  const { created, updated, deleted, error } = await searchParams;
  // viewer 已经被 layout 算过（cache 命中），但 searchParams 解析独立计时
  const { viewerEmail, admin } = await perfSpan(
    { span: "admin.viewer", pageClass: "admin_list" },
    () => getAdminViewer()
  );
  const posts = await perfSpan(
    { span: "posts.getPostsForAdmin", pageClass: "admin_list", extra: { is_admin: admin } },
    () => getPostsForAdmin(viewerEmail, admin)
  );

  let flash: { title: string; desc: string } | null = null;
  if (created) flash = { title: "创建成功", desc: `已创建文章：${created}` };
  else if (updated)
    flash = { title: "更新成功", desc: `已更新文章：${updated}` };
  else if (deleted)
    flash = { title: "删除成功", desc: `已删除文章：${deleted}` };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文章管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {posts.length} 篇文章
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/new">
            <Plus className="mr-1 h-4 w-4" />
            新建文章
          </Link>
        </Button>
      </div>

      {flash && (
        <Alert>
          <AlertTitle>{flash.title}</AlertTitle>
          <AlertDescription>{flash.desc}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>无法访问</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          还没有任何文章。<Link href="/admin/new" className="underline">写一篇</Link>。
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>作者</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>标签</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.slug}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/${p.slug}`}
                      className="hover:underline"
                    >
                      {p.title}
                    </Link>
                    {!admin && p.owner_email === viewerEmail && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        你的
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                    {p.status === "rejected" && p.reject_reason && (
                      <p
                        className="mt-1 max-w-[220px] truncate text-[10px] text-rose-700"
                        title={p.reject_reason}
                      >
                        {p.reject_reason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.owner_email === viewerEmail ? (
                      <Badge variant="outline" className="text-[10px]">
                        你
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {p.owner_email}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <time dateTime={p.date}>{p.date}</time>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                      {p.tags.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{p.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/${p.slug}`} prefetch={true}>查看</Link>
                      </Button>
                      {(admin || p.owner_email === viewerEmail) &&
                        (admin || p.status === "draft" || p.status === "rejected") && (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/admin/${p.slug}/edit`} prefetch={true}>编辑</Link>
                          </Button>
                        )}
                      <DeleteButtonLazy slug={p.slug} title={p.title} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
