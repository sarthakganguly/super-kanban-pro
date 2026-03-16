/**
 * @kanban/utils
 *
 * Pure utility functions with zero external dependencies.
 * Everything here must work in both React Native and browser environments.
 */

import type { FractionalIndex, UUID } from '@kanban/types';

// ---------------------------------------------------------------------------
// UUID generation
// ---------------------------------------------------------------------------

/**
 * Generates a UUID v4.
 * Uses crypto.randomUUID() when available (Node 14.17+, modern browsers),
 * falls back to a manual implementation for older environments.
 */
export function generateUUID(): UUID {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // Fallback: RFC 4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Fractional indexing
// ---------------------------------------------------------------------------

/**
 * The starting index for the first card in a lane.
 * All subsequent insertions are derived from this.
 */
export const INITIAL_INDEX: FractionalIndex = '1';

/**
 * Computes a new fractional index to insert a card between prev and next.
 *
 * Algorithm:
 *   new = (prev + next) / 2
 *
 * Edge cases:
 *   - Inserting at start:  prev = 0, next = first card's index
 *   - Inserting at end:    prev = last card's index, next = prev + 2
 *   - Both null:           returns '1' (first card)
 *
 * Precision is capped at 20 decimal places to avoid floating-point drift
 * over thousands of moves. When precision is exhausted, callers should
 * trigger a rebalancing pass (Phase 10).
 *
 * @param prev - Index of the card immediately before the insertion point (null if inserting at start)
 * @param next - Index of the card immediately after the insertion point (null if inserting at end)
 */
export function computeFractionalIndex(
  prev: FractionalIndex | null,
  next: FractionalIndex | null,
): FractionalIndex {
  if (prev === null && next === null) {
    return INITIAL_INDEX;
  }

  const prevNum = prev !== null ? parseFloat(prev) : 0;
  const nextNum = next !== null ? parseFloat(next) : prevNum + 2;

  const mid = (prevNum + nextNum) / 2;

  // Trim trailing zeros but keep enough precision to avoid collisions
  const result = mid.toFixed(20).replace(/\.?0+$/, '');

  return result || INITIAL_INDEX;
}

/**
 * Rebalances a full list of fractional indices back to integer spacing.
 * Call this when a lane's cards have drifted to extreme precision.
 *
 * Returns a map of card ID → new index.
 */
export function rebalanceIndices(
  cardIds: string[],
): Map<string, FractionalIndex> {
  const map = new Map<string, FractionalIndex>();
  cardIds.forEach((id, i) => {
    map.set(id, String(i + 1));
  });
  return map;
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

/** Returns an ISO 8601 timestamp for the current moment */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Formats an ISO date string for display.
 * Uses Intl.DateTimeFormat for locale-aware output.
 */
export function formatDate(iso: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

/** Returns true if the given ISO date is in the past */
export function isOverdue(iso: string): boolean {
  return new Date(iso) < new Date();
}

// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

/**
 * Normalizes a hashtag name: lowercase, trim, strip leading #
 * Example: " #Feature " → "feature"
 */
export function normalizeTag(input: string): string {
  return input.trim().replace(/^#/, '').toLowerCase();
}

/**
 * Extracts all hashtag strings from a markdown string.
 * Example: "Working on #feature #bug-fix today" → ["feature", "bug-fix"]
 */
export function extractHashtags(markdown: string): string[] {
  const matches = markdown.match(/#[\w-]+/g) ?? [];
  return [...new Set(matches.map(normalizeTag))];
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the hex color is considered "dark"
 * (used to decide whether to render white or black text on a colored background).
 */
export function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  // Perceived luminance formula (WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

// ---------------------------------------------------------------------------
// Array utilities
// ---------------------------------------------------------------------------

/** Sorts cards in-place by fractional position index (ascending) */
export function sortByPosition<T extends { positionIndex: FractionalIndex }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => parseFloat(a.positionIndex) - parseFloat(b.positionIndex),
  );
}

/** Chunks a large array into smaller arrays for batch processing */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
