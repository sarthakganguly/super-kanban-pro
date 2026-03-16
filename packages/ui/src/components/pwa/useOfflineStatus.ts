/**
 * useOfflineStatus
 *
 * Web:    window online/offline events
 * Native: @react-native-community/netinfo (dynamic import, never bundled on web)
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(
    Platform.OS === 'web'
      ? (typeof navigator !== 'undefined' ? navigator.onLine : true)
      : true,
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      const onOnline  = () => setIsOnline(true);
      const onOffline = () => setIsOnline(false);
      window.addEventListener('online',  onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online',  onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    // Native — dynamic import keeps this out of the web bundle entirely
    let unsubscribe: (() => void) | undefined;
    import('@react-native-community/netinfo').then((NetInfo) => {
      void NetInfo.default.fetch().then((s) => setIsOnline(s.isConnected ?? true));
      unsubscribe = NetInfo.default.addEventListener((s) => setIsOnline(s.isConnected ?? true));
    }).catch(() => {});
    return () => unsubscribe?.();
  }, []);

  return { isOnline, isOffline: !isOnline };
}