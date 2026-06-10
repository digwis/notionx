-- Seed data: 3 blog posts that match the original in-memory array.

INSERT OR REPLACE INTO posts (slug, title, description, date, author, tags, content) VALUES
(
  'hello-vinext',
  'Hello, vinext: 在 Vite 上跑 Next.js API',
  'Cloudflare 把 Next.js 的 API surface 重新实现到了 Vite 之上，构建快 4.4×、bundle 小 57%。本文是第一篇上手笔记。',
  '2026-05-12',
  'zhao',
  '["vinext","next.js","cloudflare"]',
  '["vinext 是 Cloudflare 在 2026 年 2 月开源的项目：把 Next.js 16 的 API surface（App Router、RSC、Server Actions、ISR、middleware）用 Vite + Rolldown 重新实现。","它不是 OpenNext 那种适配器——是从头重写。绝大多数 app/、next.config.*、所有 next/* import 都能直接 work。","部署到 Cloudflare Workers 只要 vinext deploy 一行命令。"]'
),
(
  'rsc-on-the-edge',
  '在边缘跑 RSC: Server Components 的新栖息地',
  'React Server Components 在 Cloudflare Workers 上的真实表现：流式渲染、Suspense、Server Actions 都能在 edge 节点零冷启动完成。',
  '2026-05-20',
  'zhao',
  '["rsc","edge","cloudflare-workers"]',
  '["RSC 的设计目标之一就是把渲染推到离用户最近的地方。Cloudflare Workers 的 V8 isolate 启动延迟 < 5ms，刚好契合 RSC 的流式模型。","实测一个 33 路由的 App Router 项目，vinext 在 Workers 上可以获得稳定的边缘 TTFB，并减少传统区域函数的冷启动波动。","唯一要注意的是 Workers 没有 Node.js API，只能用 Web 标准 + Workers 提供的 bindings（KV、Durable Objects、R2、AI）。"]'
),
(
  'deploy-with-one-command',
  'vinext deploy: 一行命令把博客送上 Workers',
  '本文演示如何用 vinext deploy 把一个 Next.js App Router 项目自动构建并发布到 Cloudflare Workers，并配置自定义域名。',
  '2026-06-01',
  'zhao',
  '["deploy","cloudflare","tutorial"]',
  '["前置条件：Cloudflare 账号、本地 wrangler login 完成。","然后在项目根目录执行 npx vinext deploy。vinext 会自动：调用 vinext build、生成 wrangler.jsonc、上传到 Workers。","部署完成后会得到一个 *.workers.dev 域名，你可以在 Cloudflare dashboard 绑定自己的域名。"]'
);
