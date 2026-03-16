/**
 * TagModel
 *
 * A hashtag that can be applied to many cards.
 * Names are stored normalized (lowercase, no leading #).
 */

import { Model } from '@nozbe/watermelondb';
import { children, field } from '@nozbe/watermelondb/decorators';
import type { CardTagModel } from './CardTagModel';

export class TagModel extends Model {
  static table = 'tags';

  static associations = {
    card_tags: { type: 'has_many' as const, foreignKey: 'tag_id' },
  };

  /** Normalized name: lowercase, no # prefix */
  @field('name')
  name!: string;

  /** Display color for the tag pill */
  @field('color')
  color!: string;

  @children('card_tags')
  cardTags!: CardTagModel[];
}
