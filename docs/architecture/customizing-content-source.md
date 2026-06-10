# 自定义内容源

> 范围：在一个**已有**项目里，添加第二个 `defineContentSource`（"领域"），不
> 是脚手架流程。脚手架新建项目请看
> [创建新项目](./creating-new-project.md)。

## 真实场景

`apps/moviebluebook` 已经注册了 `blog` 和 `movies` 两个内容源。下面以"再加一个
`podcasts` 播客目录"为例演示完整的改包路径：模型、路由、可选 Admin 入口、
search index 目标。每一节都给出真实可用的 diff 片段。

## 1. 在 Notion 中创建数据源

在 Notion 里新建一个 data source，记录它的 `dataSourceId`，并准备字段
（`Title`、`Slug`、`Published`、`Date`、`Hosts`、`Episode` 等）。项目会通过环
境变量引用它；不需要改任何 package 代码。

## 2. 写模型（`lib/content/models.ts`）

打开 `apps/moviebluebook/lib/content/models.ts`，在已有 `blogContentModel` 旁边追加
一个 `podcastContentModel`：

```ts
// apps/moviebluebook/lib/content/models.ts
import {
  defineContentSource,
  getRegisteredSource,
  type ContentSource,
} from "@nextion/core/content";

export const podcastContentModel: ContentSource = defineContentSource({
  id: "podcasts",
  kind: "catalog",
  visibility: { public: true, admin: true },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_PODCASTS_DATA_SOURCE_ID",
    fields: {
      title: "Title",
      slug: "Slug",
      date: "Date",
      hosts: "Hosts",
      episode: "Episode",
      cover: "Cover",
      status: "Status",
      published: "Published",
    },
    query: { pageSize: 50 },
  },
  routes: {
    listPath: "/podcasts",
    detailPath: "/podcasts/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/podcasts",
  },
  ui: {
    name: "Podcast",
    pluralName: "Podcasts",
    navLabel: "Podcasts",
    listTitle: "播客目录",
    listDescription: "Notion 中维护的节目列表。",
    emptyState: "还没有已发布的播客。",
  },
  capabilities: {
    richBlocks: false,
    coverImages: true,
    gatedAssets: false,
  },
});
```

并在同一个文件底部的 `contentModels` 数组里追加 `podcastContentModel`，保持
测试快照与下游消费方的固定顺序。

## 3. 加路由（`app/podcasts/`）

```text
app/podcasts/
├── page.tsx           # 列表页：复用 packages/.../content/list
└── [slug]/page.tsx    # 详情页：复用 Notion 块渲染
```

两个页面都是已有 blog/movies 页面的近复制：

- 列表页调用 `@nextion/core/content` 的 `searchContentModel("podcasts")`
  并把结果丢给项目里已经有的 `<ContentList />` 组件。
- 详情页用 `getRegisteredSource("podcasts")` 取元数据，再用
  `mapPageToRecord(page, podcastContentModel.source.fields)` 拉字段。

## 4. 加 API（`app/api/podcasts/`）

```text
app/api/podcasts/
├── route.ts           # GET：返回公开播客列表
└── [slug]/route.ts    # GET：返回单个播客详情
```

`route.ts` 的形状与 `apps/moviebluebook/app/api/posts/route.ts` 完全一致，只是把
`getRegisteredSource("blog")` 换成 `getRegisteredSource("podcasts")`。

## 5. （可选）Admin 入口

如果想让 sidebar 出现一个"播客审核"项，编辑
`apps/moviebluebook/lib/admin/nav.ts`：

```ts
import { createAdminNav } from "@nextion/core/admin";

export const adminNav = createAdminNav([
  { href: "/admin", labelKey: "admin.nav.dashboard", icon: "Home", order: 10 },
  { href: "/admin/content-models", labelKey: "admin.nav.models", icon: "Database", order: 20 },
  { href: "/admin/review", labelKey: "admin.nav.review", icon: "Inbox", order: 30 },
  // ↓ 新增：播客审核队列
  { href: "/admin/podcasts", labelKey: "admin.nav.podcasts", icon: "Mic", order: 35 },
  { href: "/admin/users", labelKey: "admin.nav.users", icon: "Users", requireRole: "admin", order: 40 },
  { href: "/admin/settings", labelKey: "admin.nav.settings", icon: "Settings", requireRole: "admin", order: 50 },
  { href: "/admin/account", labelKey: "admin.nav.account", icon: "User", order: 60 },
]);
```

实际页面代码放在 `app/admin/podcasts/page.tsx`，照搬 `app/admin/review/`
即可。`createAdminNav` 帮你按 `order` 排序、按角色过滤，无需手写排序逻辑。

## 6. 把内容源加入 search index

包内的 search-index 构建器会扫描所有已注册源；只要在 `lib/content/models.ts`
里调用了 `defineContentSource(...)`，它就会自动出现在 search index 目标列表
里。

- 想验证：在 admin 跑 `pnpm dev`，登录后访问 `/admin/content-models`，新源应
  出现在表中，列出 `routes.listPath`、env 名、字段数与 `capabilities`。
- 想强制重建：调用 `@nextion/core/content` 的 `buildSearchIndex()` 或
  `prewarmContentModel("podcasts")`，二者都会重新从 Notion 拉取数据并写入
  D1 `content_search_index` 表。
- 想为新源加定时预热：在 `wrangler.jsonc` 的 `triggers.crons` 之外，启动时调
  用 `prewarmPublicContentSearchIndex()`（已在 starter 的 `worker/index.ts`
  的 `scheduled` handler 里）。新源默认就在 `public` 列表中。

## 7. 环境变量与绑定

- `NOTION_PODCASTS_DATA_SOURCE_ID`：在 `.dev.vars` 与 `wrangler.jsonc` 的
  `vars` 里都填上。
- 其它（`NOTION_TOKEN`、`DB`、`IMAGES`）已就绪，无需新增。

## 8. 测试

最小检查清单：

```bash
pnpm --filter @nextion/moviebluebook test     # 路由 / 模型 / webhook 回归
pnpm dev                                # 打开 /podcasts 看渲染
```

> 把"复制旧领域"作为常态：替换一个领域的成本就是"删旧的、加新的"。Foundation
> 不会强制通用 UI 模板覆盖你的新领域，因此每个内容源可以按需长出不一样的
> 详情页和组件。
