/* 
 * BoardScreen - A single useLiveBoard call inside BoardInner. DragProvider is rendered
 * inside BoardInner so it shares the same data, and SwimlaneColumn registers
 * bounds via useDragContext directly (no prop needed).
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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

export interface BoardScreenProps {
  projectId:   string;
  projectName: string;
  onBack:      () => void;
}

export function BoardScreen(props: BoardScreenProps) {
  return <BoardInner {...props} />;
}

function BoardInner({ projectId, projectName, onBack }: BoardScreenProps) {
  const theme = useTheme();

  const {
    lanes, cards, isLoading, error, clearError,
    createCard, updateCard, moveCard, deleteCard,
    createLane, renameLane, deleteLane,
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

  const[showAddLane, setShowAddLane] = useState(false);
  const [newLaneName, setNewLaneName] = useState('');
  const[newLaneColor, setNewLaneColor] = useState(LANE_COLOR_PALETTE[0]!);
  const [isAddingLane, setIsAddingLane] = useState(false);

  const handleAddLaneSubmit = useCallback(async () => {
    if (!newLaneName.trim()) return;
    setIsAddingLane(true);
    await createLane(newLaneName.trim(), newLaneColor);
    setIsAddingLane(false);
    setShowAddLane(false);
    setNewLaneName('');
    setNewLaneColor(LANE_COLOR_PALETTE[0]!);
  },[newLaneName, newLaneColor, createLane]);

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
    (laneId: string, laneName: string, cardCount: number) => {
      console.log('[DEBUG] handleDeleteLane triggered for:', laneName);

      const message = `Delete "${laneName}"${cardCount > 0 ? ` and its ${cardCount} card(s)` : ''}? This cannot be undone.`;

      // On Web, use standard browser confirm to avoid React Native Web's Alert/Modal collisions
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(message);
        if (confirmed) {
          console.log('[DEBUG] User confirmed web prompt. Firing deleteLane...');
          void deleteLane(laneId);
        } else {
          console.log('[DEBUG] User canceled web prompt.');
        }
        return;
      }

      // Native fallback
      Alert.alert('Delete lane', message,[
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
            console.log('[DEBUG] User confirmed native prompt. Firing deleteLane...');
            void deleteLane(laneId); 
        }},
      ]);
    },
    [deleteLane],
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
  
  addLaneButton: {
    width: 280,
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
