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

const LONG_PRESS_DELAY = 300;
const DRAG_THRESHOLD   = 8;
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
          // Cancel drag-start if finger moved too far before delay elapsed
          if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            clearTimeout(timer);
            cleanup();
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
            const relY = mv.clientY - laneBound.top - LANE_HEADER_H;
            setDropIndex(Math.max(0, Math.floor(relY / CARD_SLOT_HEIGHT)));
          }
        }
      };

      const handleMouseUp = () => {
        clearTimeout(timer);
        cleanup();
        if (dragStarted) {
          void endDrag();
        } else {
          onPress(card.id);
        }
      };

      const cleanup = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup',  handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup',  handleMouseUp);

      // Prevent text selection and stop Pressable from ever seeing this event
      e.preventDefault();
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
      {/*
       * pointerEvents="none" on the inner View means Pressable never receives
       * mouse events — all interaction is handled by the div above.
       */}
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
// Native implementation (PanResponder — unchanged logic, setHoverLane added)
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
        longPressTimer.current = setTimeout(() => {
          isDragActive.current = true;
          measureCard();
          dragPosition.setValue({ x: cardPageX.current, y: cardPageY.current });
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

        dragPosition.setValue({
          x: cardPageX.current + gs.dx,
          y: cardPageY.current + gs.dy,
        });

        // Update target lane
        const hoveredLaneId = getLaneAtX(evt.nativeEvent.pageX);
        if (hoveredLaneId) {
          setHoverLane(hoveredLaneId);
          const laneBound = getLaneBound(hoveredLaneId);
          if (laneBound) {
            const relY = evt.nativeEvent.pageY - laneBound.top - LANE_HEADER_H;
            setDropIndex(Math.max(0, Math.floor(relY / CARD_SLOT_HEIGHT)));
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