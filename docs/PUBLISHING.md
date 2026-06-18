# 发布到 npm 指南

本文档说明如何将 notionx monorepo 中的包发布到 npm。

## 包结构

| 包 | 作用 | 当前版本 |
|---|---|---|
| `@notionx/core` | 核心运行时 / 框架底座 | 查看 `packages/notionx/package.json` |
| `@notionx/cli` | 脚手架和 `notionx` 维护 CLI | 查看 `packages/notionx-cli/package.json` |
| `create-notionx` | `npm create notionx` 入口 shim | 查看 `packages/create-notionx/package.json` |
| `@notionx/skill` | notionx skill 安装器 | 查看 `packages/notionx-skill/package.json` |

**所有包都发布到 npmjs.com**（不是 GitHub Packages）。

`docs/PUBLISHING.md` 是发布流程的单一事实来源。根目录不再维护额外的
快速发布说明或配置清单，避免多份文档漂移。

## 一句话流程

> 改完代码 → `pnpm changeset` → commit + `git push` → CI 自动 publish。

发布在 `main` 上自动完成（GitHub Actions），前提是 push 里带了一个 changeset。**没有 changeset = npm 不动**。

## 推送之前：本地预检

`.husky/pre-push` 钩子会先跑一次 `scripts/check-changeset.mjs`，告诉你这次 push 会不会触发 publish：

```text
  ✓  npm publish WILL run for this push.
    Packages to bump: @notionx/cli (0.7.0 → ?)
    ...
```
或
```text
  ✗  npm publish will NOT run for this push.
    Code changed in: @notionx/cli (5 files)
    No changeset was added or modified.
    Add one before pushing: pnpm changeset
```

如果想手动检查（不 push）：

```bash
pnpm release:status
```

## 详细步骤

### 1. 写代码

跟平时一样开发、跑 `pnpm -r test`、`pnpm -r typecheck`、`pnpm -r lint`。

### 2. 加 changeset

每个有改动的包都需要一个 changeset。**必须**在 `git add` 之前加，否则 pre-push 会拦你。

```bash
pnpm changeset
```

交互式选包 + bump 级别（patch / minor / major）+ 写一行描述。它会创建一个 `.changeset/<random-name>.md`：

```md
---
"@notionx/cli": minor
---

加了一个 `--no-site-settings` flag 跳过 Notion site settings
```

或者直接手写：

```bash
cat > .changeset/no-site-settings.md <<'EOF'
---
"@notionx/cli": minor
---

Add `--no-site-settings` flag
EOF
```

**bump 级别速查**：

- **patch** — bug 修复、依赖升级、文档、内部重构
- **minor** — 新功能、新 CLI flag、新模板文件（向后兼容）
- **major** — 破坏性改动（改 package 公共 API、改模板目录结构）

### 3. Commit + push

```bash
git add -A
git commit -m "feat: 加 --no-site-settings flag"
git push origin main
```

push 时 pre-push 钩子会预测这次会不会 publish，**有错就拦你**。

### 4. 看 CI 跑没跑

去 https://github.com/digwis/notionx/actions 看 `release` workflow。

完整流程：
1. `pnpm install --frozen-lockfile`
2. 所有可发布包按各自脚本 `build`
3. `pnpm changeset version`（在 runner 上 bump 版本、删 `.changeset/*.md`）
4. commit + push `chore(release): version packages` 回 main
5. `node scripts/publish-packages.mjs`

### 5. 验证

```bash
npm view @notionx/core version
npm view @notionx/cli version
npm view create-notionx version
npm view @notionx/skill version
```

## 跳过 pre-push 检查

不推荐，但偶尔有必要（紧急修复、批量更新）：

```bash
git push --no-verify origin main
```

## 协作模式：以后开 PR 怎么搞

目前是「直接 push 到 main」。要切到 PR 流程的话：

1. GitHub → Settings → Branches → Add rule for `main`
2. 勾上 "Require a pull request before merging"
3. 勾上 "Require approvals"（至少 1 个 reviewer）
4. 勾上 "Do not allow bypassing the above settings"

`release.yml` 不会改——它只关心 push 到 main 的 commit 内容，PR merge 也是 push 到 main。**PR 头部分支不会触发 release**，所以 PR review 期间可以反复 push 调试而不污染 npm。

## 资源链接

- [Changesets 文档](https://github.com/changesets/changesets)
- [npm publish](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [npm Granular Tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [语义化版本](https://semver.org/lang/zh-CN/)
