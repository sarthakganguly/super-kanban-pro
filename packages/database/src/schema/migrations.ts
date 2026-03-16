/**
 * WatermelonDB migrations
 *
 * Migrations are an append-only log. Never edit existing migration steps —
 * always add new ones at the bottom with an incremented `toVersion`.
 *
 * When to add a migration:
 *   Any change to packages/database/src/schema/index.ts requires a matching
 *   migration here. Bump `schema.version` in schema/index.ts by 1 at the same time.
 *
 * Current version: 1 (initial schema — no migration steps needed, WatermelonDB
 * creates all tables from scratch on first install).
 */

import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Phase 2: Initial schema — no migration steps.
    // WatermelonDB auto-creates all tables when installing into an empty database.
    //
    // Example of a future migration (Phase N):
    // {
    //   toVersion: 2,
    //   steps: [
    //     addColumns({
    //       table: 'cards',
    //       columns: [{ name: 'archived_at', type: 'number', isOptional: true }],
    //     }),
    //   ],
    // },
  ],
});
