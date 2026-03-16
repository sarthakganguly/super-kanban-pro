/**
 * useThumbnailPrefetch
 *
 * Pre-fetches thumbnails for a list of attachments, warming the LRU cache
 * before the user scrolls to those items.
 *
 * Strategy:
 *   - Called from BoardScreen after initial load completes
 *   - Processes attachments in batches of BATCH_SIZE with BATCH_DELAY_MS
 *     between batches so prefetch doesn't saturate the JS thread
 *   - Skips entries already in cache (no double-fetch)
 *   - Cancels on unmount (no setState on dead components)
 *   - Lower priority than user-initiated loads — uses setTimeout so user
 *     interactions always get the event loop first
 *
 * When to use:
 *   - After the board fully renders (isLoading = false)
 *   - When navigating to a card detail screen with multiple images
 *
 * Usage:
 *   useThumbnailPrefetch(attachments, loadDataURL);
 */

import { useEffect, useRef } from 'react';
import type { Attachment } from '@kanban/types';
import { ThumbnailCache } from './ThumbnailCache';

const BATCH_SIZE     = 3;    // Process 3 thumbnails per batch
const BATCH_DELAY_MS = 100;  // 100ms between batches

export function useThumbnailPrefetch(
  attachments: Attachment[],
  loadDataURL: (ref: string, mime: string) => Promise<string | null>,
): void {
  const cache      = ThumbnailCache.getInstance();
  const cancelRef  = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelRef.current = false;

    // Only prefetch images
    const imageAttachments = attachments.filter(
      (a) => a.type === 'image' && (a.thumbnailRef ?? a.storageRef),
    );

    if (imageAttachments.length === 0) return;

    // Filter out already-cached entries
    const toFetch = imageAttachments.filter(
      (a) => !cache.get(a.thumbnailRef ?? a.storageRef),
    );

    if (toFetch.length === 0) return;

    let batchStart = 0;

    function processBatch() {
      if (cancelRef.current) return;

      const batch = toFetch.slice(batchStart, batchStart + BATCH_SIZE);
      if (batch.length === 0) return;

      batchStart += BATCH_SIZE;

      // Fire all fetches in the batch concurrently
      Promise.all(
        batch.map(async (attachment) => {
          if (cancelRef.current) return;
          const ref = attachment.thumbnailRef ?? attachment.storageRef;

          // Skip if it was cached between batches (another component loaded it)
          if (cache.get(ref)) return;

          try {
            const dataUrl = await loadDataURL(ref, attachment.mimeType);
            if (dataUrl && !cancelRef.current) {
              cache.set(ref, dataUrl);
            }
          } catch {
            // Prefetch errors are non-fatal — silently skip
          }
        }),
      ).then(() => {
        if (!cancelRef.current && batchStart < toFetch.length) {
          timerRef.current = setTimeout(processBatch, BATCH_DELAY_MS);
        }
      });
    }

    // Start after a short delay so the initial render isn't competing
    timerRef.current = setTimeout(processBatch, BATCH_DELAY_MS * 2);

    return () => {
      cancelRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [attachments, cache, loadDataURL]);
}
