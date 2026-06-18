# Notionx Package

> 本文档是 `@notionx/core` 的架构概览。详细的设计动机与权衡分析见
> [`docs/superpowers/specs/2026-06-10-notionx-package-design.md`](../../superpowers/specs/2026-06-10-notionx-package-design.md)；
> 分阶段迁移历史见同名实现计划。如果只是想用，最短路径是
> [创建新项目](./creating-new-project.md)。

## 简介

`@notionx/core` 是 notionx 项目的可复用平台层。它把"所有 notionx 项目都需要
的那部分"——Cloudflare 运行时适配、D1 认证、邮件、对象存储、Notion 工具链、
Admin 外壳、缓存与失效、诊断——集中到一份 npm 包里，让"新建一个项目"变成"定义
Notion 字段 + 写路由 + 写 UI"，而不是从零复制一整套基础设施。

迁移动机：

- **复用而非复制**：旧模式下，复制 starter 意味着复制整个认证、Admin、Notion、
  媒体代理实现；任何上游修复都要在所有派生项目里手动同步。
- **以依赖形式升级**：消费方通过 `pnpm update` 或 Dependabot 自动获得修复与新
  能力，平台改动与业务代码解耦。
- **保留代码优先、AI 友好的特性**：本包不强制任何低代码/JSON 配置的 UI 框架。
  Notion 仍然是编辑器，shadcn/ui 仍然以源码形式随项目分发，AI 可以像往常一样
  增删领域模块。
- **保留全部能力**：Notion 内容源、D1 认证、Session、OAuth、Turnstile、Resend、
  R2、Cloudflare Images、revalidation、search、admin 用户管理、content-models 状
  态页、foundation doctor、Cloudflare Workers 部署——全部能力保留。
- **首日就完成大量样板**：注册 → 邮箱验证 → 登录 → 找回密码 → Reset → 退出、
  Admin 外壳、平台适配、缓存、Search 索引、Doctor 都被包内置好；新项目只需要
  在 `lib/content/models.ts` 里写几个 `defineContentSource(...)` 就能跑起来。

## 仓库结构

仓库根是一个 pnpm workspace，所有包都在 `packages/` 下：

```text
notionx-monorepo/
├── packages/
│   ├── notionx/            # 编译并发布为 @notionx/core
│   │   ├── src/
│   │   │   ├── platform/   # Cloudflare 运行时 + capabilities
│   │   │   ├── notion/     # Notion 客户端 + 通用辅助
│   │   │   ├── content/    # ContentSource 契约、注册表、revalidate、search
│   │   │   ├── auth/       # D1 认证、session、password、Turnstile、rate-limit
│   │   │   ├── admin/      # AdminShell、sidebar、layout、用户管理、设置、content-models
│   │   │   ├── storage/    # R2 helper、/api/files、/api/cdn
│   │   │   ├── media/      # Notion 媒体代理、public-image
│   │   │   ├── cache/      # cache-keys、公共缓存失效
│   │   │   ├── email/      # Resend 封装
│   │   │   ├── worker/     # createNotionxWorker + middleware
│   │   │   ├── doctor/     # notionx:doctor
│   │   │   ├── i18n/       # config + 默认 messages
│   │   │   ├── util/       # env、site-url、request-ip、utils
│   │   │   └── types.ts    # ContentSource、AuthConfig、AdminExtension、WorkerOptions
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts  # ESM + d.ts 打包
│   ├── notionx-cli/        # `@notionx/cli` 脚手架 + `notionx` 维护 CLI
│   ├── create-notionx/     # `npm create notionx` 入口 shim
│   └── notionx-skill/      # notionx skill 安装器
├── scripts/                # 发布与仓库自动化
├── docs/                   # 架构、发布、设计文档
├── skills/                 # skill 源材料
├── pnpm-workspace.yaml
├── package.json            # 根脚本：pnpm -r build、pnpm -r test
├── .changeset/             # 版本管理
└── .github/workflows/
    ├── release.yml         # 推 main 后发布到 npm
    └── ci.yml              # 全量 build + test
```

`packages/notionx-cli` 是脚手架与维护 CLI——它生成一个真实的 notionx 项目作为
`@notionx/core` 的消费方。新建项目时运行 `npm create notionx@latest`。

## 七层依赖分层

包内部按严格的"自上而下"分层组织。导入关系只允许从高层指向低层；ESLint 的
`import/no-restricted-paths` 在 CI 中强制这一规则。

| 层级 | 目录 | 职责 | 依赖 |
|---|---|---|---|
| 0 | `util`, `types` | 纯 helper、零内部依赖 | — |
| 1 | `i18n`, `hooks` | i18n config、客户端 hook | util / types |
| 2 | `platform`, `cache` | 平台门面、缓存原语 | util / types |
| 3 | `notion` | Notion 客户端与通用辅助 | platform / cache |
| 4 | `content` | ContentSource 框架（注册表、revalidate、search） | notion |
| 5 | `auth` | D1 认证、session、role | content |
| 5.5 | `email`, `storage`, `media` | 横切服务 | platform / cache |
| 6 | `admin` | Admin 外壳、sidebar、用户管理、设置、content-models | auth / content |
| 7 | `worker` | 入口：`createNotionxWorker` | admin 及以下 |

禁止的导入：

- `notion` 不能引用 `content` / `auth` / `admin` / `worker`；
- `content` 不能引用 `auth` / `admin` / `worker`；
- `auth` 不能引用 `admin` / `worker`；
- `admin` 不能引用 `worker`；
- 包内任何模块都不能引用消费方项目或 `@notionx/core` 的内部路径。

包通过 `package.json` 的 `exports` 字段只暴露文档化的子路径；内部模块被放到
`src/internal/` 下，外部即使想引用也取不到。

## 四个边界契约

项目通过四个 TypeScript 接口消费本包。每个接口都在 `@notionx/core/types`
中导出，并且被 ESLint 与显式工厂函数双向保护。

| 契约 | 位置 | 用途 |
|---|---|---|
| `ContentSource` | `src/content/models.ts` | 声明一个 Notion 内容域；包用它自动接入 list/detail 路由、cache key、revalidation 路径、webhook 路由、search index。 |
| `AuthConfig` | `src/types.ts` | 声明 D1 绑定名、表名、cookie 配置、Turnstile、邮件、OAuth、角色；包实现完整认证流，项目只配。 |
| `AdminExtension` | `src/types.ts` | 通过 `AdminNavItem` 数组在 Admin sidebar 注册项目自有页面；额外组件通过 `extraShellComponents` 槽位注入。 |
| `WorkerOptions` | `src/types.ts` | 传给 `createNotionxWorker()` 的总配置对象，聚合 `ContentSource[]`、`adminNav`、`authConfig`、`siteConfig`、`extraRoutes`。 |

四个契约都遵循"包提供实现 + 项目提供配置"的统一模式。`ContentSource` 通过
`defineContentSource(...)` 工厂注册；`AuthConfig` 通过 `createAuth(config)` 实例
化；Admin 通过 `createAdminNav(items, { roles })` 过滤；Worker 通过
`createNotionxWorker(options)` 装配。

## 分发模型

包发布到 **npm**（npmjs.com），scope 为 `@notionx`。

- **版本管理**：changesets。任何影响 `packages/notionx/**` 的 PR 都必须携带
  一个 changeset 文件，描述变更内容与 semver bump 类型。
- **发布流程** (`.github/workflows/release.yml`)：推 main 时，如果
  `packages/notionx/**` 有变化，执行 `pnpm changeset version` →
  `pnpm --filter @notionx/core build` → `pnpm changeset publish`。
  凭据使用具备 publish 权限的 `NPM_TOKEN`。
- **消费方升级**：每个消费项目（脚手架新建的独立项目）的
  `.github/dependabot.yml` 会在 `@notionx/core` 出现 minor/patch 升级时打开
  PR。详见 [升级 Foundation](./upgrading-notionx.md)。
- **私有预览**：canary 通过 `pnpm changeset publish --tag=next` 走 npm。

`pnpm-workspace.yaml` 声明 `packages/*` workspace 目录，并通过
`link-workspace-packages=true` 在 monorepo 内零成本引用。
发布前会以 `workspace:*` 形式链接；发布后通过真实的版本号引用。

## 测试与 CI 保障

- **单元测试**：包用 vitest（`packages/notionx/vitest.config.ts`），覆盖
  `getEnv`、runtime 探测、`createAdminNav`、`mapPageToRecord`、
  `buildCacheKey`、`getRevalidationPaths`、`runNotionxDoctor`、
  `createNotionxWorker` 等关键边界。
- **Starter 回归**：脚手架生成的项目自身的测试套件覆盖路由、Webhook、内容模型
  与 admin 行为；`pnpm -r test` 必须保持绿色。
- **CI 工作流** (`.github/workflows/ci.yml`)：在 push 与 PR 上运行
  `pnpm -r build`、`pnpm -r lint`、`pnpm -r typecheck`、`pnpm -r test`。
- **pre-commit hook** (`.husky/pre-commit`)：对暂存文件运行 `pnpm -r lint` 与
  `pnpm -r typecheck`，阻止越层导入被合入。
- **Doctor**：`pnpm --filter @notionx/core notionx:doctor` 离线诊断
  Cloudflare 绑定、Notion 配置、已注册的内容源。它只读取本地配置和
  `process.env`，从不连接 Notion 或 Cloudflare 账户，永远不会打印密钥。

## 何时进包、什么时候留在 starter

进包的判定标准：**跨项目可复用 + 与平台/通用域强耦合**。具体清单：

| 留在 starter | 原因 |
|---|---|
| `app/blog/`, `app/movies/`, 未来业务域 | 项目业务 |
| `app/admin/{review,new,[slug]}/` 等领域 Admin 页 | 领域专属 |
| `app/page.tsx` 与其他落地页 | 项目品牌 |
| `components/ui/`（shadcn primitives） | AI 需可逐项目修改 |
| 领域专属组件（`MovieDownloadPanel`、`GatedVideo` 等） | 项目业务 |
| `migrations/` 初始 schema | 项目拥有自己的 D1；包读取但 scaffold 复制一份 |
| `lib/content/models.ts`（`defineContentSource` 调用） | 每项目内容注册表 |
| `lib/site/config.ts` | 每项目站点配置 |
| `wrangler.jsonc`、`vite.config.ts`、`next.config.ts` | 每项目 CF 配置 |
| `lib/admin/nav.ts` | 每项目 admin 扩展 |
| `lib/auth.config.ts` | 每项目 auth 配置 |
| `tsconfig.json` paths | 每项目 TS 配置 |
| `lib/notion/{posts,movies,movie-*}.ts` | 领域知识 |

进入包的内容集中在 `packages/notionx/src/` 下；包内子模块的归属可参考
[依赖分层](#七层依赖分层)那张表。

## 下一步

- 想要新建项目：[创建新项目](./creating-new-project.md)
- 想要添加/修改一个内容域：[自定义内容源](./customizing-content-source.md)
- 想要升级 `@notionx/core`：[升级 Foundation](./upgrading-notionx.md)
- 想要查阅历史变更：[Foundation Changelog](./notionx-changelog.md)
