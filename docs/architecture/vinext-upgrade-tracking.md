# vinext 版本升级追踪

本文件记录 notionx 依赖 vinext 的版本历史与升级检查清单，用于在每次升级前评估风险、升级后验证回归。

## 当前版本

| 包 | 版本 | 声明位置 |
|----|------|--------|
| `vinext` | `^0.1.4` | [packages/nextion/package.json](../../packages/nextion/package.json)、[packages/create-nextion-app/src/templates/package.json.tmpl](../../packages/create-nextion-app/src/templates/package.json.tmpl) |
| `@vinext/cloudflare` | `^0.1.2` | [packages/create-nextion-app/src/templates/package.json.tmpl](../../packages/create-nextion-app/src/templates/package.json.tmpl) |

## 升级历史

| 日期 | vinext | @vinext/cloudflare | 备注 |
|------|--------|---------------------|------|
| 2026-06-15 | 0.1.2 → 0.1.3 | 0.1.2 | 初次接入 vinext 升级流程，见 [vinext-upgrade-implementation.md](../superpowers/plans/2026-06-15-vinext-upgrade-implementation.md) |
| 2026-06-16 | 0.1.3 → 0.1.4 | 0.1.2（未变） | 同步模板与测试断言；69 + 208 测试通过 |

## 升级前检查

升级 vinext 前必须完成以下步骤：

1. **查询最新版本**
   ```bash
   npm view vinext version
   npm view @vinext/cloudflare version
   npm view vinext versions --json     # 查看是否有破坏性变更的版本跳跃
   ```

2. **阅读 changelog / release notes**
   - vinext 仓库：https://github.com/cloudflare/vinext
   - 重点关注：Next.js 兼容性、Vite 版本要求、Workers 运行时行为变更、`vinext/server/app-router-entry` API 变更

3. **识别受影响的代码位置**
   ```bash
   # 搜索 vinext 在项目中的所有引用点
   grep -rn "vinext" packages/nextion/src packages/create-nextion-app/src
   ```
   关键文件：
   - [packages/nextion/package.json](../../packages/nextion/package.json) — 运行时依赖
   - [packages/create-nextion-app/src/templates/package.json.tmpl](../../packages/create-nextion-app/src/templates/package.json.tmpl) — 用户项目模板
   - [packages/create-nextion-app/src/templates/worker/index.ts.tmpl](../../packages/create-nextion-app/src/templates/worker/index.ts.tmpl) — `vinext/server/app-router-entry` 入口
   - [packages/nextion/src/platform/capabilities.ts](../../packages/nextion/src/platform/capabilities.ts) — adapter 描述里引用 vinext

## 升级步骤

1. **更新版本声明**
   - `packages/nextion/package.json` 的 `dependencies.vinext`
   - `packages/create-nextion-app/src/templates/package.json.tmpl` 的 `devDependencies.vinext`
   - 如 `@vinext/cloudflare` 也有新版，同步更新模板里的 `devDependencies.@vinext/cloudflare`

2. **更新测试断言**
   - [packages/create-nextion-app/src/render.test.ts](../../packages/create-nextion-app/src/render.test.ts) 中有一处硬编码版本断言，搜索 `vinext").toBe("^` 并更新

3. **安装依赖**
   ```bash
   pnpm install --no-frozen-lockfile
   ```
   注意：CI 默认 `frozen-lockfile`，本地升级必须加 `--no-frozen-lockfile`

4. **检查 peer dependency 警告**
   - vinext 0.1.4 要求 vite `^7.0.0 || ^8.0.0`
   - `packages/nextion` 本身用 tsup 构建，不直接依赖 vite，peer 警告可忽略
   - 若 vinext 新版引入新的 peer 要求，需评估是否影响模板

## 升级后验证

升级后必须全部通过：

```bash
# 1. 类型检查
pnpm --filter @notionx/core typecheck
pnpm --filter @notionx/create-notionx-app typecheck

# 2. 单元测试
pnpm --filter @notionx/core test           # 69 tests
pnpm --filter @notionx/create-notionx-app test  # 208 tests

# 3. Lint
pnpm --filter @notionx/core lint
pnpm --filter @notionx/create-notionx-app lint

# 4. 构建（验证 tsup 产物正常）
pnpm --filter @notionx/core build
```

**冒烟测试（可选但推荐）**：用升级后的脚手架生成一个新项目，跑 `vinext build` 确认构建链路通畅。

## 风险点

- **vinext 仍处于 0.x 阶段**：minor 版本可能引入破坏性变更，每次升级都要跑完整验证
- **`vinext/server/app-router-entry` 是关键 API**：worker 入口直接 import 它，若该模块路径或签名变更，需同步修改 [worker/index.ts.tmpl](../../packages/create-nextion-app/src/templates/worker/index.ts.tmpl)
- **Vite 版本耦合**：vinext 对 vite 有 peer 要求，模板里固定 `vite: ^8`，若 vinext 未来要求 vite 9+，需同步升级模板
- **Cloudflare Workers 运行时行为**：vinext 升级可能改变 RSC、streaming、edge cache 的行为，需关注 [packages/nextion/src/worker/bootstrap.ts](../../packages/nextion/src/worker/bootstrap.ts) 和 [packages/nextion/src/platform/cloudflare-runtime.ts](../../packages/nextion/src/platform/cloudflare-runtime.ts) 的交互

## 回滚

若升级后验证失败且无法快速修复：

1. 将 `package.json` 和模板里的 vinext 版本改回上一个已知可用版本
2. `pnpm install --no-frozen-lockfile`
3. 恢复 [render.test.ts](../../packages/create-nextion-app/src/render.test.ts) 中的版本断言
4. 在本文件的"升级历史"表格里标注该版本为"已回滚"
