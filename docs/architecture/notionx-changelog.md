# Notionx Changelog

> `@notionx/core` 的发布说明。完整的 npm release notes 见
> [https://www.npmjs.com/package/@notionx/core](https://www.npmjs.com/package/@notionx/core)。
>
> 本文件由 [`release.yml`](../../.github/workflows/release.yml) 在每次发版后由
> release 维护者手动补一段。格式参考下文 `1.0.0`。

## 1.0.0 — 初始发布

首次将 Notionx 从消费方项目拆出，独立发布为 `@notionx/core`。
本节为占位说明：1.0.0 没有迁移 callout，**没有**消费方需要做额外动作。

### 包含

- 14 个子路径导出，覆盖 `platform` / `notion` / `content` / `auth` /
  `admin` / `storage` / `media` / `email` / `cache` / `worker` / `hooks` /
  `i18n` / `doctor` / `types`。
- 4 个边界契约：`ContentSource`、`AuthConfig`、`AdminExtension`、
  `WorkerOptions`。
- 工厂函数：`defineContentSource` / `createAuth` / `createAdminNav` /
  `createNotionxWorker`。
- Cloudflare-only 运行时：Workers + D1 + R2 + Cloudflare Images +
  `caches.default` + vinext CDN 适配。
- D1 认证（注册 / 验证 / 登录 / 找回 / Reset / 退出 / Turnstile /
  Resend / Google OAuth）。
- Admin 外壳 + 用户管理 + 设置 + content-models 状态页 + account 页。
- Notion 工具链：client、mappers、block 渲染、媒体代理、webhook、内容缓存。
- `notionx:doctor` 离线诊断 CLI。
- `npm create notionx@latest` 脚手架（位于 `packages/notionx-cli/`）。

### 升级指引

- 无。这是初始版本。

### 已知限制

- 仅 Cloudflare Workers 运行时；不支持 Vercel Edge / Node / Bun。
