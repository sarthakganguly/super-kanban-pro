/**
 * CardTagModel
 *
 * Join table linking cards to their tags (many-to-many).
 * WatermelonDB requires all tables to have an `id` column,
 * so this join table does have an auto-generated UUID id.
 */

import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type { CardModel } from './CardModel';
import type { TagModel } from './TagModel';

export class CardTagModel extends Model {
  static table = 'card_tags';

  static associations = {
    cards: { type: 'belongs_to' as const, key: 'card_id' },
    tags:  { type: 'belongs_to' as const, key: 'tag_id' },
  };

  @field('card_id')
  cardId!: string;

  @field('tag_id')
  tagId!: string;

  @relation('cards', 'card_id')
  card!: CardModel;

  @relation('tags', 'tag_id')
  tag!: TagModel;
}
