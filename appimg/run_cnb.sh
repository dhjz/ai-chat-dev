#!/bin/bash

# 脚本名称: git_setup_and_merge.sh
# 作用: 添加或更新 'github' 远程仓库，并将其 master 分支内容合并到当前本地 master 分支。

# --- 配置变量 ---
GITHUB_USER="$1"
GITHUB_TOKEN="$2"
GITHUB_REMOTE_NAME="github"
GITHUB_REMOTE_URL="https://github.com/dhjz/ai-chat-dev.git"
TARGET_BRANCH="master" # 你希望操作的分支

git config --global credential.helper store
echo "https://$GITHUB_USER:$GITHUB_TOKEN@github.com" > ~/.git-credentials

echo "--- 步骤 1: 添加/更新远程仓库 '$GITHUB_REMOTE_NAME' $GITHUB_TOKEN ---"
if git remote -v | grep -q "^$GITHUB_REMOTE_NAME"; then
    echo "远程仓库 '$GITHUB_REMOTE_NAME' 已存在。更新其URL..."
    git remote set-url "$GITHUB_REMOTE_NAME" "$GITHUB_REMOTE_URL"
else
    echo "添加远程仓库 '$GITHUB_REMOTE_NAME'..."
    git remote add "$GITHUB_REMOTE_NAME" "$GITHUB_REMOTE_URL"
fi
echo "当前远程仓库列表:"
git remote -v
echo ""

# 6. 抓取最新内容从 github/master
echo "--- 步骤 2: 抓取 '$GITHUB_REMOTE_NAME' 远程仓库的最新内容 ---"
echo "这会下载远程分支和标签，但不会自动合并到你的本地分支。"
git fetch "$GITHUB_REMOTE_NAME"
echo "抓取完成。"
echo ""
# 切换到分支
git checkout -b "$TARGET_BRANCH" "$GITHUB_REMOTE_NAME/$TARGET_BRANCH"

# 7. 将 github/master 合并到当前本地master
echo "--- 步骤 3: 将 '$GITHUB_REMOTE_NAME/$TARGET_BRANCH' 合并到你的本地 '$TARGET_BRANCH' 分支 ---"
echo "注意: 这可能会导致合并冲突，如果两个仓库的 '$TARGET_BRANCH' 有不同的历史。"
# git merge "$GITHUB_REMOTE_NAME/$TARGET_BRANCH"

echo ""
echo "--- 脚本执行完毕！ ---"
echo "请检查是否有任何合并冲突。如果有，你需要手动解决它们。"
echo "解决冲突后，请提交你的更改。"
echo "最后，你可能需要将本地的 '$TARGET_BRANCH' 推送到 'origin' 远程仓库:"
echo "  git push origin $TARGET_BRANCH"
echo "--- 脚本结束 ---"