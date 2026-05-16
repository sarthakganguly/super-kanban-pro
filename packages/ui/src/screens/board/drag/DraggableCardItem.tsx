/**
 * DraggableCardItem
 *
 * Web:    Uses onMouseDown + document-level mousemove/mouseup.
 *         The inner CardItem is wrapped with pointerEvents="none" so
 *         Pressable never receives events — no conflict, no accidental opens.
 *
 * Native: Uses PanResponder as before.
 *
 * In both cases, setHoverLane is called during move so cross-lane drops work.
 */

import React, { useCallback, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import type { Card } from '@kanban/types';
import { CARD_SLOT_HEIGHT } from '../../../../services/src/performance/flatListConfig';
import { useDragContext } from './DragContext';
import { CardItem } from '../components/CardItem';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LONG_PRESS_DELAY = 150;
const DRAG_THRESHOLD   = 12;
/** Approximate pixel height of the lane column header */
const LANE_HEADER_H    = 44;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DraggableCardItemProps {
  card:        Card;
  laneId:      string;
  onPress:     (cardId: string) => void;
  onLongPress: (cardId: string) => void;
}

// ---------------------------------------------------------------------------
// Web implementation
// ---------------------------------------------------------------------------

function WebDraggableCardItem({
  card,
  laneId,
  onPress,
}: DraggableCardItemProps) {
  const {
    isDragging,
    dragCard,
    startDrag,
    setHoverLane,
    setDropIndex,
    endDrag,
    cancelDrag,
    dragPosition,
    getLaneAtX,
    getLaneBound,
  } = useDragContext();

  const isThisCardDragging = isDragging && dragCard?.id === card.id;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only handle primary (left) button
      if (e.button !== 0) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const rect   = e.currentTarget.getBoundingClientRect();

      let dragStarted = false;

      const timer = setTimeout(() => {
        dragStarted = true;
        // Position ghost exactly where the card is on screen
        dragPosition.setValue({ x: rect.left, y: rect.top });
        startDrag(card, laneId);
      }, LONG_PRESS_DELAY);

      const handleMouseMove = (mv: MouseEvent) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;

        if (!dragStarted) {
          // Cancel drag-start if mouse moved too far before delay elapsed
          if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            clearTimeout(timer);
            // We don't cleanup here anymore — let the browser handle normal clicks
          }
          return;
        }

        // Move the ghost
        dragPosition.setValue({ x: rect.left + dx, y: rect.top + dy });

        // Detect which lane the cursor is over
        const hoveredLaneId = getLaneAtX(mv.clientX);
        if (hoveredLaneId) {
          setHoverLane(hoveredLaneId);

          // Calculate drop index from Y position within that lane
          const laneBound = getLaneBound(hoveredLaneId);
          if (laneBound) {
            const relY = mv.clientY - (laneBound.top + LANE_HEADER_H);
            // Use midpoints (relY + 45) so that being in the bottom half 
            // of a card targets the position after it.
            setDropIndex(Math.max(0, Math.floor((relY + 45) / 90)));
          }
        }
      };

      const handleMouseUp = () => {
        clearTimeout(timer);
        cleanup();
        if (dragStarted) {
          void endDrag();
        } else {
          // If we never started dragging, it was a click
          onPress(card.id);
        }
      };

      const cleanup = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup',  handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup',  handleMouseUp);

      // Prevent text selection and stop propagation to prevent parent handlers (like ScrollView)
      e.preventDefault();
      e.stopPropagation();
    },
    [
      card, laneId, dragPosition,
      startDrag, setHoverLane, setDropIndex, endDrag, onPress,
      getLaneAtX, getLaneBound,
    ],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        cursor:     isThisCardDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <View pointerEvents="none">
        <CardItem
          card={card}
          onPress={() => {}}
          onLongPress={() => {}}
          isActive={isThisCardDragging}
        />
      </View>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Native implementation (PanResponder)
// ---------------------------------------------------------------------------

function NativeDraggableCardItem({
  card,
  laneId,
  onPress,
  onLongPress,
}: DraggableCardItemProps) {
  const {
    isDragging,
    dragCard,
    startDrag,
    setHoverLane,
    setDropIndex,
    endDrag,
    cancelDrag,
    dragPosition,
    getLaneAtX,
    getLaneBound,
  } = useDragContext();

  const isThisCardDragging = isDragging && dragCard?.id === card.id;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragActive   = useRef(false);
  const cardRef        = useRef<View>(null);
  const cardPageX      = useRef(0);
  const cardPageY      = useRef(0);

  const measureCard = useCallback(() => {
    cardRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      cardPageX.current = pageX;
      cardPageY.current = pageY;
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_e, gs) =>
        Math.abs(gs.dy) > DRAG_THRESHOLD || Math.abs(gs.dx) > DRAG_THRESHOLD,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        // Capture initial touch coordinates immediately as fallback
        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;

        longPressTimer.current = setTimeout(() => {
          isDragActive.current = true;
          measureCard();
          // Fallback to touch coordinates if measure hasn't finished
          const startX = cardPageX.current || (touchX - 130); // center roughly
          const startY = cardPageY.current || (touchY - 40);
          dragPosition.setValue({ x: startX, y: startY });
          startDrag(card, laneId);
        }, LONG_PRESS_DELAY);
      },

      onPanResponderMove: (evt: GestureResponderEvent, gs: PanResponderGestureState) => {
        if (!isDragActive.current) {
          if (Math.abs(gs.dy) > DRAG_THRESHOLD || Math.abs(gs.dx) > DRAG_THRESHOLD) {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }
          return;
        }

        const startX = cardPageX.current || (evt.nativeEvent.pageX - gs.dx - 130);
        const startY = cardPageY.current || (evt.nativeEvent.pageY - gs.dy - 40);

        dragPosition.setValue({
          x: startX + gs.dx,
          y: startY + gs.dy,
        });

        // Update target lane
        const hoveredLaneId = getLaneAtX(evt.nativeEvent.pageX);
        if (hoveredLaneId) {
          setHoverLane(hoveredLaneId);
          const laneBound = getLaneBound(hoveredLaneId);
          if (laneBound) {
            const relY = evt.nativeEvent.pageY - (laneBound.top + LANE_HEADER_H);
            // Use midpoints (relY + 45) for more natural reordering
            setDropIndex(Math.max(0, Math.floor((relY + 45) / 90)));
          }
        }
      },

      onPanResponderRelease: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        if (isDragActive.current) {
          isDragActive.current = false;
          void endDrag();
        } else {
          onPress(card.id);
        }
      },

      onPanResponderTerminate: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        if (isDragActive.current) {
          isDragActive.current = false;
          cancelDrag();
        }
      },
    }),
  ).current;

  return (
    <View ref={cardRef} onLayout={measureCard} {...panResponder.panHandlers}>
      <CardItem
        card={card}
        onPress={onPress}
        onLongPress={onLongPress}
        isActive={isThisCardDragging}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public export — platform router
// ---------------------------------------------------------------------------

export function DraggableCardItem(props: DraggableCardItemProps) {
  if (Platform.OS === 'web') {
    return <WebDraggableCardItem {...props} />;
  }
  return <NativeDraggableCardItem {...props} />;
}