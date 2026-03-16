/**
 * IconButton
 *
 * Small pressable button used in navigation headers and list item rows.
 * Renders a label (which should be a single glyph or short text).
 * Always includes an accessibilityLabel for screen readers.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface IconButtonProps extends PressableProps {
  icon: string;
  accessibilityLabel: string;
  size?: number;
  color?: string;
}

export function IconButton({
  icon,
  accessibilityLabel,
  size = 22,
  color,
  style,
  ...rest
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.base,
        { opacity: pressed ? 0.6 : 1 },
        style as object,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={{ fontSize: size, color: color ?? theme.colors.textPrimary }}>
        {icon}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
});
