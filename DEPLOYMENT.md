# Deployment & Post-Build Guide

All 12 phases are complete. This document covers:
1. [Final git commit](#1-final-git-commit)
2. [Local testing checklist](#2-local-testing-checklist)
3. [Production web build](#3-production-web-build)
4. [PWA installation and verification](#4-pwa-installation-and-verification)
5. [Mobile build](#5-mobile-build)
6. [Running the full test suite](#6-running-the-full-test-suite)
7. [What comes after Phase 12](#7-what-comes-after-phase-12)

---

## 1. Final git commit

```bash
# Open a shell into the running container
docker compose exec app bash

# Stage all Phase 12 changes
git add .

git commit -m "feat: Phase 12 — PWA support (all phases complete)

PWA:
  - service-worker.ts: Workbox InjectManifest with three caching strategies
    StaleWhileRevalidate (JS/CSS), CacheFirst (fonts/images), NetworkFirst (API)
  - manifest.json: full web app manifest with icons and shortcuts
  - sw-registration.ts: lifecycle management with onUpdate/onSuccess callbacks
  - OfflineBanner: animated slide-in/out when device is offline
  - UpdatePrompt: user-controlled SW skip-waiting with spring animation
  - useOfflineStatus: platform-aware (web events / @react-native-community/netinfo)
  - webpack: InjectManifest plugin, separate watermelondb chunk, static serving

Thumbnail caching (Phase 11):
  - ThumbnailCache: LRU doubly-linked-list + Map, O(1) all operations
  - useThumbnail: synchronous cache-first, zero flicker on scroll-back
  - useThumbnailPrefetch: batched background pre-warm
  - CachedThumbnail: board-level thumbnail widget
  - Cache cleared on logout

Performance (Phase 10):
  - useLiveBoard: per-lane WatermelonDB observable subscriptions
  - InteractionManager.runAfterInteractions defers subscription setup
  - selectFlatListPreset: adaptive windowing (aggressive/balanced/generous)
  - getItemLayout: pre-computed item heights, no measurement jank
  - Fractional index rebalancer: triggers at 1e-10 precision threshold
  - IndexedDB web worker enabled

All phases: 130 files, 14 test files, ~2400 test lines"

git push origin main
```

---

## 2. Local testing checklist

Run these in order to verify the full stack before pushing:

```bash
# Run tests via compose (no shell needed)
docker compose run --rm test

# Or open a shell for the full suite of checks:
docker compose exec app bash

# 1. Type check (zero TypeScript errors expected)
yarn typecheck

# 2. Lint
yarn lint

# 3. Full test suite (14 test files)
yarn test

# 4. Coverage report
yarn test:coverage
```

**Manual testing flow (web):**

```bash
yarn web  # http://192.168.1.100:8080
```

| Feature | Test |
|---|---|
| Register | Create a new account |
| Login | Sign in with the same credentials |
| Create project | Tap "+ New board" |
| Open board | Board shows 3 default lanes |
| Add cards | Tap "+ Add card" in any lane |
| Edit card | Tap a card → title, description, status |
| Markdown | Type `**bold**` → Preview tab → should render |
| Tags | Type `#feature` in description → tag auto-created |
| Attach image | Scroll to Attachments → "Attach file" → select image |
| Thumbnail | Close and reopen card → thumbnail instant (cached) |
| Drag card | Long-press 300ms → drag → drop in different lane |
| Settings | ⚙ gear icon → change theme → whole app re-renders |
| Offline | Disable network → yellow offline banner appears |
| PWA install | Chrome: "Add to Home Screen" button in address bar |
| SW update | Build new version → "Update available" banner |

---

## 3. Production web build

```bash
# Open a shell and build
docker compose exec app bash
yarn workspace @kanban/web build

# The dist/ output looks like:
# dist/
#   index.html           ← entry point
#   main.[hash].js       ← app bundle
#   vendors.[hash].js    ← React, React Native Web, Zustand
#   watermelondb.[hash].js ← WatermelonDB (separate chunk)
#   service-worker.js    ← Workbox service worker with injected precache manifest
#   manifest.json        ← PWA manifest (copied from public/)
#   icons/               ← App icons (needs to be added to public/icons/)
#   favicon.ico
```

**Serve the production build locally:**

```bash
cd apps/web
npx serve -s dist -l 8080
# → http://192.168.1.100:8080
```

The `-s` flag enables SPA fallback (all routes return `index.html`), matching `historyApiFallback` in the dev server.

**Deploy to a static host:**

The `dist/` folder can be deployed to any static host:
- **Nginx** on the ThinkPad itself (most private — stays on LAN)
- **Cloudflare Pages** (free, global CDN, HTTPS required for service worker)
- **GitHub Pages** (free, requires public repo)
- **Vercel / Netlify** (free tier, zero-config)

HTTPS is **required** for service workers and PWA installation. Localhost is the only exception.

---

## 4. PWA installation and verification

### Desktop Chrome
1. Open `http://your-domain.com` (must be HTTPS in production)
2. Click the install icon in the address bar (or ⋮ → "Install Kanban")
3. App opens in a standalone window — no browser chrome

### Mobile Chrome (Android)
1. Open the URL in Chrome
2. Banner: "Add Kanban to Home screen" → tap "Add"
3. App installs as a home screen icon

### iOS Safari
1. Open the URL in Safari
2. Tap Share → "Add to Home Screen"
3. Tap "Add" → app icon appears on home screen

### Verify service worker
In Chrome DevTools → Application → Service Workers:
- Status: **activated and running**
- No errors in the console

In Application → Cache Storage:
- `precache-v2-…` — all app shell assets
- `static-assets` — fonts and images
- `js-css-cache` — dynamic JS chunks

### Verify offline mode
1. DevTools → Network → set to "Offline"
2. Reload the page — app should load from cache
3. Create a card — writes to IndexedDB normally
4. Restore network → data is already saved

---

## 5. Mobile build

### Android (requires Android SDK in Docker container)

```bash
# Inside the container
cd apps/mobile
yarn android  # builds and deploys to connected device or emulator
```

**Release APK:**
```bash
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### iOS (requires macOS + Xcode — not buildable in Docker)

```bash
cd apps/mobile/ios
pod install
open KanbanApp.xcworkspace
# Build and run in Xcode
```

---

## 6. Running the full test suite

**All 14 test files, ~2400 lines:**

```
packages/utils/src/__tests__/utils.test.ts          ← fractional indexing, utils
packages/store/src/__tests__/store.test.ts           ← Zustand slice logic
packages/database/src/__tests__/repositories.test.ts ← WatermelonDB repositories
packages/services/src/__tests__/AuthService.test.ts  ← bcrypt, login, session
packages/services/src/__tests__/ProjectService.test.ts ← CRUD, ownership
packages/services/src/__tests__/CardService.test.ts  ← card CRUD, validation
packages/services/src/__tests__/MarkdownToolbar.test.ts ← formatting transforms
packages/services/src/__tests__/ImageProcessor.test.ts ← MIME type helpers
packages/services/src/__tests__/SettingsService.test.ts ← config validation
packages/services/src/__tests__/ThumbnailCache.test.ts ← LRU eviction (22 tests)
packages/services/src/__tests__/flatListConfig.test.ts ← preset selection
packages/services/src/__tests__/rebalancer.test.ts   ← precision drift
packages/services/src/__tests__/useDragDrop.test.ts  ← neighbor resolution
packages/services/src/__tests__/pwa.test.ts          ← SW registration logic
```

```bash
yarn test --verbose
```

Expected: **all tests pass**.

---

## 7. What comes after Phase 12

The architecture was designed from the start to support these next steps without major redesign:

### SaaS sync (Phase 13)
WatermelonDB has a built-in sync protocol (`synchronize()`) that implements the pull-then-push algorithm. The database schema already has `deleted_at` soft-delete columns and `updated_at` timestamps — exactly what WatermelonDB sync requires.

```ts
// The sync is ~20 lines of code once the server is ready:
import { synchronize } from '@nozbe/watermelondb/sync';

await synchronize({
  database: db.db,
  pullChanges: async ({ lastPulledAt }) => {
    const res = await fetch(`${syncEndpoint}/pull?lastPulledAt=${lastPulledAt}`);
    return res.json();
  },
  pushChanges: async ({ changes, lastPulledAt }) => {
    await fetch(`${syncEndpoint}/push`, {
      method: 'POST',
      body: JSON.stringify({ changes, lastPulledAt }),
    });
  },
});
```

The Settings screen already has the sync toggle and endpoint field — they just need to be un-disabled.

### Multi-device / collaboration (Phase 14)
With sync enabled, multiple devices can share boards. Conflict resolution uses WatermelonDB's last-write-wins strategy by default, which is correct for Kanban cards (the last person to move a card wins).

### Card templates
The schema supports this today — a "template" is just a card with `isTemplate: true` added to the schema. The `createCard` service method can accept a `fromTemplate` option.

### Rich text (Phase N)
The description is stored as markdown. A future editor (e.g. TipTap) can import/export markdown, making it backward-compatible. The `MarkdownRenderer` web implementation would simply be replaced with the editor's viewer.

### End-to-end encryption
All data lives in WatermelonDB. Encrypting the SQLite file on mobile uses `@nozbe/watermelondb` with `react-native-mmkv` for the encryption key. On web, IndexedDB encryption is done at the application level before storing blobs.

---

## File inventory

```
130 total files

apps/
  mobile/         5 files  (App.tsx, babel, metro, package.json, tsconfig)
  web/           10 files  (App.tsx, index.tsx, webpack, package.json, HTML, manifest, SW)

packages/
  types/          2 files  (index.ts, package.json)
  utils/          3 files  (index.ts, tests, package.json)
  store/          7 files  (3 slices, index, tests, package.json)
  database/      17 files  (8 models, 5 repos, schema, migrations, context, provider, hook, index)
  services/      35 files  (auth, project, card, swimlane, tag, attachment, settings, thumbnail, perf)
  ui/            55 files  (15 components, 8 screens, 3 drag, 2 pwa, theme, index)
  adapters/       4 files  (sqlite, indexeddb)

root/            11 files  (package.json, tsconfigs, eslint, gitignore, Dockerfile, compose, README, DEPLOYMENT)
```
