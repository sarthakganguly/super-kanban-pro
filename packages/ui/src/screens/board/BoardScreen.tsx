import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal, // Native modal used for full-screen CardDetail
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLiveBoard, LANE_COLOR_PALETTE } from '@kanban/services';
import type { Card } from '@kanban/types';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { Modal as CustomModal } from '../../components/Modal';
import { ColorPicker } from '../../components/settings/ColorPicker';
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

  const {
    lanes, cards, isLoading, error, clearError,
    createCard, updateCard, moveCard, deleteCard,
    createLane, renameLane, deleteLane, // createLane added here
    rebalanceIfNeeded,
  } = useLiveBoard(projectId);

  const { onDrop } = useDragDrop({ lanes, cards, moveCard });

  React.useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => void rebalanceIfNeeded(), 3000);
      return () => clearTimeout(timer);
    }
  },[isLoading, rebalanceIfNeeded]);

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // New Lane State
  const [showAddLane, setShowAddLane] = useState(false);
  const [newLaneName, setNewLaneName] = useState('');
  const[newLaneColor, setNewLaneColor] = useState(LANE_COLOR_PALETTE[0]!);
  const[isAddingLane, setIsAddingLane] = useState(false);

  const handleAddLaneSubmit = useCallback(async () => {
    if (!newLaneName.trim()) return;
    setIsAddingLane(true);
    await createLane(newLaneName.trim(), newLaneColor);
    setIsAddingLane(false);
    setShowAddLane(false);
    setNewLaneName('');
    setNewLaneColor(LANE_COLOR_PALETTE[0]!);
  }, [newLaneName, newLaneColor, createLane]);

  const handleCardPress = useCallback(
    (cardId: string) => {
      for (const laneCards of cards.values()) {
        const found = laneCards.find((c) => c.id === cardId);
        if (found) { setSelectedCard(found); return; }
      }
    },
    [cards],
  );

  const handleCardLongPress = useCallback((_cardId: string) => {},[]);

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
        `Delete "${lane?.name}"${cardCount > 0 ? ` and its ${cardCount} card${cardCount !== 1 ? 's' : ''}` : ''}? This cannot be undone.`,[
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void deleteLane(laneId) },
        ],
      );
    },
    [lanes, cards, deleteLane],
  );

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
              cards={cards.get(lane.id) ??[]}
              onCardPress={handleCardPress}
              onCardLongPress={handleCardLongPress}
              onCreateCard={handleCreateCard}
              onRenameLane={renameLane}
              onDeleteLane={handleDeleteLane}
            />
          ))}

          {/* Add Lane Button */}
          <Pressable
            style={({ pressed }) =>[
              styles.addLaneButton,
              {
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.borderDefault,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => setShowAddLane(true)}
            accessibilityRole="button"
            accessibilityLabel="Add new lane"
          >
            <Text style={[styles.addLaneText, { color: theme.colors.textSecondary }]}>
              + Add another lane
            </Text>
          </Pressable>

          <View style={styles.endSpacer} />
        </ScrollView>

        <DragGhost />
      </DragProvider>

      {/* Card detail full-screen modal */}
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

      {/* New Lane Creation Modal */}
      <CustomModal
        visible={showAddLane}
        onClose={() => { setShowAddLane(false); setNewLaneName(''); }}
        title="New lane"
      >
        <TextInput
          label="Lane name"
          value={newLaneName}
          onChangeText={setNewLaneName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleAddLaneSubmit}
          containerStyle={styles.modalInput}
        />
        <View style={styles.colorPickerContainer}>
          <Text style={[styles.colorPickerLabel, { color: theme.colors.textSecondary }]}>Lane color</Text>
          <ColorPicker value={newLaneColor} onChange={setNewLaneColor} />
        </View>
        <Button
          label="Add lane"
          onPress={handleAddLaneSubmit}
          isLoading={isAddingLane}
          disabled={!newLaneName.trim()}
        />
      </CustomModal>
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
  
  // Add Lane Button
  addLaneButton: {
    width: 280, // Matches SwimlaneColumn COLUMN_WIDTH
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addLaneText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Add Lane Modal
  modalInput: { 
    marginBottom: 16 
  },
  colorPickerContainer: { 
    marginBottom: 24, 
    gap: 8 
  },
  colorPickerLabel: { 
    fontSize: 13, 
    fontWeight: '500' 
  },
});
