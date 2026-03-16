/**
 * @kanban/adapters-indexeddb
 *
 * WatermelonDB LokiJS adapter for web (React Native Web).
 *
 * This package is ONLY ever bundled into apps/web — never apps/mobile.
 *
 * How WatermelonDB stores data on web:
 *   WatermelonDB uses a LokiJS adapter that persists its in-memory store
 *   to IndexedDB via the LokiJS IndexedDB adapter. This gives us:
 *     - In-memory speed for all reads (LokiJS stores a full copy in RAM)
 *     - IndexedDB persistence across page reloads
 *     - The same WatermelonDB query API as SQLite on mobile
 *
 * Performance note:
 *   LokiJS loads the entire database into memory on startup. For 5,000 cards
 *   this is well within browser memory limits (typically < 10 MB of JSON).
 *   If data grows beyond ~50 MB, consider migrating to the IndexedDB adapter
 *   directly (available in WatermelonDB's adapters/indexeddb — still experimental).
 */

import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { migrations, schema } from '@kanban/database';
 
export function createIndexedDBAdapter(dbName = 'kanban') {
  return new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    dbName,
    onSetUpError: (error: Error) => {
      console.error('[IndexedDBAdapter] Setup error:', error);
    },
    onQuotaExceededError: (error: Error) => {
      console.warn('[IndexedDBAdapter] Storage quota exceeded:', error);
    },
  });
}
 