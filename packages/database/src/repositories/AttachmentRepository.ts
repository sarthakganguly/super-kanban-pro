/**
 * AttachmentRepository
 *
 * Database operations for the `attachments` table.
 * Stores only metadata — binary data lives in BlobStorageService.
 */

import { Database, Q } from '@nozbe/watermelondb';
import { AttachmentModel } from '../models/AttachmentModel';
import type { AttachmentType } from '@kanban/types';

export interface CreateAttachmentInput {
  cardId:       string;
  type:         AttachmentType;
  filename:     string;
  mimeType:     string;
  sizeBytes:    number;
  storageRef:   string;
  thumbnailRef: string | null;
}

export class AttachmentRepository {
  constructor(private readonly db: Database) {}

  async findByCardId(cardId: string): Promise<AttachmentModel[]> {
    return this.db
      .get<AttachmentModel>('attachments')
      .query(Q.where('card_id', Q.eq(cardId)), Q.sortBy('created_at', Q.asc))
      .fetch();
  }

  async findById(id: string): Promise<AttachmentModel | null> {
    try {
      return await this.db.get<AttachmentModel>('attachments').find(id);
    } catch {
      return null;
    }
  }

  async create(input: CreateAttachmentInput): Promise<AttachmentModel> {
    const now = Date.now();
    return this.db.write(async () =>
      this.db.get<AttachmentModel>('attachments').create((record) => {
        record.cardId       = input.cardId;
        record.type         = input.type;
        record.filename     = input.filename;
        record.mimeType     = input.mimeType;
        record.sizeBytes    = input.sizeBytes;
        record.storageRef   = input.storageRef;
        record.thumbnailRef = input.thumbnailRef;
        (record._raw as Record<string, unknown>)['created_at'] = now;
      }),
    );
  }

  async delete(id: string): Promise<void> {
    const model = await this.findById(id);
    if (!model) return;
    await this.db.write(async () => model.destroyPermanently());
  }

  async countForCard(cardId: string): Promise<number> {
    return this.db
      .get<AttachmentModel>('attachments')
      .query(Q.where('card_id', Q.eq(cardId)))
      .fetchCount();
  }
}
