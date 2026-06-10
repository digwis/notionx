// admin/pages/content-models.tsx
//
// Generic "content models" admin page. Renders a registry-style
// overview of every content model registered by the project (id,
// kind, visibility, public routes, capabilities, fields). Data
// comes from `context.data.getContentModelAdminSummaries`; UI
// primitives come from `context.ui`.

import type { Metadata } from "next";
import { Database, Route } from "lucide-react";
import type { AdminPageContext, ContentModelAdminSummary } from "./types";

export const metadata: Metadata = {
  title: "Content Sources",
};

export interface AdminContentModelsPageProps {
  context: AdminPageContext;
}

function statusVariant(value: string) {
  if (value === "public+admin" || value === "public") return "default";
  if (value === "admin") return "secondary";
  return "outline";
}

function capabilityBadges(model: ContentModelAdminSummary) {
  return [
    model.capabilities.richBlocks ? "rich blocks" : "",
    model.capabilities.coverImages ? "cover images" : "",
    model.capabilities.gatedAssets ? "gated assets" : "",
  ].filter(Boolean);
}

export default function AdminContentModelsPage({
  context,
}: AdminContentModelsPageProps) {
  const { ui, data } = context;
  const { Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = ui;

  const models = data?.getContentModelAdminSummaries?.() ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Database className="h-7 w-7" />
          内容来源
        </h1>
        <p className="text-sm text-muted-foreground">
          查看当前项目直接实现的 Notion 数据源、公开路由和基础能力。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>模型注册表</CardTitle>
          <CardDescription>
            这些模型来自 <code className="rounded bg-muted px-1.5 py-0.5 text-xs">lib/content/models.ts</code>。
            新领域由 AI 直接新增模型、路由和 UI 代码。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模型</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>可见性</TableHead>
                  <TableHead>Notion</TableHead>
                  <TableHead>路由</TableHead>
                  <TableHead>能力</TableHead>
                  <TableHead className="text-right">字段</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {model.id}
                      </div>
                    </TableCell>
                    <TableCell>{model.kind}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(model.visibility) as "default" | "secondary" | "outline"}>
                        {model.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">
                        {model.dataSourceEnv}
                      </div>
                      {model.hasDefaultDataSource && (
                        <Badge variant="secondary" className="mt-1">
                          default id
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">{model.listPath}</div>
                      <div className="text-xs text-muted-foreground">
                        {model.detailPath}
                      </div>
                      {model.publicApiPath && (
                        <div className="text-xs text-muted-foreground">
                          {model.publicApiPath}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {capabilityBadges(model).map((capability) => (
                          <Badge key={capability} variant="secondary">
                            {capability}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {model.fieldCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{model.name}</span>
                <Badge variant={statusVariant(model.visibility) as "default" | "secondary" | "outline"}>
                  {model.visibility}
                </Badge>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Route className="h-3.5 w-3.5" />
                  {model.listPath}
                </span>
                <span>{model.detailPath}</span>
                {model.publicApiPath && <span>{model.publicApiPath}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Notion data source env
                  </div>
                  <code className="mt-1 block rounded-md bg-muted px-2 py-1.5 text-xs">
                    {model.dataSourceEnv}
                  </code>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Public API
                  </div>
                  <div>{model.publicApiPath ?? "None"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Capabilities
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {capabilityBadges(model).map((capability) => (
                      <Badge key={capability} variant="secondary">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
