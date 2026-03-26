/**
 * SwimlaneColumn — updated
 *
 * Registers its own bounds with DragContext directly via measureInWindow,
 * removing the onRegisterBounds prop. measureInWindow gives page-level
 * coordinates (not relative to parent) which is what DraggableCardItem needs
 * when comparing against mouse/touch pageX/pageY.
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import type { Card, Swimlane } from '@kanban/types';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { Modal } from '../../components/Modal';
import { TextInput } from '../../components/TextInput';
import { DraggableCardItem } from '../drag/DraggableCardItem';
import { selectFlatListPreset } from '../../../../services/src/performance/flatListConfig';
import { DropZone } from '../drag/DropZone';
import { useDragContext } from '../drag/DragContext';

export interface SwimlaneColumnProps {
  lane:             Swimlane;
  cards:            Card[];
  onCardPress:      (cardId: string) => void;
  onCardLongPress:  (cardId: string) => void;
  onCreateCard:     (laneId: string, title: string) => Promise<void>;
  onRenameLane:     (laneId: string, name: string) => Promise<void>;
  onDeleteLane:     (laneId: string, name: string, cardCount: number) => void;
}

function SwimlaneColumnBase({
  lane,
  cards,
  onCardPress,
  onCardLongPress,
  onCreateCard,
  onRenameLane,
  onDeleteLane,
}: SwimlaneColumnProps) {
  const theme   = useTheme();
  const dragCtx = useDragContext();

  const columnRef = useRef<View>(null);

  const [addingCard,    setAddingCard]    = useState(false);
  const[newCardTitle,  setNewCardTitle]  = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const[renaming,      setRenaming]      = useState(false);
  const [renameValue,   setRenameValue]   = useState(lane.name);

  const handleLayout = useCallback(() => {
    columnRef.current?.measureInWindow((x, y, width, height) => {
      dragCtx.registerLaneBounds(lane.id, x, x + width, y);
    });
  }, [lane.id, dragCtx]);

  const handleAddCard = useCallback(async () => {
    if (!newCardTitle.trim()) return;
    setAddingLoading(true);
    await onCreateCard(lane.id, newCardTitle.trim());
    setAddingLoading(false);
    setNewCardTitle('');
    setAddingCard(false);
  },[lane.id, newCardTitle, onCreateCard]);

  const handleRename = useCallback(async () => {
    if (!renameValue.trim()) return;
    await onRenameLane(lane.id, renameValue);
    setRenaming(false);
  }, [lane.id, renameValue, onRenameLane]);

  const renderCard: ListRenderItem<Card> = useCallback(
    ({ item }) => (
      <DraggableCardItem
        card={item}
        laneId={lane.id}
        onPress={onCardPress}
        onLongPress={onCardLongPress}
      />
    ),[lane.id, onCardPress, onCardLongPress],
  );

  const keyExtractor = useCallback((item: Card) => item.id, []);

  return (
    <View
      ref={columnRef}
      style={[styles.column, { backgroundColor: theme.colors.bgSecondary }]}
      onLayout={handleLayout}
    >
      <DropZone laneId={lane.id} cardCount={cards.length} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.colorDot, { backgroundColor: lane.color }]} />
          <Text
            style={[styles.laneName, { color: theme.colors.textPrimary, fontSize: theme.typography.fontSizeSm }]}
            numberOfLines={1}
          >
            {lane.name}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: theme.colors.bgTertiary }]}>
            <Text style={[styles.countText, { color: theme.colors.textSecondary }]}>
              {cards.length}
            </Text>
          </View>
        </View>
        <IconButton
          icon="⋯"
          accessibilityLabel={`${lane.name} options`}
          onPress={() => setMenuOpen(true)}
          size={18}
          color={theme.colors.textSecondary}
        />
      </View>

      <FlatList
        data={cards}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        contentContainerStyle={styles.cardList}
        showsVerticalScrollIndicator={false}
        {...selectFlatListPreset(cards.length)}
      />

      {addingCard ? (
        <View style={styles.addCardForm}>
          <TextInput
            label=""
            value={newCardTitle}
            onChangeText={setNewCardTitle}
            placeholder="Card title…"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAddCard}
            containerStyle={styles.addCardInput}
          />
          <View style={styles.addCardActions}>
            <Button label="Add" onPress={handleAddCard} isLoading={addingLoading} disabled={!newCardTitle.trim()} size="sm" />
            <Button label="Cancel" variant="secondary" onPress={() => { setAddingCard(false); setNewCardTitle(''); }} size="sm" />
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) =>[styles.addButton, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => setAddingCard(true)}
          accessibilityRole="button"
          accessibilityLabel={`Add card to ${lane.name}`}
        >
          <Text style={[styles.addButtonText, { color: theme.colors.textSecondary }]}>
            + Add card
          </Text>
        </Pressable>
      )}

      <Modal visible={menuOpen} onClose={() => setMenuOpen(false)} title={lane.name}>
        <View style={styles.menuActions}>
          <Button label="Rename lane" variant="secondary" onPress={() => { setMenuOpen(false); setRenameValue(lane.name); setRenaming(true); }} />
          <Button 
            label="Delete lane" 
            variant="destructive" 
            onPress={() => { 
              console.log('[DEBUG] Delete button clicked for lane:', lane.name);
              setMenuOpen(false); 
              // Completely synchronous call! No setTimeout.
              onDeleteLane(lane.id, lane.name, cards.length); 
            }} 
          />
        </View>
      </Modal>

      <Modal visible={renaming} onClose={() => setRenaming(false)} title="Rename lane">
        <TextInput label="Lane name" value={renameValue} onChangeText={setRenameValue} autoFocus returnKeyType="done" onSubmitEditing={handleRename} containerStyle={styles.renameInput} />
        <Button label="Save" onPress={handleRename} disabled={!renameValue.trim()} />
      </Modal>
    </View>
  );
}

export const SwimlaneColumn = memo(SwimlaneColumnBase, (prev, next) =>
  prev.lane.id    === next.lane.id &&
  prev.lane.name  === next.lane.name &&
  prev.lane.color === next.lane.color &&
  prev.cards      === next.cards
);

const COLUMN_WIDTH = 280;
const styles = StyleSheet.create({
  column:         { width: COLUMN_WIDTH, marginRight: 12, borderRadius: 12, overflow: 'hidden', flexShrink: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  colorDot:       { width: 10, height: 10, borderRadius: 5 },
  laneName:       { fontWeight: '600', flex: 1, letterSpacing: -0.2 },
  countBadge:     { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  countText:      { fontSize: 11, fontWeight: '600' },
  cardList:       { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 8, flexGrow: 1 },
  addButton:      { paddingHorizontal: 12, paddingVertical: 10 },
  addButtonText:  { fontSize: 13, fontWeight: '500' },
  addCardForm:    { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  addCardInput:   {},
  addCardActions: { flexDirection: 'row', gap: 8 },
  menuActions:    { gap: 10, paddingBottom: 8 },
  renameInput:    { marginBottom: 16 },
});