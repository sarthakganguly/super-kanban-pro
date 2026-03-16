/**
 * UserModel
 *
 * WatermelonDB model for the `users` table.
 *
 * Architecture note:
 *   WatermelonDB uses decorators to declare columns and relationships.
 *   The `@field` decorator maps a JS property to a database column.
 *   The `@readonly @date` decorator wraps a number column as a JS Date.
 *   The `@relation` decorator declares a has-one or belongs-to association.
 *
 *   NEVER read passwordHash outside of the auth service.
 *   The UI layer should only ever see { id, username, createdAt }.
 */

import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

export class UserModel extends Model {
  static table = 'users';

  static associations = {
    user_config: { type: 'has_many' as const, foreignKey: 'user_id' },
    projects:    { type: 'has_many' as const, foreignKey: 'user_id' },
  };

  @field('username')
  username!: string;

  /**
   * bcrypt hash. Access is intentionally verbose to discourage casual reads.
   * Only AuthService should touch this field.
   */
  @field('password_hash')
  passwordHash!: string;

  @readonly @date('created_at')
  createdAt!: Date;
}
