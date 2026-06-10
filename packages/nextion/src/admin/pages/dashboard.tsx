// admin/pages/dashboard.tsx
//
// Generic admin dashboard. Renders a list of the most recent
// Notion-managed posts with quick links to view, edit, and open in
// Notion. The dashboard's data comes from `context.data.getNotionPostsMeta`
// and `context.data.getNotionEditBaseUrl`. UI primitives come from
// `context.ui`.

import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import type { AdminPageContext } from "./types";

export interface AdminDashboardPageProps {
  context: AdminPageContext;
  searchParams: {
    error?: string;
  };
}

export default async function AdminDashboardPage({
  context,
  searchParams,
}: AdminDashboardPageProps) {
  const { ui, data } = context;
  const { Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Alert, AlertTitle, AlertDescription } = ui;

  const { error } = searchParams;
  const posts = (await data?.getNotionPostsMeta?.()) ?? [];
  const notionHref = data?.getNotionEditBaseUrl?.() ?? "#";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文章管理</h1>
          <p className="text-sm text-muted-foreground">
            内容现由 Notion 管理，这里展示公开索引。
          </p>
        </div>
        <Button asChild>
          <a href={notionHref} target="_blank" rel="noreferrer">
            <Plus className="mr-1 h-4 w-4" />
            在 Notion 中新建
          </a>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>无法访问</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          还没有可显示的 Notion 文章。
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">标题</TableHead>
                <TableHead>作者</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>标签</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.slug}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {post.author}
                    </span>
                  </TableCell>
                  <TableCell>
                    <time dateTime={post.date}>{post.date}</time>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {post.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {post.tags.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{post.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/blog/${post.slug}`} prefetch={true}>
                          查看
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/${post.slug}/edit`} prefetch={true}>
                          编辑
                        </Link>
                      </Button>
                      {post.editUrl && (
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={post.editUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Notion
                          </a>
                        </Button>
                      )}
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
