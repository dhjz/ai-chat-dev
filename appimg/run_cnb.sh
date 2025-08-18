#!/bin/bash

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

echo "--- 2: 抓取 '$GITHUB_REMOTE_NAME' 远程仓库的最新内容 ---"
git fetch "$GITHUB_REMOTE_NAME"
echo "抓取完成。"
# 切换到分支
git checkout -b "$TARGET_BRANCH" "$GITHUB_REMOTE_NAME/$TARGET_BRANCH"

echo "--- 脚本结束 ---"