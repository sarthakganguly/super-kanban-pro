/**
 * BoardScreen — fixed
 *
 * Previously: outer BoardScreen called useLiveBoard once and inner BoardInner
 * called it again — two separate subscriptions, and DragProvider's onDrop was
 * wired to the outer instance while registerLaneBounds went to the inner one.
 *
 * Now: a single useLiveBoard call inside BoardInner. DragProvider is rendered
 * inside BoardInner so it shares the same data, and SwimlaneColumn registers
 * bounds via useDragContext directly (no prop needed).
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLiveBoard } from '@kanban/services';
import type { Card } from '@kanban/types';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { CardDetailScreen } from './CardDetailScreen';
import { DragGhost } from './drag/DragGhost';
import { DragProvider } from './drag/DragContext';
import { useDragDrop } from './drag/useDragDrop';
import { SwimlaneColumn } from './components/SwimlaneColumn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardScreenProps {
  projectId:   string;
  projectName: string;
  onBack:      () => void;
}

// ---------------------------------------------------------------------------
// BoardScreen — thin shell, just renders BoardInner
// ---------------------------------------------------------------------------

export function BoardScreen(props: BoardScreenProps) {
  return <BoardInner {...props} />;
}

// ---------------------------------------------------------------------------
// BoardInner — owns all data + drag wiring
// ---------------------------------------------------------------------------

function BoardInner({ projectId, projectName, onBack }: BoardScreenProps) {
  const theme = useTheme();

  // ONE call to useLiveBoard — the single source of truth for this board
  const {
    lanes, cards, isLoading, error, clearError,
    createCard, updateCard, moveCard, deleteCard,
    renameLane, deleteLane,
    rebalanceIfNeeded,
  } = useLiveBoard(projectId);

  // onDrop wired to this board's moveCard
  const { onDrop } = useDragDrop({ lanes, cards, moveCard });

  // Auto-rebalance after board stabilises
  React.useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => void rebalanceIfNeeded(), 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, rebalanceIfNeeded]);

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const handleCardPress = useCallback(
    (cardId: string) => {
      for (const laneCards of cards.values()) {
        const found = laneCards.find((c) => c.id === cardId);
        if (found) { setSelectedCard(found); return; }
      }
    },
    [cards],
  );

  const handleCardLongPress = useCallback((_cardId: string) => {
    // Drag is initiated by DraggableCardItem — nothing extra needed here
  }, []);

  const handleCreateCard = useCallback(
    async (laneId: string, title: string) => { await createCard({ laneId, title }); },
    [createCard],
  );

  const handleUpdateCard = useCallback(
    async (cardId: string, updates: Parameters<typeof updateCard>[1]) => {
      const updated = await updateCard(cardId, updates);
      if (updated) setSelectedCard(updated);
      return updated;
    },
    [updateCard],
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => { await deleteCard(cardId); },
    [deleteCard],
  );

  const handleDeleteLane = useCallback(
    (laneId: string) => {
      const lane      = lanes.find((l) => l.id === laneId);
      const cardCount = cards.get(laneId)?.length ?? 0;
      const { Alert } = require('react-native');
      Alert.alert(
        'Delete lane',
        `Delete "${lane?.name}"${cardCount > 0 ? ` and its ${cardCount} card${cardCount !== 1 ? 's' : ''}` : ''}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void deleteLane(laneId) },
        ],
      );
    },
    [lanes, cards, deleteLane],
  );

  // ---------------------------------------------------------------------------
  // Loading state (outside DragProvider is fine)
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bgTertiary }]}>
        <BoardHeader projectName={projectName} onBack={onBack} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main board — DragProvider wraps the scroll area and columns so
  // SwimlaneColumn can call useDragContext() to register its bounds.
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bgTertiary }]}>
      <BoardHeader projectName={projectName} onBack={onBack} />

      {error && (
        <Pressable
          style={[styles.errorBanner, { backgroundColor: theme.colors.error }]}
          onPress={clearError}
        >
          <Text style={styles.errorText}>{error} (tap to dismiss)</Text>
        </Pressable>
      )}

      <DragProvider onDrop={onDrop}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boardContent}
          directionalLockEnabled={false}
        >
          {lanes.map((lane) => (
            <SwimlaneColumn
              key={lane.id}
              lane={lane}
              cards={cards.get(lane.id) ?? []}
              onCardPress={handleCardPress}
              onCardLongPress={handleCardLongPress}
              onCreateCard={handleCreateCard}
              onRenameLane={renameLane}
              onDeleteLane={handleDeleteLane}
            />
          ))}
          <View style={styles.endSpacer} />
        </ScrollView>

        {/* Ghost renders above all columns, inside DragProvider */}
        <DragGhost />
      </DragProvider>

      {/* Card detail — outside DragProvider is fine, it doesn't need drag context */}
      <Modal
        visible={selectedCard !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedCard(null)}
      >
        {selectedCard && (
          <CardDetailScreen
            card={selectedCard}
            onClose={() => setSelectedCard(null)}
            onUpdate={handleUpdateCard}
            onDelete={handleDeleteCard}
          />
        )}
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// BoardHeader
// ---------------------------------------------------------------------------

function BoardHeader({ projectName, onBack }: { projectName: string; onBack: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: theme.colors.bgPrimary, borderBottomColor: theme.colors.borderDefault }]}>
      <Button label="← Boards" variant="secondary" size="sm" onPress={onBack} />
      <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
        {projectName}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle:   { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', marginHorizontal: 8 },
  headerSpacer:  { width: 80 },
  errorBanner:   { padding: 10, alignItems: 'center' },
  errorText:     { color: '#fff', fontSize: 13, fontWeight: '500' },
  boardContent:  { paddingHorizontal: 12, paddingVertical: 16, alignItems: 'flex-start' },
  endSpacer:     { width: 12 },
});