/**
 * WatermelonDB schema definition
 *
 * This file is the authoritative definition of every table and column.
 * It drives both SQLite (mobile) and IndexedDB (web) via WatermelonDB's adapters.
 *
 * Rules:
 *   - All IDs are stored as strings (UUID v4). WatermelonDB provides its own `id`
 *     column automatically — we do NOT declare it in columns[].
 *   - Foreign keys are plain string columns (e.g. `user_id`). Relationships are
 *     declared on models, not in the schema.
 *   - Booleans are stored as `boolean` type.
 *   - Numbers (integers/floats) are `number` type.
 *   - Timestamps use WatermelonDB's built-in `date` type (stored as ms since epoch).
 *   - Nullable fields that might not be set at creation time are marked `isOptional: true`.
 *
 * Migration note:
 *   When modifying this schema in a later phase, always add a new migration in
 *   src/schema/migrations.ts rather than editing table definitions in place.
 *   WatermelonDB will refuse to open a database whose schema version doesn't match.
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // -------------------------------------------------------------------------
    // users
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'users',
      columns: [
        { name: 'username',      type: 'string' },
        { name: 'password_hash', type: 'string' },
        { name: 'created_at',   type: 'number' },
      ],
    }),

    // -------------------------------------------------------------------------
    // user_config
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'user_config',
      columns: [
        { name: 'user_id',           type: 'string', isIndexed: true },
        { name: 'theme_mode',        type: 'string' },          // 'light' | 'dark' | 'system'
        { name: 'font_family',       type: 'string' },
        { name: 'font_size',         type: 'number' },
        // JSON-serialized string[] — WatermelonDB has no array type
        { name: 'default_swimlanes', type: 'string' },
        { name: 'default_lane_colors', type: 'string' },
        { name: 'image_max_size_mb', type: 'number' },
        { name: 'markdown_default',  type: 'boolean' },
        { name: 'enable_sync',       type: 'boolean' },
        { name: 'sync_endpoint',     type: 'string', isOptional: true },
        { name: 'created_at',        type: 'number' },
        { name: 'updated_at',        type: 'number' },
      ],
    }),

    // -------------------------------------------------------------------------
    // projects
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'projects',
      columns: [
        { name: 'user_id',    type: 'string', isIndexed: true },
        { name: 'name',       type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },  // null = active
      ],
    }),

    // -------------------------------------------------------------------------
    // swimlanes
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'swimlanes',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'name',       type: 'string' },
        { name: 'color',      type: 'string' },
        { name: 'position',   type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // -------------------------------------------------------------------------
    // cards
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'cards',
      columns: [
        { name: 'lane_id',              type: 'string', isIndexed: true },
        { name: 'title',                type: 'string' },
        { name: 'description_markdown', type: 'string' },
        { name: 'color',                type: 'string', isOptional: true },
        { name: 'status_color',         type: 'string', isOptional: true },
        { name: 'due_date',             type: 'number', isOptional: true },  // ms epoch
        // Fractional index stored as string to preserve decimal precision
        { name: 'position_index',       type: 'string' },
        { name: 'created_at',           type: 'number' },
        { name: 'updated_at',           type: 'number' },
        { name: 'deleted_at',           type: 'number', isOptional: true },
      ],
    }),

    // -------------------------------------------------------------------------
    // tags
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'tags',
      columns: [
        { name: 'name',  type: 'string' },  // normalized (lowercase, no #)
        { name: 'color', type: 'string' },
      ],
    }),

    // -------------------------------------------------------------------------
    // card_tags  (join table)
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'card_tags',
      columns: [
        { name: 'card_id', type: 'string', isIndexed: true },
        { name: 'tag_id',  type: 'string', isIndexed: true },
      ],
    }),

    // -------------------------------------------------------------------------
    // attachments
    // -------------------------------------------------------------------------
    tableSchema({
      name: 'attachments',
      columns: [
        { name: 'card_id',       type: 'string', isIndexed: true },
        { name: 'type',          type: 'string' },   // AttachmentType enum value
        { name: 'filename',      type: 'string' },
        { name: 'mime_type',     type: 'string' },
        { name: 'size_bytes',    type: 'number' },
        { name: 'storage_ref',   type: 'string' },   // path (mobile) or IDB key (web)
        { name: 'thumbnail_ref', type: 'string', isOptional: true },
        { name: 'created_at',    type: 'number' },
      ],
    }),
  ],
});
