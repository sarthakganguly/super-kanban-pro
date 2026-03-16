/**
 * @kanban/services — Phase 3–7
 */

export { AuthError, AuthService, validatePassword, validateUsername } from './auth/AuthService';
export type { ValidationResult } from './auth/AuthService';
export { useAuth } from './auth/useAuth';
export type { UseAuthReturn } from './auth/useAuth';

export { ProjectError, ProjectService, validateProjectName } from './project/ProjectService';
export { useProjects } from './project/useProjects';
export type { UseProjectsReturn } from './project/useProjects';

export { CardError, CardService } from './card/CardService';
export type { CreateCardInput, UpdateCardInput, MoveCardInput } from './card/CardService';
export { useBoard } from './card/useBoard';
export type { UseBoardReturn } from './card/useBoard';

export { SwimlaneError, SwimlaneService } from './swimlane/SwimlaneService';

export { TagService } from './tag/TagService';
export type { TagSummary } from './tag/TagService';

export { AttachmentService, AttachmentError } from './attachment/AttachmentService';
export { useAttachments } from './attachment/useAttachments';
export type { UseAttachmentsReturn } from './attachment/useAttachments';
export { getBlobStorage } from './attachment/BlobStorageService';
export { processImage, mimeToAttachmentType, mimeToExt } from './attachment/ImageProcessor';

export { SettingsService, AVAILABLE_FONTS, FONT_SIZE_OPTIONS, IMAGE_SIZE_PRESETS, LANE_COLOR_PALETTE } from './settings/SettingsService';
export type { SettingsSnapshot, AvailableFont, FontSizeOption, ImageSizePreset } from './settings/SettingsService';
export { useSettings } from './settings/useSettings';
export type { UseSettingsReturn } from './settings/useSettings';

// Performance-optimised board hook (replaces useBoard for production use)
export { useLiveBoard } from './card/useLiveBoard';
export type { UseLiveBoardReturn } from './card/useLiveBoard';

// Performance utilities
export { useRenderCount, useWhyDidYouUpdate, useMeasureRender } from './performance/usePerformanceMonitor';
export {
  selectFlatListPreset,
  getCardItemLayout,
  ESTIMATED_CARD_HEIGHT,
  CARD_SLOT_HEIGHT,
  FLATLIST_PERF_AGGRESSIVE,
  FLATLIST_PERF_BALANCED,
  FLATLIST_PERF_GENEROUS,
} from './performance/flatListConfig';

// Thumbnail caching (Phase 11)
export { ThumbnailCache } from './thumbnail/ThumbnailCache';
export { useThumbnail } from './thumbnail/useThumbnail';
export type { UseThumbnailReturn, ThumbnailState } from './thumbnail/useThumbnail';
export { useThumbnailPrefetch } from './thumbnail/useThumbnailPrefetch';
