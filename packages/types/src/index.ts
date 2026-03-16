/**
 * @kanban/types
 *
 * Single source of truth for all domain types.
 * No runtime code lives here — pure TypeScript interfaces and enums only.
 * Import these types across packages to guarantee consistency.
 */

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** ISO 8601 timestamp string, e.g. "2024-01-15T10:30:00.000Z" */
export type ISODate = string;

/** UUID v4 string */
export type UUID = string;

/** Fractional index string for card ordering, e.g. "1", "1.5", "2.25" */
export type FractionalIndex = string;

/** Hex color string, e.g. "#FF5733" */
export type HexColor = string;

// ---------------------------------------------------------------------------
// User & Authentication
// ---------------------------------------------------------------------------

export interface User {
  id: UUID;
  username: string;
  /** bcrypt hash — never expose this to the UI layer */
  passwordHash: string;
  createdAt: ISODate;
}

export interface UserConfig {
  id: UUID;
  userId: UUID;
  themeMode: ThemeMode;
  fontFamily: string;
  fontSize: number;
  defaultSwimlanes: string[];   // Lane names to create for new projects
  defaultLaneColors: HexColor[];
  imageMaxSizeMb: number;       // Default: 2
  markdownDefault: boolean;
  enableSync: boolean;          // Future SaaS — default false
  syncEndpoint: string | null;  // Future SaaS
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type ThemeMode = 'light' | 'dark' | 'system';

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface Project {
  id: UUID;
  userId: UUID;
  name: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Soft delete — null means active */
  deletedAt: ISODate | null;
}

// ---------------------------------------------------------------------------
// Swimlanes
// ---------------------------------------------------------------------------

export interface Swimlane {
  id: UUID;
  projectId: UUID;
  name: string;
  color: HexColor;
  /** Integer for lane ordering within a project */
  position: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Default lanes used when creating a new project */
export const DEFAULT_LANES: Pick<Swimlane, 'name' | 'color'>[] = [
  { name: 'To Do',       color: '#6B7280' },
  { name: 'In Progress', color: '#3B82F6' },
  { name: 'Done',        color: '#10B981' },
];

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export interface Card {
  id: UUID;
  laneId: UUID;
  title: string;
  /** Full description stored as Markdown */
  descriptionMarkdown: string;
  /** Background color of the card */
  color: HexColor | null;
  /** Small colored indicator for status (e.g. blocked, on-track) */
  statusColor: HexColor | null;
  dueDate: ISODate | null;
  /** Fractional index for drag-and-drop ordering within a lane */
  positionIndex: FractionalIndex;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Soft delete */
  deletedAt: ISODate | null;
}

// ---------------------------------------------------------------------------
// Tags / Hashtags
// ---------------------------------------------------------------------------

export interface Tag {
  id: UUID;
  name: string;   // Normalized, e.g. "feature", "bug"
  color: HexColor;
}

export interface CardTag {
  cardId: UUID;
  tagId: UUID;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export type AttachmentType = 'image' | 'pdf' | 'doc' | 'txt' | 'md' | 'audio';

export interface Attachment {
  id: UUID;
  cardId: UUID;
  type: AttachmentType;
  filename: string;
  /** MIME type, e.g. "image/jpeg" */
  mimeType: string;
  /** Size in bytes */
  sizeBytes: number;
  /**
   * Platform-specific storage reference.
   * Mobile: absolute path on device filesystem.
   * Web: IndexedDB blob key.
   */
  storageRef: string;
  /** Only set for images — points to compressed thumbnail */
  thumbnailRef: string | null;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Fractional indexing helpers (types only — implementation in @kanban/utils)
// ---------------------------------------------------------------------------

export interface FractionalIndexRange {
  prev: FractionalIndex | null;
  next: FractionalIndex | null;
}

// ---------------------------------------------------------------------------
// Store slice shapes (Zustand)
// ---------------------------------------------------------------------------

export interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
}

export interface ProjectState {
  activeProjectId: UUID | null;
}

export interface UIState {
  themeMode: ThemeMode;
  isLoading: boolean;
}
