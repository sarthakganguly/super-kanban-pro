/**
 * TagInput
 *
 * Displays a card's current tags as removable pills and provides an input
 * field for adding new tags with autocomplete.
 *
 * UX flow:
 *   1. User taps "+ Add tag" or types in the input
 *   2. As they type, a dropdown shows matching existing tags
 *   3. User can select a suggestion or press Enter/Return to create new
 *   4. Tag appears as a colored pill above the input
 *   5. Tapping × on a pill removes the tag
 *
 * The component is fully controlled: it receives tags as props and calls
 * onAdd/onRemove callbacks. Tag persistence happens in the parent
 * (CardDetailScreen calls TagService).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { TagSummary } from '../../../services/src/tag/TagService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagInputProps {
  /** Current tags attached to the card */
  tags:         TagSummary[];
  /** Called when user adds a tag (name not yet an ID) */
  onAdd:        (name: string) => Promise<void>;
  /** Called when user removes a tag */
  onRemove:     (tagId: string) => Promise<void>;
  /** Autocomplete lookup — provided by parent */
  onAutocomplete: (prefix: string) => Promise<TagSummary[]>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagInput({ tags, onAdd, onRemove, onAutocomplete }: TagInputProps) {
  const theme = useTheme();

  const [inputValue,   setInputValue]   = useState('');
  const [suggestions,  setSuggestions]  = useState<TagSummary[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAdding,     setIsAdding]     = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Autocomplete
  // ---------------------------------------------------------------------------

  const fetchSuggestions = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      const prefix = text.startsWith('#') ? text.slice(1) : text;
      const results = await onAutocomplete(prefix);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    },
    [onAutocomplete],
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInputValue(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void fetchSuggestions(text), 200);
    },
    [fetchSuggestions],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Add tag
  // ---------------------------------------------------------------------------

  const handleAdd = useCallback(
    async (name: string) => {
      const trimmed = name.trim().replace(/^#/, '');
      if (!trimmed) return;

      setIsAdding(true);
      setInputValue('');
      setSuggestions([]);
      setShowDropdown(false);

      await onAdd(trimmed);
      setIsAdding(false);
    },
    [onAdd],
  );

  const handleSelectSuggestion = useCallback(
    async (tag: TagSummary) => {
      await handleAdd(tag.name);
    },
    [handleAdd],
  );

  const handleSubmit = useCallback(() => {
    void handleAdd(inputValue);
  }, [handleAdd, inputValue]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.root}>
      {/* Tag pills */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {tags.map((tag) => (
            <TagPill
              key={tag.id}
              tag={tag}
              onRemove={() => void onRemove(tag.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { borderColor: theme.colors.borderDefault, backgroundColor: theme.colors.bgSecondary }]}>
        <Text style={[styles.hashSymbol, { color: theme.colors.textDisabled }]}>#</Text>
        <TextInput
          value={inputValue}
          onChangeText={handleInputChange}
          onSubmitEditing={handleSubmit}
          placeholder="Add tag…"
          placeholderTextColor={theme.colors.textDisabled}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isAdding}
          style={[
            styles.input,
            { color: theme.colors.textPrimary, fontSize: theme.typography.fontSizeSm },
          ]}
          accessibilityLabel="Add hashtag"
        />
      </View>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.borderDefault,
              shadowColor: '#000',
            },
          ]}
        >
          {suggestions.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => void handleSelectSuggestion(tag)}
              style={({ pressed }) => [
                styles.suggestion,
                { backgroundColor: pressed ? theme.colors.bgTertiary : 'transparent' },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Add tag ${tag.name}`}
            >
              <View style={[styles.suggestionDot, { backgroundColor: tag.color }]} />
              <Text style={[styles.suggestionText, { color: theme.colors.textPrimary }]}>
                #{tag.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TagPill
// ---------------------------------------------------------------------------

function TagPill({
  tag,
  onRemove,
}: {
  tag:      TagSummary;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: tag.color + '22', borderColor: tag.color + '55' }]}>
      <Text style={[styles.pillText, { color: tag.color }]}>
        #{tag.name}
      </Text>
      <Pressable
        onPress={onRemove}
        style={styles.pillRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`Remove tag ${tag.name}`}
      >
        <Text style={[styles.pillRemoveText, { color: tag.color }]}>×</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root:            { gap: 8 },
  pillsRow:        { gap: 6, paddingVertical: 2 },
  pill:            { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingLeft: 10, paddingRight: 6, paddingVertical: 4, gap: 4 },
  pillText:        { fontSize: 12, fontWeight: '600' },
  pillRemove:      { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pillRemoveText:  { fontSize: 16, lineHeight: 18, fontWeight: '400' },
  inputRow:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 38 },
  hashSymbol:      { fontSize: 15, marginRight: 2 },
  input:           { flex: 1, height: '100%' },
  dropdown:        {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  suggestion:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  suggestionDot:   { width: 8, height: 8, borderRadius: 4 },
  suggestionText:  { fontSize: 14, fontWeight: '500' },
});
