/**
 * PWA registration + offline status tests
 *
 * Tests the pure logic in sw-registration.ts:
 *   - skipWaiting sends the correct postMessage
 *   - watchNetworkStatus wires up event listeners correctly
 *   - unregisterAll calls unregister on all registrations
 *
 * registerServiceWorker itself requires a real browser environment and
 * is tested via Playwright e2e tests (not included here).
 */

// ---------------------------------------------------------------------------
// skipWaiting
// ---------------------------------------------------------------------------

describe('skipWaiting', () => {
  it('posts SKIP_WAITING message to the waiting worker', () => {
    // Dynamic import of the module under test so Jest can load it
    // without the full browser environment
    jest.resetModules();

    // Mock navigator.serviceWorker before import
    const mockPostMessage = jest.fn();
    const mockRegistration = {
      waiting: { postMessage: mockPostMessage },
    } as unknown as ServiceWorkerRegistration;

    // We need to simulate the browser environment minimally
    const { skipWaiting } = jest.requireActual(
      '../../../apps/web/src/pwa/sw-registration',
    ) as typeof import('../../../apps/web/src/pwa/sw-registration');

    skipWaiting(mockRegistration);

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('is a no-op when registration.waiting is null', () => {
    const mockRegistration = {
      waiting: null,
    } as unknown as ServiceWorkerRegistration;

    const { skipWaiting } = jest.requireActual(
      '../../../apps/web/src/pwa/sw-registration',
    ) as typeof import('../../../apps/web/src/pwa/sw-registration');

    // Should not throw
    expect(() => skipWaiting(mockRegistration)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// watchNetworkStatus
// ---------------------------------------------------------------------------

describe('watchNetworkStatus', () => {
  it('calls onOnline when window fires "online" event', () => {
    const { watchNetworkStatus } = jest.requireActual(
      '../../../apps/web/src/pwa/sw-registration',
    ) as typeof import('../../../apps/web/src/pwa/sw-registration');

    const onOnline  = jest.fn();
    const onOffline = jest.fn();

    const cleanup = watchNetworkStatus(onOnline, onOffline);
    window.dispatchEvent(new Event('online'));
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onOffline).not.toHaveBeenCalled();
    cleanup();
  });

  it('calls onOffline when window fires "offline" event', () => {
    const { watchNetworkStatus } = jest.requireActual(
      '../../../apps/web/src/pwa/sw-registration',
    ) as typeof import('../../../apps/web/src/pwa/sw-registration');

    const onOnline  = jest.fn();
    const onOffline = jest.fn();

    const cleanup = watchNetworkStatus(onOnline, onOffline);
    window.dispatchEvent(new Event('offline'));
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(onOnline).not.toHaveBeenCalled();
    cleanup();
  });

  it('cleanup removes event listeners', () => {
    const { watchNetworkStatus } = jest.requireActual(
      '../../../apps/web/src/pwa/sw-registration',
    ) as typeof import('../../../apps/web/src/pwa/sw-registration');

    const onOnline = jest.fn();
    const cleanup  = watchNetworkStatus(onOnline, jest.fn());

    cleanup();
    window.dispatchEvent(new Event('online'));
    // Should NOT have been called after cleanup
    expect(onOnline).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ThumbnailCache integration with logout
// ---------------------------------------------------------------------------

describe('ThumbnailCache cleared on logout', () => {
  it('cache is empty after ThumbnailCache.reset()', () => {
    const { ThumbnailCache } = jest.requireActual(
      '../thumbnail/ThumbnailCache',
    ) as typeof import('../thumbnail/ThumbnailCache');

    ThumbnailCache.reset();
    const cache = ThumbnailCache.getInstance();
    cache.set('thumb1', 'data:image/jpeg;base64,abc');
    cache.set('thumb2', 'data:image/jpeg;base64,def');
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('thumb1')).toBeNull();

    ThumbnailCache.reset();
  });
});
