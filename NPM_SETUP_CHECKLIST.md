# npm 发布设置清单

## ✅ 当前发布状态

| 包 | 版本 | Registry |
|---|---|---|
| `@notionx/core` | 0.1.0 | https://registry.npmjs.org/ |
| `@notionx/create-nextion-app` | 0.2.0 | https://registry.npmjs.org/ |

- **npm org**: `notionx`
- **登录用户**: `digwis`
- **仓库**: https://github.com/digwis/nextion
- **Token 类型**: Granular Access Token（带 bypass 2FA，scope 锁到 `@notionx`）

## ✅ 已完成配置

- ✅ Package.json 设置了 `publishConfig.access: "public"`
- ✅ 仓库信息、author、homepage、bugs 字段已填好
- ✅ `.npmignore` 已配
- ✅ `files` 字段只发布 `dist` + `README.md`
- ✅ `prepublishOnly: pnpm build` 已配
- ✅ GitHub Actions + Changesets workflow 已就位

## ✅ 手动完成项

- ✅ npm 组织 `notionx` 已注册
- ✅ npm token 已生成（带 bypass 2FA）
- ✅ `~/.npmrc` 已配置 token
- ✅ `NPM_TOKEN` GitHub Secret 已加（待你确认）

## 🔄 升级发布流程

### 手动发布

```bash
# 1. 改完代码后升级版本（编辑 packages/*/package.json 的 version 字段）

# 2. 构建
pnpm --filter @notionx/core build
pnpm --filter @notionx/create-nextion-app build

# 3. 发布
cd packages/nextion          && npm publish --access public
cd ../create-nextion-app     && npm publish --access public
```

### Changesets + GitHub Actions（自动）

1. 创建 changeset：`pnpm changeset`
2. 提交推送：`git push origin main`
3. Actions 自动开 Version Packages PR → 合并后自动发布

## 🔍 验证发布

```bash
# 看包信息
npm view @notionx/core
npm view @notionx/create-nextion-app

# 端到端测试
npx @notionx/create-nextion-app my-test-app
cd my-test-app
pnpm install
pnpm test
```

## ⚠️ 注意事项

1. 首次发布 scoped package 必须用 `--access public`
2. npm 只允许 **72 小时内**撤回发布
3. 跨 token 切换时记得 `npm logout && npm login`（或覆盖 `~/.npmrc`）
4. 升级 wrangler 时如果 < 4.0.0，部分 `--json` flag 会失败

## 🆘 常见问题

### 发布时 403 权限错误
- 检查 token 的 `scopes` 字段是否含 `@notionx`
- 检查 token 的 `bypass_2fa` 是否为 `true`
- 检查你是否是 `notionx` 组织的 owner

### 404 找不到 scope
- token 的 `scopes` 锁在了别的 scope
- 重新生成 token，选对 scope

### 撤销泄露的 token
- https://www.npmjs.com/settings/digwis/tokens
- 点 token 详情 → Revoke

## 📚 相关文档

- 详细发布指南：`docs/PUBLISHING.md`
- 快速参考：`QUICK_PUBLISH_GUIDE.md`
- CLI 用户文档：`packages/create-nextion-app/README.md`
- CLI 维护者文档：`packages/create-nextion-app/DEVELOPMENT.md`
