# 发布到 npm 指南

本文档说明如何将 vinext monorepo 中的两个包发布到 npm。

## 包结构

| 包 | 作用 | 当前版本 |
|---|---|---|
| `@notionx/core` | 核心框架库（运行时） | 0.1.0 |
| `@notionx/create-nextion-app` | CLI 脚手架工具 | 0.2.0 |

**两个包都发布到 npmjs.com**（不是 GitHub Packages）。

## 前置准备

### 1. npm 账号

```bash
npm login
# 或编辑 ~/.npmrc：
# registry=https://registry.npmjs.org/
# //registry.npmjs.org/:_authToken=<your-token>
```

### 2. 组织权限

需要 `notionx` 组织的 owner 权限。组织是单用户组织时，创建者自动是 owner。

### 3. npm token

推荐用 **Granular Access Token**：
- Bypass 2FA: ✅
- Packages and scopes: `@notionx`（或 All packages）
- Permissions: Read and write

Generate at: https://www.npmjs.com/settings/digwis/tokens

### 4. GitHub Secrets（可选，仅自动发布需要）

`NPM_TOKEN` → token 字符串  
配置位置: https://github.com/digwis/nextion/settings/secrets/actions

## 发布流程

### 手动发布

```bash
# 1. 构建
pnpm --filter @notionx/core build
pnpm --filter @notionx/create-nextion-app build

# 2. 升级版本（手动改 package.json，或 pnpm version）
# 3. 发布
cd packages/nextion
npm publish --access public
cd ../create-nextion-app
npm publish --access public
```

### Changesets + GitHub Actions（自动）

1. 创建一个 changeset：
   ```bash
   pnpm changeset
   ```
2. 提交并推送：
   ```bash
   git add .
   git commit -m "feat: 新功能"
   git push origin main
   ```
3. Actions 自动：
   - 跑 CI（test / lint / typecheck）
   - 开一个 "Version Packages" PR
   - 合并该 PR → 自动发布到 npm

## 版本策略

[语义化版本](https://semver.org/)：

- **Major (X.0.0)**: 不兼容的 API 变更
- **Minor (0.X.0)**: 向后兼容的功能新增（改了 prompt 行为、改了模板结构）
- **Patch (0.0.X)**: 文档、bug 修复、内部重构

## 发布前检查

- [ ] `pnpm -r test`
- [ ] `pnpm -r lint`（如有）
- [ ] `pnpm -r typecheck`（如有）
- [ ] `pnpm --filter @notionx/core build`
- [ ] `pnpm --filter @notionx/create-nextion-app build`
- [ ] README 和 CHANGELOG 已更新

## 发布后验证

```bash
# 包元信息
npm view @notionx/core
npm view @notionx/create-nextion-app

# 端到端测试
npx @notionx/create-nextion-app my-test-app
cd my-test-app
pnpm install
pnpm test
```

## 回滚发布

```bash
# 撤回 72 小时内的版本
npm unpublish @notionx/core@0.1.0
npm unpublish @notionx/create-nextion-app@0.2.0

# 或废弃（推荐）
npm deprecate @notionx/core@0.1.0 "Use 0.1.1+ for bug fix"
```

## 资源链接

- [Changesets 文档](https://github.com/changesets/changesets)
- [npm publish](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [npm Granular Tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [语义化版本](https://semver.org/lang/zh-CN/)
