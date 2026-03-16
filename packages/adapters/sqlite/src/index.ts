/**
 * @kanban/adapters-sqlite
 *
 * WatermelonDB SQLite adapter for React Native (iOS + Android).
 *
 * This package is ONLY ever bundled into apps/mobile.
 * It imports from '@nozbe/watermelondb/adapters/sqlite' which relies on
 * native modules unavailable in the browser bundle.
 *
 * Performance settings:
 *   - jsi: true  — uses JSI bridge instead of async bridge (~3x faster queries)
 *   - WAL mode is enabled by default inside WatermelonDB's SQLite adapter
 */

import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { migrations } from '@kanban/database/src/schema/migrations';
import { schema } from '@kanban/database/src/schema';

/**
 * Creates the SQLite adapter for mobile.
 *
 * @param dbName - Filename on the device filesystem (default: 'kanban.db')
 * @returns Configured SQLiteAdapter ready for createDatabaseProvider()
 */
export function createSQLiteAdapter(dbName = 'kanban.db') {
  return new SQLiteAdapter({
    schema,
    migrations,
    dbName,

    // JSI mode: runs SQLite synchronously via JSI bindings.
    // Requires @nozbe/watermelondb >= 0.27 and Hermes enabled.
    jsi: true,

    onSetUpError: (error: Error) => {
      console.error('[SQLiteAdapter] Setup error — database may be corrupted:', error);
    },
  });
}
