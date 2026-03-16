/**
 * CardModel
 *
 * The core entity of the Kanban board.
 *
 * Key design choices:
 *   - `positionIndex` is stored as a string to preserve decimal precision.
 *     Floating-point numbers lose precision after ~15 digits; strings don't.
 *   - `descriptionMarkdown` can be large (thousands of characters). WatermelonDB
 *     loads it lazily — it won't be fetched until accessed.
 *   - `deletedAt` enables soft deletion. Repositories always filter deleted_at
 *     IS NULL in normal queries.
 *   - `dueDate` stored as number (ms epoch) for efficient date comparisons.
 */

import { Model } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import type { AttachmentModel } from './AttachmentModel';
import type { CardTagModel } from './CardTagModel';
import type { SwimlaneModel } from './SwimlaneModel';

export class CardModel extends Model {
  static table = 'cards';

  static associations = {
    swimlanes:  { type: 'belongs_to' as const, key: 'lane_id' },
    card_tags:  { type: 'has_many'   as const, foreignKey: 'card_id' },
    attachments:{ type: 'has_many'   as const, foreignKey: 'card_id' },
  };

  @field('lane_id')
  laneId!: string;

  @field('title')
  title!: string;

  @field('description_markdown')
  descriptionMarkdown!: string;

  /** Optional background color for the card */
  @field('color')
  color!: string | null;

  /** Optional status indicator dot color */
  @field('status_color')
  statusColor!: string | null;

  /** Optional due date stored as ms epoch */
  @date('due_date')
  dueDate!: Date | null;

  /**
   * Fractional index string — controls ordering within a lane.
   * Example values: "1", "1.5", "1.75", "2"
   * Use @kanban/utils computeFractionalIndex() to generate new values.
   */
  @field('position_index')
  positionIndex!: string;

  @readonly @date('created_at')
  createdAt!: Date;

  @date('updated_at')
  updatedAt!: Date;

  /** null = active; set = soft-deleted */
  @date('deleted_at')
  deletedAt!: Date | null;

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  get isOverdue(): boolean {
    return this.dueDate !== null && this.dueDate < new Date();
  }

  @relation('swimlanes', 'lane_id')
  swimlane!: SwimlaneModel;

  @children('card_tags')
  cardTags!: CardTagModel[];

  @children('attachments')
  attachments!: AttachmentModel[];
}
