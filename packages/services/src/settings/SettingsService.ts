/**
 * SettingsService
 *
 * Manages user configuration (UserConfig table).
 *
 * Design:
 *   - All reads return a fully-typed SettingsSnapshot (no raw model).
 *   - Writes are partial patches — only changed fields hit the DB.
 *   - Array fields (defaultSwimlanes, defaultLaneColors) are
 *     JSON-serialized in the repository; SettingsService exposes them
 *     as typed arrays so callers never touch JSON directly.
 *   - After any save, the Zustand store's themeMode is synced
 *     automatically (the store holds the active theme, not the DB).
 */

import { Q } from '@nozbe/watermelondb';
import {
  type DatabaseProvider,
  type UserConfigModel,
  AttachmentModel,
  CardModel,
  CardTagModel,
  ProjectModel,
  SwimlaneModel,
} from '@kanban/database';
import type { ThemeMode, UserConfig } from '@kanban/types';
import { getBlobStorage } from '../attachment/BlobStorageService';

// ---------------------------------------------------------------------------
// Settings snapshot — the public domain type
// ---------------------------------------------------------------------------

export interface SettingsSnapshot {
  id:                  string;
  userId:              string;
  themeMode:           ThemeMode;
  fontFamily:          string;
  fontSize:            number;
  defaultSwimlanes:    string[];
  defaultLaneColors:   string[];
  imageMaxSizeMb:      number;
  markdownDefault:     boolean;
  enableSync:          boolean;
  syncEndpoint:        string | null;
  updatedAt:           string;
}

// Available font families for the font picker
export const AVAILABLE_FONTS = [
  { label: 'System default', value: 'System' },
  { label: 'San Francisco',  value: 'SFPro' },       // iOS only
  { label: 'Roboto',         value: 'Roboto' },       // Android + web
  { label: 'Georgia',        value: 'Georgia' },      // Serif
  { label: 'Courier New',    value: 'CourierNew' },   // Monospace
] as const;

export type AvailableFont = (typeof AVAILABLE_FONTS)[number]['value'];

// Available font sizes
export const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 17, 18] as const;
export type FontSizeOption = (typeof FONT_SIZE_OPTIONS)[number];

// Image size limit presets (MB)
export const IMAGE_SIZE_PRESETS = [1, 2, 5, 10] as const;
export type ImageSizePreset = (typeof IMAGE_SIZE_PRESETS)[number];

// Default swimlane color palette for the color picker
export const LANE_COLOR_PALETTE = [
  '#6B7280', // gray
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
] as const;

// ---------------------------------------------------------------------------
// SettingsService
// ---------------------------------------------------------------------------

export class SettingsService {
  constructor(private readonly db: DatabaseProvider) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async getSettings(userId: string): Promise<SettingsSnapshot | null> {
    const config = await this.db.users.findConfigByUserId(userId);
    if (!config) return null;
    return this.modelToSnapshot(config);
  }

  // ---------------------------------------------------------------------------
  // Write — individual field updates called from the UI
  // ---------------------------------------------------------------------------

  async setThemeMode(configId: string, mode: ThemeMode): Promise<void> {
    await this.db.users.updateConfig(configId, { themeMode: mode });
  }

  async setFontFamily(configId: string, family: string): Promise<void> {
    await this.db.users.updateConfig(configId, { fontFamily: family });
  }

  async setFontSize(configId: string, size: number): Promise<void> {
    if (size < 10 || size > 24) {
      throw new Error(`Font size ${size} is out of range (10–24).`);
    }
    await this.db.users.updateConfig(configId, { fontSize: size });
  }

  async setDefaultSwimlanes(
    configId:     string,
    names:        string[],
    colors:       string[],
  ): Promise<void> {
    if (names.length !== colors.length) {
      throw new Error('Lane names and colors arrays must have the same length.');
    }
    if (names.length === 0) {
      throw new Error('At least one default swimlane is required.');
    }
    await this.db.users.updateConfig(configId, {
      defaultSwimlanesJson:   JSON.stringify(names),
      defaultLaneColorsJson:  JSON.stringify(colors),
    });
  }

  async setImageMaxSizeMb(configId: string, mb: number): Promise<void> {
    if (mb < 0.5 || mb > 50) {
      throw new Error(`Image max size ${mb}MB is out of range (0.5–50).`);
    }
    await this.db.users.updateConfig(configId, { imageMaxSizeMb: mb });
  }

  async setMarkdownDefault(configId: string, enabled: boolean): Promise<void> {
    await this.db.users.updateConfig(configId, { markdownDefault: enabled });
  }

  async setSyncEndpoint(configId: string, endpoint: string | null): Promise<void> {
    await this.db.users.updateConfig(configId, { syncEndpoint: endpoint });
  }

  async setEnableSync(configId: string, enabled: boolean): Promise<void> {
    await this.db.users.updateConfig(configId, { enableSync: enabled });
  }

  /**
   * Resets all settings to their factory defaults.
   */
  async resetToDefaults(configId: string): Promise<void> {
    await this.db.users.updateConfig(configId, {
      themeMode:            'system',
      fontFamily:           'System',
      fontSize:             15,
      defaultSwimlanesJson: JSON.stringify(['To Do', 'In Progress', 'Done']),
      defaultLaneColorsJson: JSON.stringify(['#6B7280', '#3B82F6', '#10B981']),
      imageMaxSizeMb:       2,
      markdownDefault:      true,
      enableSync:           false,
      syncEndpoint:         null,
    });
  }

  /**
   * Permanently deletes all soft-deleted projects and cards for the given user,
   * cascading to child swimlanes, card tags, and attachments (both DB records and storage files).
   */
  async emptyTrash(userId: string): Promise<void> {
    // 1. Find all soft-deleted projects for this user
    const deletedProjects = await this.db.db
      .get<ProjectModel>('projects')
      .query(
        Q.and(
          Q.where('user_id', userId),
          Q.where('deleted_at', Q.notEq(null))
        )
      )
      .fetch();

    const deletedProjectIds = deletedProjects.map((p) => p.id);

    // 2. Find all swimlanes for those soft-deleted projects
    let deletedSwimlanes: SwimlaneModel[] = [];
    if (deletedProjectIds.length > 0) {
      deletedSwimlanes = await this.db.db
        .get<SwimlaneModel>('swimlanes')
        .query(Q.where('project_id', Q.oneOf(deletedProjectIds)))
        .fetch();
    }
    const deletedSwimlaneIds = deletedSwimlanes.map((l) => l.id);

    // 3. Find all cards (active and soft-deleted) in those deleted swimlanes
    let cardsInDeletedLanes: CardModel[] = [];
    if (deletedSwimlaneIds.length > 0) {
      cardsInDeletedLanes = await this.db.db
        .get<CardModel>('cards')
        .query(Q.where('lane_id', Q.oneOf(deletedSwimlaneIds)))
        .fetch();
    }

    // 4. Find all active projects for this user
    const activeProjects = await this.db.projects.findAllByUserId(userId);
    const activeProjectIds = activeProjects.map((p) => p.id);

    // 5. Find active swimlanes for these active projects
    let activeSwimlanesList: SwimlaneModel[] = [];
    if (activeProjectIds.length > 0) {
      activeSwimlanesList = await this.db.db
        .get<SwimlaneModel>('swimlanes')
        .query(Q.where('project_id', Q.oneOf(activeProjectIds)))
        .fetch();
    }
    const activeSwimlaneIds = activeSwimlanesList.map((l) => l.id);

    // 6. Find all soft-deleted cards inside active lanes
    let softDeletedCardsInActiveLanes: CardModel[] = [];
    if (activeSwimlaneIds.length > 0) {
      softDeletedCardsInActiveLanes = await this.db.db
        .get<CardModel>('cards')
        .query(
          Q.and(
            Q.where('lane_id', Q.oneOf(activeSwimlaneIds)),
            Q.where('deleted_at', Q.notEq(null))
          )
        )
        .fetch();
    }

    // 7. Combine all cards to be deleted
    const cardsToDeleteMap = new Map<string, CardModel>();
    cardsInDeletedLanes.forEach((c) => cardsToDeleteMap.set(c.id, c));
    softDeletedCardsInActiveLanes.forEach((c) => cardsToDeleteMap.set(c.id, c));
    const cardsToDelete = Array.from(cardsToDeleteMap.values());
    const cardsToDeleteIds = cardsToDelete.map((c) => c.id);

    // 8. Find all attachments to delete
    let attachmentsToDelete: AttachmentModel[] = [];
    if (cardsToDeleteIds.length > 0) {
      attachmentsToDelete = await this.db.db
        .get<AttachmentModel>('attachments')
        .query(Q.where('card_id', Q.oneOf(cardsToDeleteIds)))
        .fetch();
    }

    // 9. Find all card-tag joins to delete
    let cardTagsToDelete: CardTagModel[] = [];
    if (cardsToDeleteIds.length > 0) {
      cardTagsToDelete = await this.db.db
        .get<CardTagModel>('card_tags')
        .query(Q.where('card_id', Q.oneOf(cardsToDeleteIds)))
        .fetch();
    }

    // 10. Physically delete attachment files first (asynchronous)
    const storage = getBlobStorage();
    for (const attachment of attachmentsToDelete) {
      try {
        await storage.remove(attachment.storageRef);
      } catch (err) {
        console.warn(`[SettingsService.emptyTrash] Failed to remove storageRef: ${attachment.storageRef}`, err);
      }
      if (attachment.thumbnailRef) {
        try {
          await storage.remove(attachment.thumbnailRef);
        } catch (err) {
          console.warn(`[SettingsService.emptyTrash] Failed to remove thumbnailRef: ${attachment.thumbnailRef}`, err);
        }
      }
    }

    // 11. Run DB deletion inside a single write batch transaction
    await this.db.db.write(async () => {
      const deletions = [
        ...attachmentsToDelete.map((a) => a.prepareDestroyPermanently()),
        ...cardTagsToDelete.map((ct) => ct.prepareDestroyPermanently()),
        ...cardsToDelete.map((c) => c.prepareDestroyPermanently()),
        ...deletedSwimlanes.map((l) => l.prepareDestroyPermanently()),
        ...deletedProjects.map((p) => p.prepareDestroyPermanently()),
      ];
      await this.db.db.batch(...deletions);
    });
  }


  // ---------------------------------------------------------------------------
  // Mapper
  // ---------------------------------------------------------------------------

  private modelToSnapshot(model: UserConfigModel): SettingsSnapshot {
    return {
      id:               model.id,
      userId:           model.userId,
      themeMode:        model.themeMode as ThemeMode,
      fontFamily:       model.fontFamily,
      fontSize:         model.fontSize,
      defaultSwimlanes: model.defaultSwimlanes,
      defaultLaneColors:model.defaultLaneColors,
      imageMaxSizeMb:   model.imageMaxSizeMb,
      markdownDefault:  model.markdownDefault,
      enableSync:       model.enableSync,
      syncEndpoint:     model.syncEndpoint,
      updatedAt:        model.updatedAt.toISOString(),
    };
  }
}
