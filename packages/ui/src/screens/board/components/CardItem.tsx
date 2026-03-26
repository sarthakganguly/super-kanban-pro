/**
 * CardItem
 *
 * Renders a single Kanban card in a swimlane column.
 *
 * Performance:
 *   Wrapped in React.memo with a custom comparison — only re-renders when the
 *   card's own data changes. This is critical when a board has 500+ cards;
 *   moving one card must not re-render every other card.
 *
 * Features:
 *   - Title (always shown)
 *   - Status color dot (top-right corner indicator)
 *   - Due date badge (red if overdue)
 *   - Card background color
 *   - Markdown preview truncated to 2 lines (full text in detail screen)
 *   - Drag handle (≡) for drag-and-drop (Phase 6)
 *   - Tap → opens card detail
 *   - Long-press → opens quick action menu
 */

import React, { memo, useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Card } from '@kanban/types';
import { formatDate, isOverdue } from '@kanban/utils';
import { useDatabase, useObservableQuery, type TagModel } from '@kanban/database';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '../../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardItemProps {
  card: Card;
  onPress:     (cardId: string) => void;
  onLongPress: (cardId: string) => void;
  /** Drag handle ref passed from DraggableFlatList in Phase 6 */
  drag?: () => void;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Component — wrapped in memo with deep card comparison
// ---------------------------------------------------------------------------

function CardItemBase({
  card,
  onPress,
  onLongPress,
  drag,
  isActive = false,
}: CardItemProps) {
  const theme = useTheme();
  const db    = useDatabase();

  // Reactive subscription to tags for this specific card
  const tagsQuery = useMemo(() => 
    db.db.get<TagModel>('tags').query(
      Q.on('card_tags', 'card_id', card.id)
    ).observe(),
  [db, card.id]);

  const tags = useObservableQuery(tagsQuery) ||[];

  const handlePress     = useCallback(() => onPress(card.id), [onPress, card.id]);
  const handleLongPress = useCallback(() => {
    onLongPress(card.id);
    drag?.();
  },[onLongPress, card.id, drag]);

  const cardBg   = card.color ?? theme.colors.bgCard;
  const overdue  = card.dueDate ? isOverdue(card.dueDate) : false;
  const hasDesc  = card.descriptionMarkdown.trim().length > 0;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) =>[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: theme.colors.borderDefault,
          opacity: isActive ? 0.7 : pressed ? 0.9 : 1,
          // Lifted shadow when being dragged
          shadowOpacity: isActive ? 0.25 : 0.06,
          elevation: isActive ? 8 : 2,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Card: ${card.title}`}
    >
      {/* Status color dot */}
      {card.statusColor ? (
        <View
          style={[
            styles.statusDot,
            { backgroundColor: card.statusColor },
          ]}
        />
      ) : null}

      {/* Title */}
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSizeMd,
          },
        ]}
        numberOfLines={3}
      >
        {card.title}
      </Text>

      {/* Tags Row */}
      {tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.slice(0, 8).map((tag) => (
            <View
              key={tag.id}
              style={[
                styles.tagPill,
                { backgroundColor: tag.color + '22', borderColor: tag.color + '55' },
              ]}
            >
              <Text style={[styles.tagText, { color: tag.color }]} numberOfLines={1}>
                #{tag.name}
              </Text>
            </View>
          ))}
          {tags.length > 8 && (
            <View
              style={[
                styles.tagPill,
                { backgroundColor: theme.colors.bgTertiary, borderColor: theme.colors.borderDefault },
              ]}
            >
              <Text style={[styles.tagText, { color: theme.colors.textSecondary }]}>
                +{tags.length - 8}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Markdown preview — plain text only; Phase 7 adds full rendering */}
      {hasDesc && (
        <Text
          style={[
            styles.preview,
            { color: theme.colors.textSecondary, fontSize: theme.typography.fontSizeXs },
          ]}
          numberOfLines={4}
        >
          {card.descriptionMarkdown.replace(/[#*`_~[\]()>]/g, '').trim()}
        </Text>
      )}

      {/* Footer row: due date + drag handle */}
      <View style={styles.footer}>
        {card.dueDate ? (
          <View
            style={[
              styles.dueBadge,
              {
                backgroundColor: overdue
                  ? theme.colors.error
                  : theme.colors.bgTertiary,
              },
            ]}
          >
            <Text
              style={[
                styles.dueText,
                {
                  color: overdue ? '#fff' : theme.colors.textSecondary,
                  fontSize: theme.typography.fontSizeXs,
                },
              ]}
            >
              {overdue ? '⚠ ' : ''}{formatDate(card.dueDate)}
            </Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        {/* Drag handle — activates in Phase 6 */}
        <Text style={[styles.dragHandle, { color: theme.colors.textDisabled }]}>
          ⠿
        </Text>
      </View>
    </Pressable>
  );
}

// Custom memo comparison — only re-render when card data actually changes
// (Internal hook state like tags will still trigger normal reactive re-renders)
export const CardItem = memo(CardItemBase, (prev, next) =>
  prev.card.id             === next.card.id &&
  prev.card.title          === next.card.title &&
  prev.card.descriptionMarkdown === next.card.descriptionMarkdown &&
  prev.card.color          === next.card.color &&
  prev.card.statusColor    === next.card.statusColor &&
  prev.card.dueDate        === next.card.dueDate &&
  prev.card.positionIndex  === next.card.positionIndex &&
  prev.card.laneId         === next.card.laneId &&
  prev.isActive            === next.isActive,
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
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
    fontWeight: '500',
    lineHeight: 20,
    paddingRight: 14, // space for status dot
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    marginBottom: 2,
  },
  tagPill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  preview: {
    lineHeight: 16,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dueBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dueText: {
    fontWeight: '500',
  },
  spacer: { flex: 1 },
  dragHandle: {
    fontSize: 16,
    lineHeight: 18,
  },
});