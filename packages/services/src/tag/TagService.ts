/**
 * TagService
 *
 * Manages the hashtag system.
 *
 * Tag lifecycle:
 *   1. User types #featur in a card description
 *   2. TagService.autocomplete('featur') returns matching tags
 *   3. User selects or creates "feature"
 *   4. TagService.attachTag(cardId, 'feature') creates the association
 *
 * Tag normalization:
 *   All tag names are stored lowercase without the # prefix.
 *   "#Feature" and "feature" resolve to the same tag.
 *
 * Tag colors:
 *   Assigned from a predefined palette, cycling through on creation.
 *   Users can change colors in the Settings screen (Phase 9).
 */

import { Database, Q } from '@nozbe/watermelondb';
import { normalizeTag } from '@kanban/utils';
import { CardTagModel } from '@kanban/database/src/models/CardTagModel';
import { TagModel } from '@kanban/database/src/models/TagModel';

// ---------------------------------------------------------------------------
// Tag color palette — cycles on creation
// ---------------------------------------------------------------------------

const TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export interface TagSummary {
  id:    string;
  name:  string;
  color: string;
}

export class TagService {
  constructor(private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Autocomplete
  // ---------------------------------------------------------------------------

  /**
   * Returns tags whose names start with the given prefix (case-insensitive).
   * Used to show suggestions as the user types a hashtag.
   *
   * @param prefix - The text typed after '#', e.g. "featur"
   * @param limit  - Max results to return (default 8)
   */
  async autocomplete(prefix: string, limit = 8): Promise<TagSummary[]> {
    const normalized = normalizeTag(prefix);
    if (!normalized) return [];

    // WatermelonDB doesn't support LIKE natively, so we fetch all tags
    // and filter in memory. With typical tag counts (<200) this is fast.
    const all = await this.db.get<TagModel>('tags').query().fetch();

    return all
      .filter((t) => t.name.startsWith(normalized))
      .slice(0, limit)
      .map((t) => ({ id: t.id, name: t.name, color: t.color }));
  }

  // ---------------------------------------------------------------------------
  // Get tags for a card
  // ---------------------------------------------------------------------------

  async getTagsForCard(cardId: string): Promise<TagSummary[]> {
    const cardTags = await this.db
      .get<CardTagModel>('card_tags')
      .query(Q.where('card_id', Q.eq(cardId)))
      .fetch();

    const tagIds = cardTags.map((ct) => ct.tagId);
    if (tagIds.length === 0) return [];

    const tags = await this.db
      .get<TagModel>('tags')
      .query(Q.where('id', Q.oneOf(tagIds)))
      .fetch();

    return tags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  }

  // ---------------------------------------------------------------------------
  // Attach / detach tags
  // ---------------------------------------------------------------------------

  /**
   * Ensures a tag with the given name exists and attaches it to the card.
   * If the tag doesn't exist yet, it's created with an auto-assigned color.
   * If already attached, this is a no-op.
   */
  async attachTag(cardId: string, rawName: string): Promise<TagSummary> {
    const name = normalizeTag(rawName);
    if (!name) throw new Error('Tag name cannot be empty.');

    return this.db.write(async () => {
      // Find or create the tag
      let tagModel = await this.findTagByName(name);

      if (!tagModel) {
        const count = await this.db.get<TagModel>('tags').query().fetchCount();
        const color = TAG_COLORS[count % TAG_COLORS.length] ?? TAG_COLORS[0]!;

        tagModel = await this.db.get<TagModel>('tags').create((record) => {
          record.name  = name;
          record.color = color;
        });
      }

      // Check if association already exists
      const existing = await this.db
        .get<CardTagModel>('card_tags')
        .query(
          Q.and(
            Q.where('card_id', Q.eq(cardId)),
            Q.where('tag_id',  Q.eq(tagModel.id)),
          ),
        )
        .fetchCount();

      if (existing === 0) {
        await this.db.get<CardTagModel>('card_tags').create((record) => {
          record.cardId = cardId;
          record.tagId  = tagModel!.id;
        });
      }

      return { id: tagModel.id, name: tagModel.name, color: tagModel.color };
    });
  }

  /**
   * Removes the association between a card and a tag.
   * Does NOT delete the tag itself (other cards may use it).
   */
  async detachTag(cardId: string, tagId: string): Promise<void> {
    const associations = await this.db
      .get<CardTagModel>('card_tags')
      .query(
        Q.and(
          Q.where('card_id', Q.eq(cardId)),
          Q.where('tag_id',  Q.eq(tagId)),
        ),
      )
      .fetch();

    if (associations.length === 0) return;

    await this.db.write(async () => {
      await this.db.batch(
        ...associations.map((a) => a.prepareDestroyPermanently()),
      );
    });
  }

  /**
   * Syncs a card's tags to exactly match the given name list.
   * Attaches any missing tags, detaches any extra ones.
   * Called after parsing hashtags from the description on save.
   */
  async syncCardTags(cardId: string, tagNames: string[]): Promise<void> {
    const normalized = tagNames.map(normalizeTag).filter(Boolean);

    const current = await this.getTagsForCard(cardId);
    const currentNames = new Set(current.map((t) => t.name));
    const desiredNames = new Set(normalized);

    // Attach new tags
    for (const name of desiredNames) {
      if (!currentNames.has(name)) {
        await this.attachTag(cardId, name);
      }
    }

    // Detach removed tags
    for (const tag of current) {
      if (!desiredNames.has(tag.name)) {
        await this.detachTag(cardId, tag.id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findTagByName(name: string): Promise<TagModel | null> {
    const results = await this.db
      .get<TagModel>('tags')
      .query(Q.where('name', Q.eq(name)))
      .fetch();
    return results[0] ?? null;
  }
}
