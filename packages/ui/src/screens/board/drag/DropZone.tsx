/**
 * DropZone
 *
 * Each swimlane column renders a DropZone overlay when a drag is active.
 * The DropZone tracks when the dragged ghost enters/leaves its bounds
 * and calculates the insertion index based on the vertical finger position.
 *
 * How drop index is calculated:
 *   The DropZone knows the height and y-offset of each card via a ref array
 *   populated by onCardLayout callbacks. When the finger moves, we compare
 *   the y position against each card's midpoint:
 *     - If y < card[0].midY → insert at index 0 (top)
 *     - If y between card[i].midY and card[i+1].midY → insert at i+1
 *     - If y > last card's midY → insert at the end
 *
 * Visual feedback:
 *   - Column background brightens slightly when it's the active target
 *   - A horizontal insertion line appears between cards at the dropIndex
 */

import React, { useCallback, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { useDragContext } from './DragContext';

interface CardLayout {
  y:      number;
  height: number;
}

export interface DropZoneProps {
  laneId:     string;
  cardCount:  number;
  /** Called with the y coordinate of the drag within this column */
  onDragMove?: (y: number) => void;
}

export function DropZone({ laneId, cardCount }: DropZoneProps) {
  const theme = useTheme();
  const {
    isDragging,
    dragCard,
    sourceLaneId,
    targetLaneId,
    dropIndex,
    setHoverLane,
    setDropIndex,
  } = useDragContext();

  const isTarget  = targetLaneId === laneId;
  const hasGhost  = isDragging && dragCard;

  // We don't show the overlay if nothing is being dragged
  if (!hasGhost) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        styles.overlay,
        isTarget && { backgroundColor: `${theme.colors.accent}10` },
      ]}
      pointerEvents="none"
    >
      {/* Insertion line indicator */}
      {isTarget && dropIndex !== null && (
        <InsertionLine
          index={dropIndex}
          cardCount={cardCount}
          color={theme.colors.accent}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// InsertionLine
// Shows a colored horizontal bar between cards to indicate drop position
// ---------------------------------------------------------------------------

interface InsertionLineProps {
  index:     number;
  cardCount: number;
  color:     string;
}

function InsertionLine({ index, cardCount, color }: InsertionLineProps) {
  // Each card is approximately CARD_HEIGHT px tall + CARD_GAP gap
  const CARD_HEIGHT = 82;
  const CARD_GAP    = 8;
  const HEADER_H    = 44;  // column header height
  const PADDING_TOP = 4;

  // Position the line between cards
  const topOffset = HEADER_H + PADDING_TOP + index * (CARD_HEIGHT + CARD_GAP) - 3;

  return (
    <View
      style={[
        styles.insertionLine,
        {
          top:             topOffset,
          backgroundColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 10,
    borderRadius: 12,
  },
  insertionLine: {
    position: 'absolute',
    left:     10,
    right:    10,
    height:   3,
    borderRadius: 2,
    opacity: 0.85,
  },
});
