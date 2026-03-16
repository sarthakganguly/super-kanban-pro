/**
 * UserRepository
 *
 * All database operations for `users` and `user_config`.
 * Services call this repository — they never touch WatermelonDB directly.
 *
 * Design principle:
 *   Repositories speak WatermelonDB (Models, queries, prepareCreate/Update).
 *   Services speak domain types (@kanban/types interfaces).
 *   The repository converts between them.
 */

import { Database, Q } from '@nozbe/watermelondb';
import { now } from '@kanban/utils';
import { UserConfigModel } from '../models/UserConfigModel';
import { UserModel } from '../models/UserModel';

// Default user_config values applied on first creation
const DEFAULT_CONFIG = {
  themeMode: 'system',
  fontFamily: 'System',
  fontSize: 15,
  defaultSwimlanesJson: JSON.stringify(['To Do', 'In Progress', 'Done']),
  defaultLaneColorsJson: JSON.stringify(['#6B7280', '#3B82F6', '#10B981']),
  imageMaxSizeMb: 2,
  markdownDefault: true,
  enableSync: false,
  syncEndpoint: null,
} as const;

export class UserRepository {
  constructor(private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /** Returns the user matching the given username, or null if not found */
  async findByUsername(username: string): Promise<UserModel | null> {
    const results = await this.db
      .get<UserModel>('users')
      .query(Q.where('username', Q.eq(username)))
      .fetch();

    return results[0] ?? null;
  }

  /** Returns the user matching the given id, or null */
  async findById(id: string): Promise<UserModel | null> {
    try {
      return await this.db.get<UserModel>('users').find(id);
    } catch {
      return null;
    }
  }

  /** Returns all users (only ever 1 in local mode, but supports future multi-user) */
  async findAll(): Promise<UserModel[]> {
    return this.db.get<UserModel>('users').query().fetch();
  }

  /** Returns the config record for a user, or null if not yet created */
  async findConfigByUserId(userId: string): Promise<UserConfigModel | null> {
    const results = await this.db
      .get<UserConfigModel>('user_config')
      .query(Q.where('user_id', Q.eq(userId)))
      .fetch();

    return results[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Creates a new user + default user_config in a single atomic transaction.
   * Returns the created UserModel.
   */
  async create(
    username: string,
    passwordHash: string,
  ): Promise<UserModel> {
    const timestamp = Date.now();

    return this.db.write(async () => {
      // Create user record
      const user = await this.db.get<UserModel>('users').create((record) => {
        record.username     = username;
        record.passwordHash = passwordHash;
        // WatermelonDB @date decorator stores as Date object but underlying
        // column is a number — we write the raw number via _raw
        (record._raw as Record<string, unknown>)['created_at'] = timestamp;
      });

      // Create default config for this user
      await this.db.get<UserConfigModel>('user_config').create((record) => {
        record.userId              = user.id;
        record.themeMode           = DEFAULT_CONFIG.themeMode;
        record.fontFamily          = DEFAULT_CONFIG.fontFamily;
        record.fontSize            = DEFAULT_CONFIG.fontSize;
        record.defaultSwimlanesJson  = DEFAULT_CONFIG.defaultSwimlanesJson;
        record.defaultLaneColorsJson = DEFAULT_CONFIG.defaultLaneColorsJson;
        record.imageMaxSizeMb      = DEFAULT_CONFIG.imageMaxSizeMb;
        record.markdownDefault     = DEFAULT_CONFIG.markdownDefault;
        record.enableSync          = DEFAULT_CONFIG.enableSync;
        record.syncEndpoint        = DEFAULT_CONFIG.syncEndpoint;
        (record._raw as Record<string, unknown>)['created_at'] = timestamp;
        (record._raw as Record<string, unknown>)['updated_at'] = timestamp;
      });

      return user;
    });
  }

  /**
   * Updates a subset of user_config fields.
   * Only provided fields are changed; others remain as-is.
   */
  async updateConfig(
    configId: string,
    patch: Partial<{
      themeMode: string;
      fontFamily: string;
      fontSize: number;
      defaultSwimlanesJson: string;
      defaultLaneColorsJson: string;
      imageMaxSizeMb: number;
      markdownDefault: boolean;
      enableSync: boolean;
      syncEndpoint: string | null;
    }>,
  ): Promise<void> {
    const config = await this.db
      .get<UserConfigModel>('user_config')
      .find(configId);

    await this.db.write(async () => {
      await config.update((record) => {
        if (patch.themeMode            !== undefined) record.themeMode           = patch.themeMode;
        if (patch.fontFamily           !== undefined) record.fontFamily          = patch.fontFamily;
        if (patch.fontSize             !== undefined) record.fontSize            = patch.fontSize;
        if (patch.defaultSwimlanesJson !== undefined) record.defaultSwimlanesJson  = patch.defaultSwimlanesJson;
        if (patch.defaultLaneColorsJson !== undefined) record.defaultLaneColorsJson = patch.defaultLaneColorsJson;
        if (patch.imageMaxSizeMb       !== undefined) record.imageMaxSizeMb     = patch.imageMaxSizeMb;
        if (patch.markdownDefault      !== undefined) record.markdownDefault     = patch.markdownDefault;
        if (patch.enableSync           !== undefined) record.enableSync          = patch.enableSync;
        if (patch.syncEndpoint         !== undefined) record.syncEndpoint        = patch.syncEndpoint;
        (record._raw as Record<string, unknown>)['updated_at'] = Date.now();
      });
    });
  }

  /** Hard-deletes a user and their config. Use with caution. */
  async delete(userId: string): Promise<void> {
    const user   = await this.findById(userId);
    const config = await this.findConfigByUserId(userId);

    if (!user) return;

    await this.db.write(async () => {
      const toDelete = [user.prepareDestroyPermanently()];
      if (config) toDelete.push(config.prepareDestroyPermanently());
      await this.db.batch(...toDelete);
    });
  }
}
