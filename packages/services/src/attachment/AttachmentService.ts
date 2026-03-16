/**
 * AttachmentService
 *
 * Orchestrates the full attachment lifecycle:
 *
 *   addImage(cardId, source)
 *     1. Process image (compress + thumbnail) via ImageProcessor
 *     2. Save full image to BlobStorage → get storageRef
 *     3. Save thumbnail to BlobStorage → get thumbnailRef
 *     4. Create AttachmentModel record in WatermelonDB
 *     5. Return Attachment domain object
 *
 *   addFile(cardId, source, filename, mimeType)
 *     1. Save file data to BlobStorage → get storageRef
 *     2. Create AttachmentModel record (thumbnailRef = null for non-images)
 *     3. Return Attachment domain object
 *
 *   getAttachments(cardId) → Attachment[]
 *   deleteAttachment(id)   → removes blob + metadata record
 *   loadAttachmentData(id) → data: URI string for display
 *
 * Limits:
 *   - Images are compressed; max uncompressed source size configurable
 *   - Web: IndexedDB quota typically 50% of available disk
 *   - Native: device filesystem (typically unlimited for app documents)
 */

import { Platform } from 'react-native';
import type { DatabaseProvider, AttachmentModel } from '@kanban/database';
import type { Attachment, AttachmentType } from '@kanban/types';
import { getBlobStorage } from './BlobStorageService';
import {
  mimeToAttachmentType,
  mimeToExt,
  processImage,
  type ImageProcessorOptions,
} from './ImageProcessor';

export class AttachmentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TOO_LARGE'
      | 'UNSUPPORTED_TYPE'
      | 'STORAGE_FAILED'
      | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'AttachmentError';
  }
}

// Default limits
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB hard cap

export class AttachmentService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly imageOpts: ImageProcessorOptions = {},
  ) {}

  // ---------------------------------------------------------------------------
  // Add image
  // ---------------------------------------------------------------------------

  /**
   * Adds a compressed image attachment to a card.
   *
   * @param cardId  - The card to attach to
   * @param source  - File (web) or absolute path string (native)
   * @param filename - Original filename for display
   */
  async addImage(
    cardId:   string,
    source:   File | string,
    filename: string,
  ): Promise<Attachment> {
    const storage = getBlobStorage();

    // Process: compress + thumbnail
    const processed = await processImage(source, this.imageOpts);

    // Store full image
    let imageResult: { key: string; sizeBytes: number };
    if (Platform.OS === 'web') {
      imageResult = await (storage as ReturnType<typeof getBlobStorage> & {
        save(blob: Blob, ext: string, prefix: string): Promise<{ key: string; sizeBytes: number }>;
      }).save(processed.data as Blob, 'jpg', `attachments/${cardId}`);
    } else {
      imageResult = await (storage as ReturnType<typeof getBlobStorage> & {
        save(path: string, ext: string, prefix: string): Promise<{ key: string; sizeBytes: number }>;
      }).save(processed.data as string, 'jpg', `attachments/${cardId}`);
    }

    // Store thumbnail
    let thumbResult: { key: string; sizeBytes: number };
    if (Platform.OS === 'web') {
      thumbResult = await (storage as ReturnType<typeof getBlobStorage> & {
        save(blob: Blob, ext: string, prefix: string): Promise<{ key: string; sizeBytes: number }>;
      }).save(processed.thumbnail as Blob, 'jpg', `thumbnails/${cardId}`);
    } else {
      thumbResult = await (storage as ReturnType<typeof getBlobStorage> & {
        save(path: string, ext: string, prefix: string): Promise<{ key: string; sizeBytes: number }>;
      }).save(processed.thumbnail as string, 'jpg', `thumbnails/${cardId}`);
    }

    // Save metadata
    const model = await this.db.attachments.create({
      cardId,
      type:         'image',
      filename:     filename || 'image.jpg',
      mimeType:     processed.mimeType,
      sizeBytes:    imageResult.sizeBytes,
      storageRef:   imageResult.key,
      thumbnailRef: thumbResult.key,
    });

    return this.modelToAttachment(model);
  }

  // ---------------------------------------------------------------------------
  // Add generic file
  // ---------------------------------------------------------------------------

  /**
   * Adds a non-image file attachment (PDF, audio, text, etc.).
   *
   * @param cardId   - The card to attach to
   * @param data     - Blob (web) or absolute path string (native)
   * @param filename - Original filename
   * @param mimeType - MIME type string
   */
  async addFile(
    cardId:   string,
    data:     Blob | string,
    filename: string,
    mimeType: string,
  ): Promise<Attachment> {
    const sizeBytes =
      data instanceof Blob ? data.size : await this.getFileSizeNative(data as string);

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new AttachmentError(
        `File exceeds the 50 MB limit (${Math.round(sizeBytes / 1024 / 1024)} MB).`,
        'TOO_LARGE',
      );
    }

    const storage = getBlobStorage();
    const ext     = mimeToExt(mimeType);
    const type    = mimeToAttachmentType(mimeType);

    let storageResult: { key: string; sizeBytes: number };
    if (Platform.OS === 'web') {
      storageResult = await (storage as ReturnType<typeof getBlobStorage> & {
        save(blob: Blob, ext: string, prefix: string): Promise<{ key: string; sizeBytes: number }>;
      }).save(data as Blob, ext, `attachments/${cardId}`);
    } else {
      storageResult = await (storage as ReturnType<typeof getBlobStorage> & {
        save(path: string, ext: string, prefix: string): Promise<{ key: string; sizeBytes: number }>;
      }).save(data as string, ext, `attachments/${cardId}`);
    }

    const model = await this.db.attachments.create({
      cardId,
      type,
      filename,
      mimeType,
      sizeBytes:    storageResult.sizeBytes,
      storageRef:   storageResult.key,
      thumbnailRef: null,
    });

    return this.modelToAttachment(model);
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async getAttachments(cardId: string): Promise<Attachment[]> {
    const models = await this.db.attachments.findByCardId(cardId);
    return models.map((m) => this.modelToAttachment(m));
  }

  /**
   * Returns a data: URI for displaying an attachment (image or other).
   * For thumbnails pass the thumbnailRef; for full image pass the storageRef.
   */
  async loadAsDataURL(storageRef: string, mimeType: string): Promise<string | null> {
    const storage = getBlobStorage();

    if (Platform.OS === 'web') {
      const url = await (storage as ReturnType<typeof getBlobStorage> & {
        loadAsDataURL(key: string): Promise<string | null>;
      }).loadAsDataURL(storageRef);
      return url;
    } else {
      const RNFS   = await import('react-native-fs');
      const exists = await RNFS.default.exists(storageRef);
      if (!exists) return null;
      const b64 = await RNFS.default.readFile(storageRef, 'base64');
      return `data:${mimeType};base64,${b64}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async deleteAttachment(id: string): Promise<void> {
    const model = await this.db.attachments.findById(id);
    if (!model) throw new AttachmentError('Attachment not found.', 'NOT_FOUND');

    const storage = getBlobStorage();

    // Remove blobs
    await (storage as ReturnType<typeof getBlobStorage> & {
      remove(key: string): Promise<void>;
    }).remove(model.storageRef);

    if (model.thumbnailRef) {
      await (storage as ReturnType<typeof getBlobStorage> & {
        remove(key: string): Promise<void>;
      }).remove(model.thumbnailRef).catch(() => {/* non-fatal */});
    }

    // Remove metadata record
    await this.db.attachments.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getFileSizeNative(path: string): Promise<number> {
    const RNFS = await import('react-native-fs');
    const stat = await RNFS.default.stat(path);
    return Number(stat.size);
  }

  private modelToAttachment(model: AttachmentModel): Attachment {
    return {
      id:           model.id,
      cardId:       model.cardId,
      type:         model.type,
      filename:     model.filename,
      mimeType:     model.mimeType,
      sizeBytes:    model.sizeBytes,
      storageRef:   model.storageRef,
      thumbnailRef: model.thumbnailRef,
      createdAt:    model.createdAt.toISOString(),
    };
  }
}
