/**
 * Service Worker — Kanban PWA
 *
 * Built with Workbox. This file is processed by InjectManifest from
 * workbox-webpack-plugin which injects the precache manifest at build time.
 *
 * Caching strategies:
 *
 *   App shell (HTML, JS, CSS bundles)
 *     → StaleWhileRevalidate
 *     Serves cached version instantly, fetches update in background.
 *     Good for: app shell that changes on deploys.
 *
 *   Static assets (fonts, icons, images in /public)
 *     → CacheFirst with 1-year expiry
 *     These are content-hashed; if they change, the URL changes.
 *     Good for: fonts, icons, images that don't change.
 *
 *   Google Fonts (if used)
 *     → StaleWhileRevalidate for stylesheets, CacheFirst for font files
 *
 *   API calls (future sync endpoint)
 *     → NetworkFirst with fallback
 *     Try network first, fall back to cache if offline.
 *     Good for: sync API calls where freshness matters.
 *
 * Offline behaviour:
 *   - All app shell assets are precached on install.
 *   - All user data is in IndexedDB (managed by WatermelonDB) — not in the
 *     service worker cache. This is correct: the SW only caches code assets.
 *   - When fully offline, the app loads from cache and reads/writes IndexedDB
 *     normally. The user won't notice they're offline until they try to sync.
 *
 * Update flow:
 *   1. New SW detected → fires 'waiting' event
 *   2. App shows UpdatePrompt banner
 *   3. User taps "Update" → postMessage SKIP_WAITING
 *   4. SW activates → clients.claim() → app reloads
 */

/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// Take control of all clients immediately on activation
clientsClaim();

// Clean up caches from previous service worker versions
cleanupOutdatedCaches();

// ---------------------------------------------------------------------------
// Precaching — injected by InjectManifest at build time
// ---------------------------------------------------------------------------

// __WB_MANIFEST is replaced by Workbox with the list of assets to precache.
// This includes: main.js, vendors.js, main.css, and all content-hashed assets.
precacheAndRoute(self.__WB_MANIFEST);

// ---------------------------------------------------------------------------
// Navigation: always serve index.html for SPA routes
// ---------------------------------------------------------------------------

// Any navigation request (URL that isn't a resource file) returns index.html.
// This enables deep-linking — refreshing /board/project-123 returns the app.
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  // Exclude /api/* routes from the navigation handler
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// ---------------------------------------------------------------------------
// Runtime caching: static assets (fonts, icons, images)
// ---------------------------------------------------------------------------

registerRoute(
  // Match any request for static assets with a content hash in the filename
  ({ request }) =>
    request.destination === 'font' ||
    request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries:     100,
        maxAgeSeconds:  365 * 24 * 60 * 60, // 1 year
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// ---------------------------------------------------------------------------
// Runtime caching: JS/CSS bundles not in precache
// (Catches dynamically imported chunks)
// ---------------------------------------------------------------------------

registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'js-css-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
);

// ---------------------------------------------------------------------------
// Runtime caching: future sync API (NetworkFirst)
// ---------------------------------------------------------------------------

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  }),
);

// ---------------------------------------------------------------------------
// Skip-waiting message handler
// ---------------------------------------------------------------------------

// When the app sends SKIP_WAITING, this SW takes over immediately.
// The UpdatePrompt component sends this when the user taps "Update now".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
