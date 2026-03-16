/**
 * AttachmentModel
 *
 * Metadata record for a file attached to a card.
 * The actual binary data lives outside WatermelonDB:
 *   - Mobile: device filesystem (absolute path in `storageRef`)
 *   - Web: IndexedDB blob store (key in `storageRef`)
 *
 * WatermelonDB stores only the metadata here so querying/listing attachments
 * is fast without pulling large blobs into memory.
 */

import { Model } from '@nozbe/watermelondb';
import {
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import type { AttachmentType } from '@kanban/types';
import type { CardModel } from './CardModel';

export class AttachmentModel extends Model {
  static table = 'attachments';

  static associations = {
    cards: { type: 'belongs_to' as const, key: 'card_id' },
  };

  @field('card_id')
  cardId!: string;

  /** One of: 'image' | 'pdf' | 'doc' | 'txt' | 'md' | 'audio' */
  @field('type')
  type!: AttachmentType;

  @field('filename')
  filename!: string;

  /** MIME type, e.g. "image/jpeg" */
  @field('mime_type')
  mimeType!: string;

  @field('size_bytes')
  sizeBytes!: number;

  /**
   * Platform-specific storage reference.
   * Mobile: absolute filesystem path.
   * Web: key in the IndexedDB blob object store.
   */
  @field('storage_ref')
  storageRef!: string;

  /**
   * Compressed thumbnail reference (images only).
   * Same format as storageRef — null for non-image attachments.
   */
  @field('thumbnail_ref')
  thumbnailRef!: string | null;

  @readonly @date('created_at')
  createdAt!: Date;

  get isImage(): boolean {
    return this.type === 'image';
  }

  get sizeKb(): number {
    return Math.round(this.sizeBytes / 1024);
  }

  @relation('cards', 'card_id')
  card!: CardModel;
}
