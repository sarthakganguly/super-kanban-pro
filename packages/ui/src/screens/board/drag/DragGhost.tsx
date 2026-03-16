/**
 * DragGhost
 *
 * A floating, semi-transparent copy of the card being dragged.
 * Rendered at the board level (above all columns) so it can cross lane boundaries.
 *
 * Implementation:
 *   - Uses Animated.View with translateX/translateY driven by DragContext.dragPosition
 *   - Only rendered when isDragging is true
 *   - Slightly scaled up (1.04×) and with stronger shadow — gives a "lifted" feel
 *   - Rotated 2° to reinforce the "picked up" metaphor
 *   - Opacity 0.92 — card shows through slightly so user can see the drop target
 *
 * The ghost is positioned absolutely at the top-left of the board viewport.
 * DragPosition values are set relative to that origin by the PanResponder
 * in DraggableCardItem.
 */

import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@kanban/types';
import { useTheme } from '../../../theme/ThemeProvider';
import { useDragContext } from './DragContext';

export function DragGhost() {
  const theme = useTheme();
  const { isDragging, dragCard, dragPosition } = useDragContext();

  if (!isDragging || !dragCard) return null;

  return (
    <Animated.View
      style={[
        styles.ghost,
        {
          backgroundColor: dragCard.color ?? theme.colors.bgCard,
          borderColor: theme.colors.borderFocus,
          transform: [
            { translateX: dragPosition.x },
            { translateY: dragPosition.y },
            { scale: 1.04 },
            { rotate: '2deg' },
          ],
        },
      ]}
      pointerEvents="none"
    >
      {/* Status dot */}
      {dragCard.statusColor ? (
        <View
          style={[
            styles.statusDot,
            { backgroundColor: dragCard.statusColor },
          ]}
        />
      ) : null}

      <Text
        style={[
          styles.title,
          { color: theme.colors.textPrimary },
        ]}
        numberOfLines={2}
      >
        {dragCard.title}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 260,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    opacity: 0.92,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 9999,
  },
  statusDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    paddingRight: 14,
  },
});
