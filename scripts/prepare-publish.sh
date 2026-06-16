#!/bin/bash

# 发布准备脚本
# 用于检查和准备 npm 发布所需的配置

set -e

echo "🚀 notionx 发布准备检查"
echo "===================="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_command() {
  if command -v $1 &> /dev/null; then
    echo -e "${GREEN}✓${NC} $1 已安装"
    return 0
  else
    echo -e "${RED}✗${NC} $1 未安装"
    return 1
  fi
}

# 1. 检查必要的命令
echo "1️⃣  检查必要工具..."
check_command "node"
check_command "pnpm"
check_command "git"
echo ""

# 2. 检查 npm 登录状态
echo "2️⃣  检查 npm 登录状态..."
if npm whoami &> /dev/null; then
  NPM_USER=$(npm whoami)
  echo -e "${GREEN}✓${NC} 已登录 npm，用户: $NPM_USER"
else
  echo -e "${YELLOW}⚠${NC} 未登录 npm，请运行: npm login"
fi
echo ""

# 3. 检查 git 状态
echo "3️⃣  检查 git 状态..."
if [ -z "$(git status --porcelain)" ]; then
  echo -e "${GREEN}✓${NC} 工作目录干净"
else
  echo -e "${YELLOW}⚠${NC} 有未提交的更改"
  git status --short
fi
echo ""

# 4. 检查分支
echo "4️⃣  检查当前分支..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo -e "${GREEN}✓${NC} 当前在 main 分支"
else
  echo -e "${YELLOW}⚠${NC} 当前在 $CURRENT_BRANCH 分支（建议在 main 分支发布）"
fi
echo ""

# 5. 运行测试
echo "5️⃣  运行测试..."
if pnpm -r test &> /dev/null; then
  echo -e "${GREEN}✓${NC} 所有测试通过"
else
  echo -e "${RED}✗${NC} 测试失败，请修复后再发布"
fi
echo ""

# 6. 运行 lint
echo "6️⃣  运行代码检查..."
if pnpm -r lint &> /dev/null; then
  echo -e "${GREEN}✓${NC} 代码检查通过"
else
  echo -e "${YELLOW}⚠${NC} 代码检查有警告"
fi
echo ""

# 7. 运行类型检查
echo "7️⃣  运行类型检查..."
if pnpm -r typecheck &> /dev/null; then
  echo -e "${GREEN}✓${NC} 类型检查通过"
else
  echo -e "${RED}✗${NC} 类型检查失败"
fi
echo ""

# 8. 构建包
echo "8️⃣  构建包..."
if pnpm build &> /dev/null; then
  echo -e "${GREEN}✓${NC} 构建成功"
else
  echo -e "${RED}✗${NC} 构建失败"
  exit 1
fi
echo ""

# 9. 检查包信息
echo "9️⃣  包信息检查..."
echo ""
echo "📦 @notionx/core"
cd packages/nextion
NOTIONX_VERSION=$(node -p "require('./package.json').version")
NOTIONX_PRIVATE=$(node -p "require('./package.json').private")
echo "   版本: $NOTIONX_VERSION"
echo "   私有: $NOTIONX_PRIVATE"
if [ "$NOTIONX_PRIVATE" = "true" ]; then
  echo -e "   ${YELLOW}⚠ 包设置为私有，不会发布到 npm${NC}"
fi
cd ../..
echo ""

echo "📦 @notionx/create-notionx-app"
cd packages/create-nextion-app
CREATE_VERSION=$(node -p "require('./package.json').version")
CREATE_PRIVATE=$(node -p "require('./package.json').private || 'false'")
echo "   版本: $CREATE_VERSION"
echo "   私有: $CREATE_PRIVATE"
cd ../..
echo ""

# 10. 检查 changesets
echo "🔟 检查 changesets..."
CHANGESET_COUNT=$(ls -1 .changeset/*.md 2>/dev/null | grep -v README.md | wc -l | tr -d ' ')
if [ "$CHANGESET_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✓${NC} 有 $CHANGESET_COUNT 个待应用的 changeset"
  ls .changeset/*.md | grep -v README.md
else
  echo -e "${YELLOW}⚠${NC} 没有待应用的 changeset"
  echo "   运行 'pnpm changeset' 创建一个"
fi
echo ""

# 总结
echo "===================="
echo "📋 准备检查完成！"
echo ""
echo "下一步操作："
echo "1. 如果有未提交的更改，提交它们"
echo "2. 如果没有 changeset，运行: pnpm changeset"
echo "3. 推送到 main 分支: git push origin main"
echo "4. GitHub Actions 会自动处理发布"
echo ""
echo "或手动发布："
echo "  pnpm --filter @notionx/core publish"
echo "  pnpm --filter @notionx/create-notionx-app publish"
echo ""
