/**
 * Service worker registration
 *
 * Registers the Workbox service worker and manages its lifecycle events.
 *
 * Events handled:
 *   onUpdate(registration) — called when a new SW version is waiting.
 *     The app uses this to show the UpdatePrompt banner.
 *
 *   onSuccess()            — called after the SW is first installed
 *     and all precache assets are cached. Could show an "offline ready"
 *     toast, but we don't — the user doesn't need to know.
 *
 * skipWaiting(registration) — sends SKIP_WAITING to the waiting SW,
 *     causing it to activate and all tabs to reload.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SWRegistrationOptions {
  /** Called when a new service worker is waiting to activate */
  onUpdate?:  (registration: ServiceWorkerRegistration) => void;
  /** Called when the service worker is first installed successfully */
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  /** Called when registration fails */
  onError?:   (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

/**
 * Registers the service worker at /service-worker.js.
 * Safe to call in development — only registers if the browser supports SW
 * and we're in a production build.
 *
 * @param options - Lifecycle callbacks
 */
export async function registerServiceWorker(
  options: SWRegistrationOptions = {},
): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return; // Browser doesn't support SW (unlikely in 2024, but safe guard)
  }

  // Only register in production — in dev, the SW would cache stale HMR assets
  if (process.env.NODE_ENV !== 'production') {
    console.info('[SW] Skipping registration in development mode');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      '/service-worker.js',
      {
        // 'all' scope is the default; explicit here for clarity
        scope: '/',
        // Use the module type so ESM imports work in the SW source
        // (Workbox bundles handle this at build time)
      },
    );

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state !== 'installed') return;

        if (navigator.serviceWorker.controller) {
          // Existing SW controlled the page — this is an update
          console.info('[SW] New service worker installed, waiting to activate.');
          options.onUpdate?.(registration);
        } else {
          // First-time install — all assets now precached
          console.info('[SW] Content cached for offline use.');
          options.onSuccess?.(registration);
        }
      });
    });
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    options.onError?.(error as Error);
  }
}

/**
 * Tells the waiting service worker to skip waiting and activate.
 * After calling this, the page will be controlled by the new SW,
 * typically triggering a reload.
 *
 * @param registration - The registration containing the waiting worker
 */
export function skipWaiting(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Unregisters all service workers.
 * Useful for recovery when a bad SW is deployed.
 */
export async function unregisterAll(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
}

// ---------------------------------------------------------------------------
// Online / offline status
// ---------------------------------------------------------------------------

/**
 * Returns a cleanup function that listens for online/offline events.
 *
 * @param onOnline  - Called when the browser goes online
 * @param onOffline - Called when the browser goes offline
 */
export function watchNetworkStatus(
  onOnline:  () => void,
  onOffline: () => void,
): () => void {
  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online',  onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
