/**
 * useThumbnail
 *
 * Loads a thumbnail data: URI, checking the LRU cache first.
 *
 * States:
 *   loading  — initial state while checking cache / fetching from storage
 *   hit      — uri is the cached or freshly loaded data: URI
 *   miss     — the storage reference returned no data (deleted/corrupt)
 *   error    — something threw during loading
 *
 * Behaviour:
 *   - On mount, synchronously checks ThumbnailCache.get(storageRef)
 *   - If found (cache hit): sets uri immediately, no async work
 *   - If not found: calls loadDataURL asynchronously, then caches the result
 *   - On storageRef change: clears uri and re-loads (handles re-renders)
 *
 * The synchronous cache check means a cached thumbnail renders in the
 * same frame as the component — zero flicker on scroll-back.
 *
 * Usage:
 *   const { uri, isLoading } = useThumbnail(attachment.thumbnailRef, attachment.mimeType, loadDataURL);
 *
 *   return isLoading
 *     ? <ActivityIndicator />
 *     : uri
 *     ? <Image source={{ uri }} />
 *     : <PlaceholderIcon />;
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThumbnailCache } from './ThumbnailCache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThumbnailState = 'loading' | 'hit' | 'miss' | 'error';

export interface UseThumbnailReturn {
  uri:       string | null;
  state:     ThumbnailState;
  isLoading: boolean;
  /** Call to manually invalidate and reload (after thumbnail regeneration) */
  reload:    () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useThumbnail(
  storageRef:  string | null,
  mimeType:    string,
  loadDataURL: (ref: string, mime: string) => Promise<string | null>,
): UseThumbnailReturn {
  const cache = ThumbnailCache.getInstance();

  // Derive initial state synchronously from cache
  const cachedUri = storageRef ? cache.getTracked(storageRef) : null;

  const [uri,   setUri]   = useState<string | null>(cachedUri);
  const [state, setState] = useState<ThumbnailState>(
    storageRef === null  ? 'miss'
    : cachedUri !== null ? 'hit'
    :                      'loading',
  );

  // Track the current storageRef to detect changes
  const prevRefRef = useRef<string | null>(storageRef);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(
    async (ref: string) => {
      // Synchronous cache check first
      const cached = cache.getTracked(ref);
      if (cached) {
        if (mountedRef.current) {
          setUri(cached);
          setState('hit');
        }
        return;
      }

      // Async load
      setState('loading');
      setUri(null);

      try {
        const dataUrl = await loadDataURL(ref, mimeType);

        if (!mountedRef.current) return;

        if (dataUrl) {
          cache.set(ref, dataUrl);
          setUri(dataUrl);
          setState('hit');
        } else {
          setState('miss');
        }
      } catch (err) {
        if (mountedRef.current) {
          console.warn('[useThumbnail] load error:', err);
          setState('error');
        }
      }
    },
    [cache, loadDataURL, mimeType],
  );

  useEffect(() => {
    if (!storageRef) {
      setUri(null);
      setState('miss');
      return;
    }

    // If the ref changed (e.g. attachment replaced), reload
    if (storageRef !== prevRefRef.current) {
      prevRefRef.current = storageRef;
    }

    // Only reload if not already in cache
    const cached = cache.get(storageRef);
    if (cached) {
      setUri(cached);
      setState('hit');
    } else {
      void load(storageRef);
    }
  }, [storageRef, cache, load]);

  const reload = useCallback(() => {
    if (!storageRef) return;
    // Bust the cache for this ref and re-load
    cache.delete(storageRef);
    void load(storageRef);
  }, [storageRef, cache, load]);

  return {
    uri,
    state,
    isLoading: state === 'loading',
    reload,
  };
}
