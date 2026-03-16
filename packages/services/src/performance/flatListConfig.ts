/**
 * FlatList performance configuration
 *
 * Centralised tuning constants for all FlatList instances in the app.
 *
 * Why centralised?
 *   FlatList performance is highly sensitive to these values and the
 *   optimal settings depend on card height and scroll velocity. Having
 *   them in one place makes it easy to run experiments (change one value,
 *   measure FPS, compare) without hunting through multiple files.
 *
 * Tuning philosophy:
 *   The defaults below are tuned for a board with 100–500 cards, targeting
 *   60fps scroll on a mid-tier 2020 Android device (Snapdragon 665).
 *
 *   If you have more memory available (e.g. a flagship device), increase
 *   WINDOW_SIZE and INITIAL_NUM_TO_RENDER for smoother scroll at the cost
 *   of higher memory usage.
 *
 * References:
 *   - React Native FlatList docs: windowSize, maxToRenderPerBatch, updateCellsBatchingPeriod
 *   - https://reactnative.dev/docs/optimizing-flatlist-configuration
 */

// ---------------------------------------------------------------------------
// Card height for getItemLayout
// ---------------------------------------------------------------------------

/**
 * Estimated height of a single card item in pixels.
 * Used by getItemLayout to avoid measuring every cell.
 *
 * Breakdown:
 *   - Card padding top + bottom: 24px
 *   - Title text (1–2 lines at 20px lineHeight): ~28px
 *   - Preview text (2 lines at 16px lineHeight): ~32px
 *   - Footer row: 20px
 *   - Margin bottom: 8px
 *   Total: ~112px (we use 110 to avoid rounding errors)
 *
 * Cards with very long titles or descriptions will be taller than this.
 * getItemLayout is an optimisation hint — occasional measurement
 * mismatches don't break scrolling, they just cause a small repaint.
 */
export const ESTIMATED_CARD_HEIGHT = 110;

/** Bottom margin between cards */
export const CARD_MARGIN_BOTTOM = 8;

/** Total slot height: card + margin */
export const CARD_SLOT_HEIGHT = ESTIMATED_CARD_HEIGHT + CARD_MARGIN_BOTTOM;

// ---------------------------------------------------------------------------
// FlatList tuning presets
// ---------------------------------------------------------------------------

/**
 * Aggressive virtualization preset — for boards with 200+ cards per lane.
 * Renders a narrow window; may cause blank cells during fast flings.
 */
export const FLATLIST_PERF_AGGRESSIVE = {
  windowSize:                 5,  // 5 × viewport height rendered
  maxToRenderPerBatch:        5,  // render 5 cards per JS frame
  updateCellsBatchingPeriod: 50,  // wait 50ms between batch updates
  initialNumToRender:        10,  // render 10 cards immediately
  removeClippedSubviews:    true,
} as const;

/**
 * Balanced preset — for boards with 50–200 cards per lane.
 * Good balance between memory, CPU, and scroll smoothness.
 */
export const FLATLIST_PERF_BALANCED = {
  windowSize:                 9,
  maxToRenderPerBatch:        8,
  updateCellsBatchingPeriod: 30,
  initialNumToRender:        15,
  removeClippedSubviews:    true,
} as const;

/**
 * Generous preset — for boards with < 50 cards per lane.
 * Keep everything rendered; prioritise scroll quality.
 */
export const FLATLIST_PERF_GENEROUS = {
  windowSize:                21,  // = default (keeps 10 viewports above + below)
  maxToRenderPerBatch:       20,
  updateCellsBatchingPeriod: 16,  // every frame
  initialNumToRender:        25,
  removeClippedSubviews:   false,
} as const;

/**
 * Selects the appropriate preset based on card count.
 */
export function selectFlatListPreset(cardCount: number) {
  if (cardCount >= 200) return FLATLIST_PERF_AGGRESSIVE;
  if (cardCount >= 50)  return FLATLIST_PERF_BALANCED;
  return FLATLIST_PERF_GENEROUS;
}

// ---------------------------------------------------------------------------
// getItemLayout
// ---------------------------------------------------------------------------

/**
 * Provides exact item dimensions to FlatList, bypassing measurement.
 * This dramatically improves scroll-to-index performance and reduces
 * jank during fast flings.
 *
 * Only accurate for cards with a roughly uniform height. Cards with
 * many lines of text will be slightly taller. The inaccuracy causes
 * a minor scroll position correction — acceptable for this use case.
 *
 * Usage:
 *   <FlatList getItemLayout={getCardItemLayout} ... />
 */
export function getCardItemLayout(
  _data: unknown,
  index: number,
): { length: number; offset: number; index: number } {
  return {
    length: CARD_SLOT_HEIGHT,
    offset: CARD_SLOT_HEIGHT * index,
    index,
  };
}
