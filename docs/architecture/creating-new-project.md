# 创建新项目

最短路径：从一行命令到本地能跑、Cloudflare 能部署。

## 1. 运行脚手架

```bash
npm create notionx@latest my-new-site
```

交互式提示会按顺序询问：

| 提示 | 默认 | 用途 |
|---|---|---|
| Project name? | `my-vinext-app` | 生成目录名 + `package.json` 的 `name` |
| Target directory? | `./<projectName>` | 渲染到的路径 |
| Default locale? | `en` | i18n 默认语言 |
| Supported locales? | `en` | 逗号/空格分隔；同时包含默认语言 |
| First content source id? | `blog` | 第一个 `defineContentSource` 的 `id` |
| First content source title? | `<id>` 首字母大写 | 展示名 |
| Field names? | `Title, Slug, Description` | Notion 属性名，按输入顺序；自动转 camelCase 作为 TS 字段键 |
| Generate the project with these settings? | `Yes` | 确认 |

非交互场景下可以传 `argv[2]` 作为目标目录；其它参数目前仍走交互流程。

## 2. 生成的项目结构

```text
my-new-site/
├── app/
│   ├── api/auth/         # 认证 API（来自 foundation）
│   ├── api/health/       # health check
│   ├── login/, register/, forgot-password/, reset-password/
│   └── page.tsx          # 落地页占位
├── lib/
│   ├── content/models.ts # defineContentSource(...)
│   ├── admin/nav.ts      # createAdminNav([...])
│   ├── auth.config.ts    # AuthConfig
│   └── site/config.ts
├── migrations/0001_init.sql  # 含 auth schema
├── components/           # shadcn primitives + 占位
├── public/
├── tests/smoke.test.ts
├── worker/index.ts       # 调用 createNotionxWorker
├── wrangler.jsonc
├── vite.config.ts
├── next.config.ts
├── vitest.config.ts
├── tsconfig.json
├── .dev.vars.example
└── README.md
```

`worker/index.ts` 是一个 5 行的薄壳：

```ts
import { createNotionxWorker } from "@notionx/core/worker";
import { authConfig } from "../lib/auth.config";
import { adminNav } from "../lib/admin/nav";
import { siteConfig } from "../lib/site/config";
import { blogSource } from "../lib/content/models";

export default createNotionxWorker({
  sources: [blogSource],
  adminNav,
  authConfig,
  siteConfig,
});
```

## 3. 开发循环

```bash
cd my-new-site
pnpm install
cp .dev.vars.example .dev.vars          # 填入 NOTION_TOKEN、DB、IMAGES 等
pnpm test
pnpm dev                                 # 等同 dev:vinext
```

`pnpm dev` 启动 vinext 开发服务器；首屏落地页 + Admin 登录 + 注册流程会立即可
用。`pnpm test` 跑 smoke 测试套件。

## 4. 部署路径

```bash
pnpm exec wrangler d1 migrations apply <db-name> --remote
pnpm exec vinext deploy
```

Cloudflare 资源（KV、Queue、Cron）需要在 `wrangler.jsonc` 显式声明；首次部署
前请先在 Cloudflare 控制台创建同名 D1 数据库并填入 binding ID。详细步骤见脚
手架生成的 `README.md`。

## 下一步

- 想加第二个内容域：[自定义内容源](./customizing-content-source.md)
- 平台架构总览：[Foundation Package](./notionx-package.md)
