/**
 * MarkdownToolbar
 *
 * A row of formatting buttons for the markdown editor.
 * Each button wraps or inserts markdown syntax around the current selection.
 *
 * Because React Native TextInput doesn't expose selection positions on all
 * platforms, we use a "wrap" strategy:
 *   - If selection has length > 0: wrap it with syntax (e.g. **selected**)
 *   - If selection is empty: insert a template and position cursor inside it
 *
 * The toolbar is a horizontal ScrollView so it fits on narrow screens.
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolbarAction {
  label:     string;
  /** Accessibility description */
  hint:      string;
  /** Markdown syntax to wrap selection with, or insert at cursor */
  prefix:    string;
  suffix?:   string;
  /** Template text inserted when selection is empty */
  template?: string;
}

export const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: 'B',   hint: 'Bold',         prefix: '**',   suffix: '**',   template: 'bold text' },
  { label: 'I',   hint: 'Italic',       prefix: '*',    suffix: '*',    template: 'italic text' },
  { label: '`',   hint: 'Inline code',  prefix: '`',    suffix: '`',    template: 'code' },
  { label: 'H1',  hint: 'Heading 1',    prefix: '# ',   suffix: '',     template: 'Heading' },
  { label: 'H2',  hint: 'Heading 2',    prefix: '## ',  suffix: '',     template: 'Heading' },
  { label: '—',   hint: 'Divider',      prefix: '\n---\n', suffix: '', template: '' },
  { label: '•',   hint: 'Bullet list',  prefix: '- ',   suffix: '',     template: 'Item' },
  { label: '>',   hint: 'Blockquote',   prefix: '> ',   suffix: '',     template: 'Quote' },
  { label: '~~',  hint: 'Strikethrough',prefix: '~~',   suffix: '~~',   template: 'text' },
  { label: '[]',  hint: 'Link',         prefix: '[',    suffix: '](url)', template: 'link text' },
  { label: '```', hint: 'Code block',   prefix: '```\n', suffix: '\n```', template: 'code here' },
];

export interface MarkdownToolbarProps {
  /** The full current text value */
  value: string;
  /** Current selection, if TextInput exposes it */
  selection?: { start: number; end: number };
  /** Called with the new string after applying a format action */
  onChange: (newValue: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Applies a toolbar action to the current text and selection.
 * Returns the new string value.
 */
export function applyToolbarAction(
  value:     string,
  selection: { start: number; end: number },
  action:    ToolbarAction,
): string {
  const { start, end } = selection;
  const selected = value.slice(start, end);
  const before   = value.slice(0, start);
  const after    = value.slice(end);

  if (selected.length > 0) {
    // Wrap the selection
    return `${before}${action.prefix}${selected}${action.suffix ?? ''}${after}`;
  } else {
    // Insert template at cursor
    const insert = action.template
      ? `${action.prefix}${action.template}${action.suffix ?? ''}`
      : action.prefix;
    return `${before}${insert}${after}`;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarkdownToolbar({ value, selection, onChange }: MarkdownToolbarProps) {
  const theme = useTheme();

  const currentSelection = selection ?? { start: value.length, end: value.length };

  const handleAction = useCallback(
    (action: ToolbarAction) => {
      const newValue = applyToolbarAction(value, currentSelection, action);
      onChange(newValue);
    },
    [value, currentSelection, onChange],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={[styles.toolbar, { backgroundColor: theme.colors.bgSecondary, borderColor: theme.colors.borderDefault }]}
    >
      {TOOLBAR_ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => handleAction(action)}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed ? theme.colors.bgTertiary : 'transparent',
              borderColor: theme.colors.borderDefault,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={action.hint}
          accessibilityHint={`Insert ${action.hint} formatting`}
        >
          <Text
            style={[
              styles.buttonLabel,
              {
                color: theme.colors.textSecondary,
                fontFamily: action.label === '`' || action.label === '```'
                  ? 'monospace'
                  : undefined,
              },
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toolbar:    { borderTopWidth: 1, borderBottomWidth: 1, maxHeight: 44 },
  container:  { paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  button:     {
    minWidth: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  buttonLabel: { fontSize: 13, fontWeight: '600' },
});
