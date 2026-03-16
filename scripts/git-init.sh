#!/usr/bin/env bash
# =============================================================================
# Git initialization and first push — all 12 phases complete
# =============================================================================
# Usage:
#   chmod +x scripts/git-init.sh
#   ./scripts/git-init.sh <github-username> <repo-name>
# =============================================================================

set -euo pipefail

GITHUB_USER="${1:?Usage: $0 <github-username> <repo-name>}"
REPO_NAME="${2:?Usage: $0 <github-username> <repo-name>}"
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "==> Initializing git repository..."
git init

echo "==> Setting default branch to main..."
git branch -M main

echo "==> Staging all files..."
git add .

echo "==> Creating initial commit (all 12 phases)..."
git commit -m "feat: complete offline-first Kanban app (all 12 phases)

Stack: React Native + React Native Web, TypeScript strict, Zustand,
WatermelonDB (SQLite mobile / IndexedDB web), Workbox PWA, Docker

Phase 1  — Monorepo, TypeScript, Docker, Zustand, design tokens
Phase 2  — WatermelonDB schema, 8 models, 5 repositories, platform adapters
Phase 3  — Local auth (bcrypt cost 12), session persistence, AuthGate
Phase 4  — Project CRUD, ProjectListScreen, AppNavigator
Phase 5  — Full Kanban engine: lanes, cards, fractional ordering, board UI
Phase 6  — Cross-lane drag-and-drop via PanResponder + DragContext
Phase 7  — Markdown editor (web+native), hashtag system, TagService
Phase 8  — Attachments: Canvas/ImageResizer compression, blob storage
Phase 9  — Settings: theme, fonts, default lanes, image size, sync endpoint
Phase 10 — Performance: reactive observables, adaptive FlatList, rebalancer
Phase 11 — LRU thumbnail cache (O(1) all ops), prefetch, zero flicker
Phase 12 — PWA: Workbox service worker, manifest, offline banner, update prompt

130 files | 14 test suites | ~2400 test lines"

echo "==> Adding remote origin: ${REMOTE_URL}"
git remote add origin "${REMOTE_URL}"

echo ""
echo "==> Ready to push. Run:"
echo "    git push -u origin main"
echo ""
echo "Create the repo first at: https://github.com/new"
echo "  Name: ${REPO_NAME}"
echo "  Private: yes (recommended)"
echo "  Initialize with README: NO"
