/**
 * ProjectModel
 *
 * Soft-deletable. A project with deletedAt set is considered archived —
 * all queries should filter `deleted_at IS NULL` unless specifically
 * fetching the trash.
 */

import { Model } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import type { SwimlaneModel } from './SwimlaneModel';
import type { UserModel } from './UserModel';

export class ProjectModel extends Model {
  static table = 'projects';

  static associations = {
    users:     { type: 'belongs_to' as const, key: 'user_id' },
    swimlanes: { type: 'has_many'   as const, foreignKey: 'project_id' },
  };

  @field('user_id')
  userId!: string;

  @field('name')
  name!: string;

  @readonly @date('created_at')
  createdAt!: Date;

  @date('updated_at')
  updatedAt!: Date;

  /** null = active, set = soft-deleted */
  @date('deleted_at')
  deletedAt!: Date | null;

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  @relation('users', 'user_id')
  user!: UserModel;

  @children('swimlanes')
  swimlanes!: SwimlaneModel[];
}
