/**
 * UserConfigModel
 *
 * Stores the single per-user configuration record.
 * Arrays (defaultSwimlanes, defaultLaneColors) are JSON-serialized strings
 * because WatermelonDB has no native array column type.
 */

import { Model } from '@nozbe/watermelondb';
import {
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import type { UserModel } from './UserModel';

export class UserConfigModel extends Model {
  static table = 'user_config';

  static associations = {
    users: { type: 'belongs_to' as const, key: 'user_id' },
  };

  @field('user_id')
  userId!: string;

  @field('theme_mode')
  themeMode!: string;  // 'light' | 'dark' | 'system'

  @field('font_family')
  fontFamily!: string;

  @field('font_size')
  fontSize!: number;

  /** JSON string — deserialize with JSON.parse before use */
  @field('default_swimlanes')
  defaultSwimlanesJson!: string;

  /** JSON string — deserialize with JSON.parse before use */
  @field('default_lane_colors')
  defaultLaneColorsJson!: string;

  @field('image_max_size_mb')
  imageMaxSizeMb!: number;

  @field('markdown_default')
  markdownDefault!: boolean;

  @field('enable_sync')
  enableSync!: boolean;

  @field('sync_endpoint')
  syncEndpoint!: string | null;

  @readonly @date('created_at')
  createdAt!: Date;

  @date('updated_at')
  updatedAt!: Date;

  // Convenience getters that handle JSON deserialization
  get defaultSwimlanes(): string[] {
    try {
      return JSON.parse(this.defaultSwimlanesJson) as string[];
    } catch {
      return ['To Do', 'In Progress', 'Done'];
    }
  }

  get defaultLaneColors(): string[] {
    try {
      return JSON.parse(this.defaultLaneColorsJson) as string[];
    } catch {
      return ['#6B7280', '#3B82F6', '#10B981'];
    }
  }

  @relation('users', 'user_id')
  user!: UserModel;
}
