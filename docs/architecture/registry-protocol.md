# Notionx Registry Protocol（v2）

> 这是 `@notionx/core` 下一代模板/内容模型/功能模块的**统一注册协议**。
> 它把今天零散的 `scaffold.json` / `installations.json` / `managed-files.json`
> 收敛为一个**自描述的注册表**（`.notionx/registry.json`），让
>
> - 运行时核心（`@notionx/core`）可以**升级**
> - 内容模型（blog / docs / movies / …）可以**新增、删除、升级**
> - 功能模块（search / rss / i18n-extended / seo / …）可以**按需组合**
> - 升级过程中**自动迁移** Notion schema / D1 schema / 配置
> - **不破坏**已有数据
>
> 全部在 `notionx add` / `notionx remove` / `notionx update` 三个命令下闭环。

## 1. 灵感来源

我们对比了四个成熟系统，把它们的**互补优点**抽出来：

| 系统 | 给我们的启发 | 我们怎么用 |
|---|---|---|
| **shadcn/ui registry** | 组件不是依赖，是**被复制进项目的源文件**；`components.json` + `npx shadcn add`；registry 协议是**纯 JSON**，易于第三方扩展 | 我们把所有"能力"都视为**源文件 + 协议元数据**的组合物；`registry.json` 公开给第三方发布 |
| **Astro integrations** | `astro add` / `astro remove` / `astro upgrade` 三个命令分工；integration 自身可以被更新；不强制依赖、不破坏老项目 | 我们的 `notionx add` / `notionx remove` / `notionx update` 一一对应 |
| **Prisma migrate** | `schema.prisma` 是**单点真理**；`prisma migrate dev` 生成不可变 migration 文件；`prisma db pull` 做**反向同步**（从真实数据库推导出 schema） | `.notionx/registry.json` 是**安装侧**单点真理；`.notionx/migrations/*.sql` 是**运行时侧**不可变变更；`notionx pull` 做反向同步 |
| **Angular schematics** | `collection.json` 协议；schematic 自身可以**升级**（`ng update`）；每个 schematic 是一个有版本号的转换；规则列表（Rule）让 transformations 可观察 | 我们的 `RegistryItem` 跟 `schematic` 同构；`notionx update` 用规则链（Rule chain）做 transformations |

## 2. 核心抽象：RegistryItem

**所有"能力"——内容模型、功能模块、认证策略、Admin 扩展——都是 `RegistryItem`。**

```ts
// 由 create-notionx-app 写入，跨项目可移植
type RegistryItem = {
  // 身份
  id: string;              // "blog" | "docs" | "search" | "auth-email" | "admin-user-mgmt"
  kind: "content-source" | "feature-module" | "platform-extension";
  version: number;         // 1

  // 来源
  source: {
    registry: string;      // "@notionx/official" | "user.local" | "https://acme.com/registry.json"
    publishedAt: string;   // ISO 时间
  };

  // 参数
  params: Record<string, string>;  // { contentSourceId: "blog", basePath: "/docs" }

  // 依赖：升级这个 item 需要的其他 items
  requires?: Array<{ id: string; version: string }>;

  // 兼容：升级这个 item 时需要迁移的"老世界"items
  supersedes?: Array<{ id: string; version: string; migration: string }>;

  // 文件清单 + 所有权
  files: RegistryFile[];

  // 这个 item 提供的"能力"
  capabilities: {
    adminRoutes?: string[];
    publicRoutes?: string[];
    apiRoutes?: string[];
    envVars?: string[];
    notionDataSources?: string[];   // ["NOTION_BLOG_DATA_SOURCE_ID"]
    d1Tables?: string[];            // ["blog_posts", "blog_authors"]
  };

  // 迁移规则：升级或删除时执行
  migrations: RegistryMigration[];
};

type RegistryFile = {
  path: string;             // "app/blog/page.tsx"
  ownership: "platform" | "bridge" | "user";   // 三层所有权沿用 v1
  template: string;         // EJS/Handlebars 模板路径（相对 registry）
  // 或者直接是 content（从 registry.json inline）
  content?: string;
};

type RegistryMigration = {
  from: string;             // "<id>@<fromVersion>"
  to: string;               // "<id>@<toVersion>"
  // 顺序执行
  steps: MigrationStep[];
};

type MigrationStep =
  | { kind: "notion-field-add";     source: string; property: string; type: string }
  | { kind: "notion-field-rename";   source: string; from: string; to: string }
  | { kind: "notion-field-deprecate"; source: string; property: string; fallback?: string }
  | { kind: "d1-table-create";       name: string; sql: string }
  | { kind: "d1-table-alter";        name: string; sql: string }
  | { kind: "d1-migration-apply";    file: string }   // 引用 migrations/*.sql
  | { kind: "ts-code-transform";     file: string; transform: string /* codemod 名 */ }
  | { kind: "env-add";               name: string; default?: string }
  | { kind: "config-merge";          file: string; json: object /* 浅合并到 wrangler.jsonc 等 */ };
```

## 3. 项目侧的状态文件

### 3.1 `.notionx/registry.json` —— 单点真理

```json
{
  "$schema": "https://notionx.dev/schemas/registry.v2.json",
  "projectKind": "notionx",
  "scaffoldVersion": "1.0.0",
  "notionxCore": "^2.0.0",
  "registries": {
    "@notionx/official": {
      "url": "https://registry.notionx.dev/official.json",
      "lastSyncAt": "2026-06-16T10:00:00Z"
    },
    "user.local": { "url": "file:./.notionx/local-registry.json" }
  },
  "installed": [
    {
      "id": "blog", "kind": "content-source", "version": 1,
      "source": "@notionx/official",
      "params": { "contentSourceId": "blog" },
      "installedAt": "2026-06-10T08:00:00Z",
      "installRecordSha": "abc123..."
    },
    {
      "id": "docs", "kind": "content-source", "version": 1,
      "source": "@notionx/official",
      "params": { "contentSourceId": "docs", "basePath": "/docs" },
      "installedAt": "2026-06-12T14:00:00Z"
    },
    {
      "id": "search", "kind": "feature-module", "version": 1,
      "source": "@notionx/official",
      "params": { "scope": "docs" }
    }
  ],
  "compatibility": "v2"
}
```

### 3.2 `.notionx/migrations/` —— 不可变变更历史

跟 Prisma 一样，**生成的 migration 永远不会被编辑**：

```
.notionx/migrations/
├── 0001_init.sql
├── 0002_add_blog_status.sql
├── 0003_add_docs_visibility.sql
└── _meta.json    // 每条记录：{ item, from, to, appliedAt, sha }
```

`notionx update` / `notionx add` 在改 schema 前**先 dry-run 生成 migration**，确认后才写盘 + 提示用户去 Cloudflare 跑 `wrangler d1 migrations apply`。

### 3.3 `.notionx/state/` —— 运行时状态

```
.notionx/state/
├── cache-keys.json       // 内容源 → 缓存键映射
├── search-index.json     // 哪些内容源被 search 索引
├── notion-snapshot.json  // 上次拉取的 Notion schema 快照（用来检测漂移）
└── bindings.json         // wrangler.jsonc 实际生效的 binding
```

## 4. 命令面：三个动作闭环

```text
                       ┌────────────────────┐
                       │  registry.json     │ ←── 真理源
                       └────────┬───────────┘
                                │
       ┌──────────────┬─────────┴──────────┬──────────────┐
       │              │                    │              │
       ▼              ▼                    ▼              ▼
   notionx add   notionx remove       notionx update   notionx pull
   (新增能力)     (删除能力)            (升级能力)       (反向同步)
```

### 4.1 `notionx add <item-id>`

- 从已配置的 registry 拉取 `RegistryItem` 描述
- 检查 `requires`（如 `search` 依赖 `docs`）
- 检查 `supersedes`（如 v2 `blog` 取代 v1 `blog`，做迁移）
- **生成 migration 文件**（如果涉及 schema）
- 渲染模板文件，写入磁盘
- 更新 `registry.json`（追加新项 + 锁版本）
- 报告：新增了哪些文件 / 哪些 migration 待跑 / 哪些需要手动配 Notion

例：

```bash
$ notionx add blog@1
# 第一次安装时跟 notionx init 合并

$ notionx add docs
# 检查：search 没装 → OK
# 检查：basePath 没冲突 → OK
# 生成：.notionx/migrations/0003_add_docs_visibility.sql
# 写入：app/docs/page.tsx 等 6 个文件
# 提示：把 NOTION_DOCS_DATA_SOURCE_ID 加到 .dev.vars
# 提示：wrangler d1 migrations apply xxx --remote
```

### 4.2 `notionx remove <item-id>`

这是 v1 缺的。**关键：默认只移除运行时接线（routes / admin nav / registry.json），不删用户数据**。

```bash
$ notionx remove search
# 移除：components/search/**、lib/search/**、site-features 注册
# 保留：所有数据源、所有用户改过的 UI 文件
# 提示：可以运行 `notionx remove --purge` 来彻底删除文件
```

### 4.3 `notionx update [<item-id>]`

- 拉取 registry diff（已装的 vs registry 当前版本）
- 对每个有升级的 item：
  - 生成 migration 链（按 `RegistryMigration.steps` 顺序）
  - codemod 转译用户代码（`ts-code-transform` step）
  - 渲染新文件 + 标记 `userOwned` 冲突
- 应用 platform 文件无脑覆盖
- 报告：哪些 migration 待跑、哪些冲突需要用户确认、是否要 deploy

```bash
$ notionx update           # 升级所有（包括 @notionx/core）
$ notionx update blog      # 只升级 blog
$ notionx update --dry-run # 不写盘，只输出 diff
$ notionx update --core    # 只升级 @notionx/core 运行时
```

### 4.4 `notionx pull`（可选，v2.1）

反向同步：从**真实 Notion + D1 状态**反推 schema 漂移。

```bash
$ notionx pull
# 检测：Notion 里 blog 数据源多了个 "Author" 字段
# 检测：D1 里 blog_posts 表被手工 ALTER 过
# 生成：migration 提案（不会自动应用）
```

这是 Prisma `db pull` 的 Notionx 版本。

## 5. 关键设计决策

### 5.1 单一 registry.json，取代 v1 的三件套

v1 有 `scaffold.json` + `installations.json` + `managed-files.json` 三个文件。v2 合并为一个 `registry.json`，原因：

- 三个文件之间有引用关系，分开放容易漂移
- 一个文件**原子写入**（write to temp + rename）就保证一致性
- 第三方 registry 实现只需要理解一个 schema

迁移路径：在 `loadProjectContext` 里读三个文件，写回时合并为 `registry.json`。**老项目升级到 v2 时自动迁移**。

### 5.2 文件所有权沿用 v1 的三层模型

`platform` / `bridge` / `user` 三层在 shadcn / Angular / Astro 里都有对应物（"owned by framework" / "wiring" / "yours"）。我们沿用，不重新发明：

| 所有权 | 升级时行为 | 移除时行为 |
|---|---|---|
| `platform` | 无脑覆盖最新模板 | 删 |
| `bridge` | 渲染器生成的接线代码（如 `worker/index.ts` 聚合所有内容源）；升级时合并**重生成** | 重生成 |
| `user` | **绝不覆盖**；冲突时阻塞更新，让用户用 diff 工具决定 | 默认保留；`--purge` 才删 |

### 5.3 迁移是**显式且可审计**的

跟 Prisma 学：**绝不**在 `update` 时偷偷改用户数据。流程：

1. `notionx update` **先 dry-run**，把将要做的事按顺序打印出来
2. 用户确认（或 `--yes`）
3. 生成 `.notionx/migrations/NNNN_xxx.sql` + 更新 `_meta.json`
4. **不自动连 Notion / Cloudflare 跑 migration**（沙箱规则 + 安全）；只打印命令让用户跑
5. `wrangler d1 migrations apply` 成功后，notionx 把 migration 标记为已应用

**Notion 字段变更**也走同样流程：先 dry-run 让用户看 diff，再调用 Notion API 应用。

### 5.4 Registry 是可扩展的

不锁死在 npm 包内置。`registry.json` 可以指向：

- `https://acme.com/registry.json`（远程）
- `file:./.notionx/local-registry.json`（本地）
- `git:github.com/team/notionx-private-registry`（git）

第三方团队可以发布**自己的内容模型市场**，跟 Notion 模板市场一样。

### 5.5 Codemod 是 versioned 的

每个 `ts-code-transform` step 引用一个**带版本的 codemod 名**。notionx 内置：

- `notionx/v1-to-v2/blog-fields-camelcase`（老项目 v1 字段名是 snake_case，v2 是 camelCase）
- `notionx/v2-add-search-index`（老的硬编码搜索换成新索引）
- …

这些 codemod 跟 `@notionx/core` **同版本号发布**，避免 codemod 与运行时不一致。

## 6. 跟 v1 现状的对照

| v1（今天） | v2（本提案） |
|---|---|
| 三个状态文件 | 一个 `registry.json` |
| 5 个 TemplateKind 中只有 `site-template` 实装 | `content-source` / `feature-module` / `platform-extension` 三类全实现 |
| `notionx update` 已实装 | 沿用 + 加强（codemod + migration） |
| `notionx add` 只有测试和计划 | 完整实现（registry 拉取 + 模板渲染 + migration 生成） |
| 没有 `notionx remove` | 完整实现（保留数据 + 可选 purge） |
| 没有 `notionx pull` | 可选 v2.1 |
| 没有 migration 文件系统 | 引入 `.notionx/migrations/`（Prisma 风格） |
| Codemod 缺失 | 引入 versioned codemod 链 |
| 第三方 registry 不支持 | 完整支持（URL / file / git） |

## 7. 落地路径（建议分四个 PR）

### PR 1: Registry 协议（数据层）
- 新增 `RegistryItem` / `RegistryFile` / `RegistryMigration` 类型
- 写 `loadProjectContext` 的 v2 分支（从 `registry.json` 读）
- 写 `loadProjectContext` 的 v1→v2 迁移器（自动一次性升级）
- 写 `notionx diff` 用 v2 数据
- **不破坏** v1 用户

### PR 2: 模板引擎升级（参数化渲染）
- 把 `templates/lib/content/models.ts.tmpl` 改为**多内容源**友好的模板
- `worker/index.ts` 模板升级为**自动聚合**所有已注册内容源
- 引入 `registry.render(item, params, context)` 通用渲染函数

### PR 3: `notionx add` / `notionx remove`
- 完整实现 add 命令（注册到 CLI）
- 完整实现 remove 命令
- 实现内置的 `blog` / `docs` / `search` / `movies` 四个 RegistryItem
- 跑迁移测试

### PR 4: `notionx update` 强化（migration + codemod）
- 引入 `.notionx/migrations/` 目录
- 引入 codemod runner（`@notionx/codemods` 包）
- 强化 update 命令：先 dry-run → 生成 migration → 应用 codemod → 渲染新文件
- 跟 `@notionx/core` 1.x → 2.x 升级一起测

## 8. 命名与定位

- 协议名：**Notionx Registry Protocol v2**
- 配置文件：`.notionx/registry.json`
- 命令：`notionx add` / `notionx remove` / `notionx update` / `notionx diff` / `notionx doctor`
- 包：`@notionx/core`（运行时）+ `@notionx/create-notionx-app`（脚手架 + CLI）
- 远程 registry：`https://registry.notionx.dev/`（未来）

## 9. 不做什么

为了保持简单和稳定，v2 **故意不**做的事：

- 不做 GUI / 可视化编辑（用 `@notionx/core/admin` 里的 content-models 页查就行）
- 不做自动运行 wrangler 命令（沙箱 + 显式审计原则）
- 不内置 git ops（不自动 commit / push，留给用户）
- 不强制 lockfile 格式（保持 `pnpm-lock.yaml` 原生）

---

## 附：参考资源

- shadcn/ui registry: <https://ui.shadcn.com/docs/registry>
- Astro integrations: <https://docs.astro.build/en/guides/integrations-guide/>
- Prisma migrate: <https://www.prisma.io/docs/orm/prisma-migrate>
- Angular schematics: <https://angular.dev/tools/cli/schematics>
