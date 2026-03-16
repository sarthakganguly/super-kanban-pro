/**
 * MarkdownEditor
 *
 * A markdown editor with two modes:
 *   edit    — plain TextInput + MarkdownToolbar for formatting shortcuts
 *   preview — MarkdownRenderer for the full rendered output
 *
 * A segmented control at the top switches between modes.
 * The toolbar is only visible in edit mode.
 *
 * Auto-save:
 *   onChange is called on every keystroke. The caller (CardDetailScreen)
 *   debounces the actual DB write so the editor feels instant.
 *
 * Usage:
 *   <MarkdownEditor
 *     value={descriptionMarkdown}
 *     onChange={setDescription}
 *     placeholder="Add a description…"
 *   />
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MarkdownToolbar } from './MarkdownToolbar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorMode = 'edit' | 'preview';

export interface MarkdownEditorProps {
  value:       string;
  onChange:    (value: string) => void;
  placeholder?: string;
  minHeight?:  number;
  autoFocus?:  boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Add a description… (supports Markdown)',
  minHeight   = 180,
  autoFocus   = false,
}: MarkdownEditorProps) {
  const theme = useTheme();
  const [mode, setMode] = useState<EditorMode>('edit');

  // Track selection so toolbar can wrap the selected text
  const [selection, setSelection] = useState<{ start: number; end: number }>(
    { start: 0, end: 0 },
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setSelection(e.nativeEvent.selection);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.root}>
      {/* Mode toggle */}
      <ModeToggle mode={mode} onToggle={setMode} />

      {/* Toolbar (edit mode only) */}
      {mode === 'edit' && (
        <MarkdownToolbar
          value={value}
          selection={selection}
          onChange={onChange}
        />
      )}

      {/* Content area */}
      {mode === 'edit' ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          onSelectionChange={handleSelectionChange}
          multiline
          textAlignVertical="top"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textDisabled}
          autoFocus={autoFocus}
          style={[
            styles.input,
            {
              minHeight,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.bgPrimary,
              borderColor: theme.colors.borderDefault,
              fontSize: theme.typography.fontSizeSm,
              fontFamily: 'monospace',
            },
          ]}
          accessibilityLabel="Description editor"
          accessibilityHint="Edit the card description in Markdown"
        />
      ) : (
        <View
          style={[
            styles.preview,
            {
              minHeight,
              backgroundColor: theme.colors.bgPrimary,
              borderColor: theme.colors.borderDefault,
            },
          ]}
        >
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <Text style={[styles.emptyPreview, { color: theme.colors.textDisabled }]}>
              Nothing to preview yet.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ModeToggle — Edit / Preview segmented control
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  onToggle,
}: {
  mode:     EditorMode;
  onToggle: (mode: EditorMode) => void;
}) {
  const theme = useTheme();

  const buttonStyle = (active: boolean) => ({
    backgroundColor: active ? theme.colors.accent : 'transparent',
    borderColor:     active ? theme.colors.accent : theme.colors.borderDefault,
  });

  const textStyle = (active: boolean) => ({
    color: active ? '#fff' : theme.colors.textSecondary,
  });

  return (
    <View style={[styles.toggle, { borderColor: theme.colors.borderDefault }]}>
      {(['edit', 'preview'] as EditorMode[]).map((m) => (
        <Pressable
          key={m}
          onPress={() => onToggle(m)}
          style={[styles.toggleButton, buttonStyle(mode === m)]}
          accessibilityRole="tab"
          accessibilityLabel={m === 'edit' ? 'Edit mode' : 'Preview mode'}
          accessibilityState={{ selected: mode === m }}
        >
          <Text style={[styles.toggleLabel, textStyle(mode === m)]}>
            {m === 'edit' ? 'Edit' : 'Preview'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { gap: 0 },

  toggle: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  input: {
    borderWidth: 0,
    borderTopWidth: 1,
    padding: 14,
    lineHeight: 22,
  },

  preview: {
    borderWidth: 0,
    borderTopWidth: 1,
    padding: 14,
  },
  emptyPreview: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});
