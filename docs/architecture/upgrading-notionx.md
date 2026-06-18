# 升级 Notionx

> 范围：消费项目通过 CLI 升级源代码与元数据，再由用户安装、测试和部署。
> Notionx 不做 WordPress 式运行时自更新；部署后的项目需要经过构建与发布流程。

## 命令边界

| 场景 | 命令 | 默认是否改云资源 | 默认是否 deploy |
|---|---|---:|---:|
| 升级核心依赖元数据 | `notionx update --core` | 否 | 否 |
| 预览脚手架 / registry 迁移 | `notionx update --dry-run` | 否 | 否 |
| 写入脚手架 / registry 迁移文件 | `notionx update` | 否 | 否 |
| 修复资源漂移 | `notionx provision repair` | 需要用户确认 | 否 |

## 1. Dependabot 配置（推荐）

每个消费项目仓库根放一个 `.github/dependabot.yml`，让 GitHub 监听
`@notionx/core` 的新版本。下面是一份最小可用配置（仓库里目前还没有这
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
    # 只关心 @notionx/core；其它依赖可以并行开启其它 update 条目
    allow:
      - dependency-name: "@notionx/core"
    # patch/minor 自动合入；major 必须人工 review
    labels:
      - "dependencies"
      - "notionx"
    groups:
      notionx-patch:
        applies-to: version-updates
        update-types:
          - "minor"
          - "patch"
```

需要 npm 凭据（如发布私有包），可在仓库
`Settings → Secrets and variables → Actions` 配一个
`NODE_AUTH_TOKEN`，内容是具备 publish 权限的 npm access token。

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
阅读 [Notionx Changelog](./notionx-changelog.md) 中的迁移说明。

## 3. 升级前的金丝雀测试

脚手架生成的项目是所有消费项目的**金丝雀**：它跑的是仓库
当前 head 的代码，而不是已发布的版本。在合入一个会影响 starter 的 PR 之前：

```bash
# 在 monorepo 根
pnpm --filter @notionx/core test
pnpm --filter @notionx/cli test
pnpm --filter @notionx/core lint
pnpm --filter @notionx/core typecheck
```

要点：

- `pnpm --filter @notionx/core test` 验证包内的单元测试（vitest）；
- `pnpm --filter @notionx/cli test` 验证脚手架与 CLI 的回归
  （路由、Webhook、内容模型、admin 行为）；
- `pnpm --filter @notionx/core notionx:doctor` 在 dev 环境跑一次，确
  认 bindings / env 配置没有漂移。

外部消费项目在收到 major Dependabot PR 后，可以临时把
`@notionx/core` 指向 monorepo 的工作区构建产物（例
如通过 `pnpm pack`），或者直接 cherry-pick 该 PR 到自己的 fork，跑自己的回
归套件。

## 4. 手动升级

推荐用最新版维护 CLI 开始升级，避免本地旧 CLI 看不到新模板 / 新迁移：

```bash
npx -p @notionx/cli@latest notionx update --core
pnpm install
pnpm exec notionx update --dry-run
pnpm exec notionx update
```

这组命令会：

- 把 `package.json` 里的 `@notionx/core` 升到 npm `latest`
- 同步 `.notionx/registry.json#notionxCore`
- 如果项目安装了本地维护 CLI，同步 `@notionx/cli`
- 预览并写入脚手架 / registry 迁移文件
- 不自动改 Notion 数据、不自动改 Cloudflare 资源、不自动 deploy

升级后推荐验证：

```bash
pnpm test
pnpm dev        # 验证 /admin/content-models、/login、/api/health 正常
pnpm exec wrangler d1 migrations apply <db-name> --remote   # 仅当 release notes 要求
```

## 5. 收尾

合入升级后，请把 [Notionx Changelog](./notionx-changelog.md) 里那段
release notes 链接到项目的 release notes / changelog，方便 reviewer 看到本
次升级涵盖什么。

## 高频迭代期推荐流程

当脚手架和 `@notionx/core` 都在快速变化时，推荐按下面顺序判断：

1. 运行 `notionx update`
2. 命令检测项目元数据、依赖版本、Notion 资源和 Cloudflare bindings
3. 先用 `--dry-run` 看迁移计划
4. 再写入迁移文件并手动确认资源变更
5. 只有测试通过并需要发布时，再手动 deploy
