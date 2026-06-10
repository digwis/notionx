# vinext

vinext 是一个面向 [Cloudflare Workers](https://workers.cloudflare.com/) 的
Next.js / App Router 风格框架。本仓库是 vinext 官方维护的 pnpm monorepo：
可复用的平台层打包成 `@vinext/foundation` 发布到 GitHub Packages，业务侧的
参考实现放在 `apps/starter/`，脚手架工具放在 `tools/create-vinext-app/`。

## 架构

vinext 是一份 pnpm monorepo：可复用的平台、认证、Admin 外壳、Notion 工具链
都被抽离到 `@vinext/foundation` 包里；新建项目只需 `pnpm create vinext-app
my-new-site`，写几个 `defineContentSource(...)` 调用就能拿到完整的认证、Admin
与 Cloudflare 部署能力。仓库结构、七个依赖分层、四个边界契约（`ContentSource`
/ `AuthConfig` / `AdminExtension` / `WorkerOptions`）与分发模型都在
[`docs/architecture/foundation-package.md`](docs/architecture/foundation-package.md)
里有完整说明。

- 完整架构总览：[`docs/architecture/foundation-package.md`](docs/architecture/foundation-package.md)
- 创建新项目：[`docs/architecture/creating-new-project.md`](docs/architecture/creating-new-project.md)
- 添加 / 修改内容域：[`docs/architecture/customizing-content-source.md`](docs/architecture/customizing-content-source.md)
- 升级 `@vinext/foundation`：[`docs/architecture/upgrading-foundation.md`](docs/architecture/upgrading-foundation.md)
- 发布说明：[`docs/architecture/foundation-changelog.md`](docs/architecture/foundation-changelog.md)
- 旧的内容基础文档（已不作为权威来源）：[`docs/architecture/content-foundation.md`](docs/architecture/content-foundation.md)

## 仓库布局

```text
packages/foundation/   # 编译并发布为 @vinext/foundation
apps/starter/          # 业务参考应用（消费 @vinext/foundation）
tools/create-vinext-app/  # `pnpm create vinext-app` 脚手架
docs/                  # 架构文档与设计规格
```

## 本地开发

```bash
pnpm install
pnpm --filter @vinext/foundation build
pnpm --filter @vinext/starter dev
```

## 测试与诊断

```bash
pnpm -r test
pnpm --filter @vinext/foundation foundation:doctor
```
