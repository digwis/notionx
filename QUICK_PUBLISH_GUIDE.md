# 快速发布指南

## ✅ 已发布到 npm

| 包 | 版本 | 命令 |
|---|---|---|
| `@notionx/core` | 0.1.0 | `npm view @notionx/core` |
| `@notionx/create-nextion-app` | 0.2.0 | `npm view @notionx/create-nextion-app` |

- **Registry**: https://registry.npmjs.org/
- **npm org**: `notionx`
- **包作者**: digwis
- **scope 类型**: 公开（`--access public`）

## 🚀 升级发布新版本

### 选项 1：手动发布（适合小步快跑）

```bash
# 1. 修改代码 / 文档
# 2. 升级版本
#    packages/nextion/package.json → version 字段
#    packages/create-nextion-app/package.json → version 字段
# 3. 构建
pnpm --filter @notionx/core build
pnpm --filter @notionx/create-nextion-app build

# 4. 发布
cd packages/nextion          && npm publish --access public
cd ../create-nextion-app     && npm publish --access public
```

### 选项 2：Changesets + GitHub Actions

1. 在 `~/.npmrc` 写入一个有 `@notionx` 写权限的 token（Granular Access Token，bypass 2FA）
2. 把同样的 token 配到 GitHub Secrets：https://github.com/digwis/nextion/settings/secrets/actions
   - Name: `NPM_TOKEN`
3. 创建 changeset 推 main：
   ```bash
   pnpm changeset
   git add . && git commit -m "chore: release"
   git push origin main
   ```
4. GitHub Actions 会自动开 PR → 合并后自动发布

## 📋 npm 组织

当前用的是 `notionx` scope（不是文档里曾经写的 `nextion`），因为 `nextion` 已经被别的用户占用。

如果想换 scope：
1. 在 https://www.npmjs.com/org/create 建新组织
2. 全局把 `packages/*/package.json` 的 `name` 改掉
3. 把模板 (`src/templates/`) 里的 `@notionx/core` 引用同步改掉
4. 重新 sed 替换所有 `.ts` / `.tmpl` / `.json` 里的 `@notionx` → `@<新组织>`

## 🔍 验证发布

```bash
# 看包信息
npm view @notionx/core
npm view @notionx/create-nextion-app

# 端到端测试
npx @notionx/create-nextion-app my-test-app
cd my-test-app
pnpm install
pnpm test      # 4 个 smoke test
```

## 📚 详细文档

- 发布指南: `docs/PUBLISHING.md`
- 配置清单: `NPM_SETUP_CHECKLIST.md`
- CLI 维护者文档: `packages/create-nextion-app/DEVELOPMENT.md`
- 用户 README: `packages/create-nextion-app/README.md`（npmjs.com 展示的）
