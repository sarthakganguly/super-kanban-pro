/**
 * SwimlaneModel
 *
 * Represents a column on the Kanban board (e.g. "To Do", "In Progress", "Done").
 * `position` is an integer used to order lanes left-to-right. Integer ordering
 * is fine for lanes because there are very few of them (typically 3–10).
 * Cards use fractional indexing because they can number in the thousands.
 */

import { Model } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import type { CardModel } from './CardModel';
import type { ProjectModel } from './ProjectModel';

export class SwimlaneModel extends Model {
  static table = 'swimlanes';

  static associations = {
    projects: { type: 'belongs_to' as const, key: 'project_id' },
    cards:    { type: 'has_many'   as const, foreignKey: 'lane_id' },
  };

  @field('project_id')
  projectId!: string;

  @field('name')
  name!: string;

  /** Hex color string, e.g. "#3B82F6" */
  @field('color')
  color!: string;

  /** Integer — left-to-right display order */
  @field('position')
  position!: number;

  @readonly @date('created_at')
  createdAt!: Date;

  @date('updated_at')
  updatedAt!: Date;

  @relation('projects', 'project_id')
  project!: ProjectModel;

  @children('cards')
  cards!: CardModel[];
}
