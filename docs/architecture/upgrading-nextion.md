# 升级 Nextion

> 范围：消费 `@nextion/core` 的项目如何获得修复与新能力。三类升级：
> patch/minor 自动；major 手动；canary 自行取用。

## 1. Dependabot 配置（推荐）

每个消费项目仓库根放一个 `.github/dependabot.yml`，让 GitHub 监听
`@nextion/core` 的新版本。下面是一份最小可用配置（仓库里目前还没有这
个文件，需要时直接添加）：

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    # 只关心 @nextion/core；其它依赖可以并行开启其它 update 条目
    allow:
      - dependency-name: "@nextion/core"
    # patch/minor 自动合入；major 必须人工 review
    labels:
      - "dependencies"
      - "nextion"
    groups:
      nextion-patch:
        applies-to: version-updates
        update-types:
          - "minor"
          - "patch"
```

需要 GitHub Packages 凭据（私有 registry），可在仓库
`Settings → Secrets and variables → Actions` 配一个
`NODE_AUTH_TOKEN`，内容是具备 `read:packages` 权限的 PAT。

## 2. 自动合并策略

让 patch 与 minor 升级在 CI 绿后自动合入：

1. 在仓库 `Settings → General → Pull Requests` 打开 **Allow auto-merge**。
2. 对 Dependabot PR：仓库里加一个 GitHub Actions（`.github/workflows/dependabot-auto-merge.yml`）：

   ```yaml
   name: dependabot-auto-merge
   on: pull_request
   permissions:
     contents: write
     pull-requests: write
   jobs:
     auto-merge:
       if: github.actor == 'dependabot[bot]'
       runs-on: ubuntu-latest
       steps:
         - uses: dependabot/fetch-metadata@v2
           with: { github-token: ${{ secrets.GITHUB_TOKEN }} }}
         - name: Auto-merge minor/patch
           if: |
             steps.metadata.outputs.update-type == 'version-update:semver-minor' ||
             steps.metadata.outputs.update-type == 'version-update:semver-patch'
           run: gh pr merge --auto --squash "$PR_URL"
           env:
             PR_URL: ${{ github.event.pull_request.html_url }}
             GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

`version-update:semver-major` 不会触发此 job；major 升级必须人工 review 并
阅读 [Nextion Changelog](./nextion-changelog.md) 中的迁移说明。

## 3. 升级前的金丝雀测试

Nextion 仓库内的 `apps/moviebluebook` 是所有消费项目的**金丝雀**：它跑的是仓库
当前 head 的代码，而不是已发布的版本。在合入一个会影响 starter 的 PR 之前：

```bash
# 在 monorepo 根
pnpm --filter @nextion/core test
pnpm --filter @nextion/moviebluebook test
pnpm --filter @nextion/core lint
pnpm --filter @nextion/core typecheck
```

要点：

- `pnpm --filter @nextion/core test` 验证包内的单元测试（vitest）；
- `pnpm --filter @nextion/moviebluebook test` 验证 moviebluebook 的 node:test 回归（路由、
  Webhook、内容模型、admin 行为）；
- `pnpm --filter @nextion/core nextion:doctor` 在 dev 环境跑一次，确
  认 bindings / env 配置没有漂移。

外部消费项目在收到 major Dependabot PR 后，可以临时把
`@nextion/core` 指向 monorepo 的 `apps/moviebluebook` 旁边的工作区构建产物（例
如通过 `pnpm pack`），或者直接 cherry-pick 该 PR 到自己的 fork，跑自己的回
归套件。

## 4. 手动升级

任何时候都可以绕过 Dependabot：

```bash
pnpm update @nextion/core
# 或锁定到具体版本
pnpm add @nextion/core@^1.2.0
```

升级后必跑：

```bash
pnpm test
pnpm dev        # 验证 /admin/content-models、/login、/api/health 正常
pnpm exec wrangler d1 migrations apply <db-name> --remote   # 仅当发布说明要求
```

## 5. 收尾

合入升级后，请把 [Nextion Changelog](./nextion-changelog.md) 里那段
release notes 链接到项目的 release notes / changelog，方便 reviewer 看到本
次升级涵盖什么。
