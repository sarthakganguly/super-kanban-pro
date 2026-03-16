/**
 * apps/web — src/index.tsx
 *
 * Browser entry point — Phase 12 update.
 * Adds service worker registration and the PWA update/offline UI.
 */

import React, { useState } from 'react';
import { AppRegistry } from 'react-native';
import { registerServiceWorker } from './pwa/sw-registration';

// ---------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------

let swRegistration: ServiceWorkerRegistration | null = null;
let swUpdateCallback: ((reg: ServiceWorkerRegistration) => void) | null = null;

registerServiceWorker({
  onUpdate: (registration) => {
    swRegistration = registration;
    // Notify the React tree via a callback set after mount
    swUpdateCallback?.(registration);
    console.info('[PWA] Update available');
  },
  onSuccess: () => {
    console.info('[PWA] Content cached for offline use');
  },
  onError: (err) => {
    console.warn('[PWA] Service worker registration failed:', err);
  },
});

// ---------------------------------------------------------------------------
// App root with PWA components injected
// ---------------------------------------------------------------------------

// Lazy import so the main app chunk can load before these components
const App          = require('./App').default;
const OfflineBanner = require('@kanban/ui').OfflineBanner;
const UpdatePrompt  = require('@kanban/ui').UpdatePrompt;

function AppWithPWA() {
  const [updateReg, setUpdateReg] = useState<ServiceWorkerRegistration | null>(
    swRegistration,
  );

  // Register callback so SW events after mount reach this component
  React.useEffect(() => {
    swUpdateCallback = setUpdateReg;
    return () => { swUpdateCallback = null; };
  }, []);

  return (
    <>
      <OfflineBanner />
      <App />
      <UpdatePrompt registration={updateReg} />
    </>
  );
}

AppRegistry.registerComponent('KanbanApp', () => AppWithPWA);
AppRegistry.runApplication('KanbanApp', {
  rootTag: document.getElementById('root'),
});
