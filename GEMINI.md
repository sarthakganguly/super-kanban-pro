# Gemini Developer Handbook & Codebase Overview

> [!NOTE]
> This is the root page for developer documentation. For standard setup instructions, refer to **[README.md](./README.md)**. For production build and release guides, refer to **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## 1. Reference Documentation

Before modifying the codebase, please review the existing primary markdown documentation:
- **[README.md](./README.md)**: Main project documentation covering features, docker setup, local run commands, tech stack, and module-level dependency flow.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Guide on building for production (web bundles and mobile APKs/IPAs), verifying PWA caches, service worker lifecycle, and the detailed testing checklist.

---

## 2. Monorepo Map

The workspace is organized into separate packages to ensure strict separation of concerns and allow code sharing between the Web and Mobile targets:

```
[apps] ───────> [packages/ui] ───────> [packages/services] ───────> [packages/database] ───────> [packages/types] & [packages/utils]
  |                                                                                               ^
  └───────────────────────────> [packages/store] ─────────────────────────────────────────────────┘
```

### Core Logic & State
- **`packages/types` ([index.ts](./packages/types/src/index.ts))**: The single source of truth for domain data definitions. Contains interfaces for `User`, `Project`, `Swimlane`, `Card`, `Tag`, and `Attachment`, with zero runtime imports.
- **`packages/utils` ([index.ts](./packages/utils/src/index.ts))**: Pure TypeScript utility functions with no side effects. Includes the fractional indexing math (`computeFractionalIndex`), date handling, markdown hashtag extraction, and luminance checks.
- **`packages/store` ([index.ts](./packages/store/src/index.ts))**: Zustand slices for managing active session state (`currentUser`, `activeProjectId`, and loading overlays).

### Persistent Storage
- **`packages/database` ([index.ts](./packages/database/src/index.ts))**: WatermelonDB ORM layer:
  - **Schema & Migrations** ([schema/index.ts](./packages/database/src/schema/index.ts)): Version 1 schema defines SQLite/LokiJS tables.
  - **Models**: Decorated classes (e.g., [CardModel.ts](./packages/database/src/models/CardModel.ts)) handling relations (`belongs_to`, `has_many`).
  - **Repositories** (e.g., [CardRepository.ts](./packages/database/src/repositories/CardRepository.ts)): Encapsulates all direct database queries.
- **`packages/adapters`**:
  - **`adapters/sqlite` ([index.ts](./packages/adapters/sqlite/src/index.ts))**: SQLite storage adapter used natively on mobile devices.
  - **`adapters/indexeddb` ([index.ts](./packages/adapters/indexeddb/src/index.ts))**: LokiJS-backed IndexedDB adapter used on browsers.

### Business & UI Layer
- **`packages/services`**: Sits between UI and database. Orchestrates tasks like password hashing, image compression, LRU caching, and thumbnail prefetching.
- **`packages/ui`**: React Native Web-compatible UI components:
  - **Design System** ([theme/tokens.ts](./packages/ui/src/theme/tokens.ts)): Light and Dark theme mode palettes.
  - **Custom Drag & Drop** ([screens/board/drag](./packages/ui/src/screens/board/drag/)): Custom bounds-matching algorithm mapped to browser mouse events and native `PanResponder`.

---

## 3. Current Setup Status (Web & Mobile)

Yes, **everything is fully set up** for both applications:
- **Web App**: Configured with Webpack, babel loaders for TypeScript and decorator support, HTML generation, and a caching PWA service worker with workbox.
- **Mobile App**: Metro and Babel files are fully structured. Native dependencies (`react-native-fs`, `@bam.tech/react-native-image-resizer`, and SQLite adapters) are defined.
- **Testing environment**: Jest is ready to mock Native modules (like `AsyncStorage`) and run all 14 test suites in a headless Node environment.

### What is pending?
- **Cloud Sync**: The settings and schema are prepared for a sync protocol (e.g., `deleted_at` soft-deletes and `updated_at` triggers), but the sync engine itself is currently disabled/ignored as requested.
- **Other Phase 12 goals**: No functional core features are pending; the baseline offline app is complete.

---

## 4. Rough Edges Identified for Hardening

The current focus is on **strengthening existing files and straightening rough edges**. The following areas have been identified for potential improvement:

### [ ] A. TypeScript Type Improvements
- **Loose Types in UI Screens**: Some screens use `any` instead of proper typing.
  - *Example*: [BoardScreen.tsx:L57](./packages/ui/src/screens/board/BoardScreen.tsx#L57) wraps props in `any`:
    ```typescript
    function BoardContent({ lanes, cards, handleCardPress, ... }: any)
    ```
    *Harden*: Replace `any` with a strict interface representing the board state and callbacks.

### [ ] B. Drag-and-Drop Dimension Hardening
- **Hardcoded Offsets in Drag & Drop**:
  - [DraggableCardItem.tsx](./packages/ui/src/screens/board/drag/DraggableCardItem.tsx) uses constants like `LANE_HEADER_H = 44`.
  - [DropZone.tsx](./packages/ui/src/screens/board/drag/DropZone.tsx) uses `CARD_HEIGHT = 82` and `CARD_GAP = 8` to calculate drop line vertical offsets.
  - *Improvement*: Dynamic height measurements or fallback safety bounds for cases where cards grow larger (e.g., due to multiple lines of titles/tags or attachments) to prevent offset misalignment.

### [ ] C. Test Performance & Timeout Budgets
- **Bcrypt Work Factor during Test Runs**:
  - The [AuthService.ts](./packages/services/src/auth/AuthService.ts) runs password hashing with `BCRYPT_ROUNDS = 12`.
  - Hashing takes ~250ms per call. While secure for production, it slows down tests (forcing a `jest.setTimeout(15_000)` in [jest.setup.ts](./jest.setup.ts)).
  - *Improvement*: Allow overriding `rounds` dynamically (e.g., `BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 1 : 12`) to speed up testing execution.

### [x] D. Soft-Deleted Records Garbage Collection (Completed)
- **Database Bloat**:
  - Soft-deletes for projects and cards only toggle `deleted_at` timestamp.
  - *Improvement*: Provide an interface, background service, or "empty trash" operation in `SettingsService` or `ProjectService` to permanently prune soft-deleted models.

---

## 5. URL Routing Architecture (React Navigation)

The application uses **React Navigation** (`@react-navigation/native` + `@react-navigation/stack`) to provide a consistent navigation interface for both web and mobile platforms:

- **Stack Layout**: Under [AppNavigator.tsx](./packages/ui/src/screens/AppNavigator.tsx), the screen structure is defined via a standard Stack Navigator with three core routes:
  1. `Projects`: Displays the board list ([ProjectListScreen.tsx](./packages/ui/src/screens/projects/ProjectListScreen.tsx)).
  2. `Settings`: Displays user settings ([SettingsScreen.tsx](./packages/ui/src/screens/settings/SettingsScreen.tsx)).
  3. `Board`: Displays the selected kanban board ([BoardScreen.tsx](./packages/ui/src/screens/board/BoardScreen.tsx)).
- **Web Linking Configuration**: In the web entry point ([App.tsx](./apps/web/src/App.tsx)), the routes are mapped directly to URL path segments:
  - `/` or `/projects` ➔ `Projects`
  - `/settings` ➔ `Settings`
  - `/board/:projectId/card/:cardId?` ➔ `Board` (where `:cardId` is an optional trailing path parameter).
- **Direct Link Resolution**: The app parses direct links on startup. If a user accesses a card URL, the board screen will dynamically fetch the card metadata from WatermelonDB and overlay the `<CardDetailScreen>` modal on top of the board automatically. Closing the card modal updates the browser URL back to `/board/:projectId`.
