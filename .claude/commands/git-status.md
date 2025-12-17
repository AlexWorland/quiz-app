---
allowed-tools: Bash(git:*)
description: Show git status and recent changes for the quiz app
---

# Git Status

Show the current git status and recent changes.

## Current Status
!`git status`

## Recent Commits
!`git log --oneline -10`

## Unstaged Changes
!`git diff --stat`

## Staged Changes
!`git diff --cached --stat`

## Branch Info
!`git branch -vv`

## Useful Commands
- Stage all changes: `git add -A`
- Commit: `git commit -m "message"`
- Push: `git push origin main`
- Pull latest: `git pull origin main`
