/**
 * SettingsRow
 *
 * A single settings row: label + optional sublabel on the left,
 * control on the right.
 *
 * The right-side control is passed as `children` — this lets callers
 * compose arbitrary controls (Switch, Picker, Text, custom) without
 * the row needing to know about them.
 *
 * Variants:
 *   default   — label + children side-by-side
 *   stacked   — label on top, children below (for long controls like sliders)
 *   pressable — the entire row is tappable (for navigation items)
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface SettingsRowProps {
  label:       string;
  sublabel?:   string;
  children?:   React.ReactNode;
  variant?:    'default' | 'stacked' | 'pressable';
  onPress?:    () => void;
  /** Show a chevron on the right for navigation rows */
  showChevron?: boolean;
  /** Tint the label red (for destructive actions like Reset) */
  destructive?: boolean;
}

export function SettingsRow({
  label,
  sublabel,
  children,
  variant      = 'default',
  onPress,
  showChevron  = false,
  destructive  = false,
}: SettingsRowProps) {
  const theme = useTheme();

  const labelColor = destructive ? theme.colors.error : theme.colors.textPrimary;

  const inner = (
    <View
      style={[
        styles.row,
        variant === 'stacked' && styles.rowStacked,
        { borderBottomColor: theme.colors.borderDefault },
      ]}
    >
      {/* Left side: label + optional sublabel */}
      <View style={[styles.labelGroup, variant === 'stacked' && styles.labelGroupStacked]}>
        <Text style={[styles.label, { color: labelColor, fontSize: theme.typography.fontSizeMd }]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.sublabel, { color: theme.colors.textSecondary, fontSize: theme.typography.fontSizeXs }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      {/* Right side: control or chevron */}
      {children ? (
        <View style={variant === 'stacked' ? styles.childrenStacked : styles.childrenDefault}>
          {children}
        </View>
      ) : null}

      {showChevron ? (
        <Text style={[styles.chevron, { color: theme.colors.textDisabled }]}>›</Text>
      ) : null}
    </View>
  );

  if (variant === 'pressable' || onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
}

// ---------------------------------------------------------------------------
// SettingsSection — groups rows under a titled section header
// ---------------------------------------------------------------------------

export interface SettingsSectionProps {
  title:    string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontSize: theme.typography.fontSizeXs }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionCard, { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderDefault }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  rowStacked: {
    flexDirection:  'column',
    alignItems:     'flex-start',
    paddingVertical: 12,
    gap: 10,
  },
  labelGroup: {
    flex:   1,
    gap:    2,
    paddingRight: 12,
  },
  labelGroupStacked: {
    paddingRight: 0,
    width: '100%',
  },
  label:    { fontWeight: '400', letterSpacing: -0.1 },
  sublabel: { lineHeight: 16, fontWeight: '400' },
  childrenDefault: {
    alignItems: 'flex-end',
  },
  childrenStacked: {
    width: '100%',
  },
  chevron: { fontSize: 20, fontWeight: '300', marginLeft: 4 },
  section: { gap: 8 },
  sectionTitle: {
    paddingHorizontal: 4,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
