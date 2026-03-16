/**
 * SegmentedControl
 *
 * A horizontal row of tappable segments — one active at a time.
 * Used for theme mode (Light / Dark / System), and anywhere a small
 * fixed set of options is more natural than a full picker.
 *
 * Renders natively on iOS using the system UISegmentedControl feel;
 * on Android and web it renders as a styled Pressable row.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface SegmentOption<T extends string = string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string = string> {
  options:   SegmentOption<T>[];
  value:     T;
  onChange:  (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.bgTertiary, borderColor: theme.colors.borderDefault },
      ]}
    >
      {options.map((opt, idx) => {
        const isActive = opt.value === value;
        const isLast   = idx === options.length - 1;

        return (
          <Pressable
            key={opt.value}
            onPress={() => !disabled && onChange(opt.value)}
            style={[
              styles.segment,
              !isLast && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.borderDefault },
              isActive && { backgroundColor: theme.colors.bgPrimary },
            ]}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: isActive, disabled }}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive
                    ? theme.colors.textPrimary
                    : theme.colors.textSecondary,
                  fontWeight: isActive ? '600' : '400',
                  fontSize: theme.typography.fontSizeSm,
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    borderRadius:   10,
    borderWidth:    1,
    overflow:       'hidden',
    alignSelf:      'flex-start',
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    alignItems:        'center',
    justifyContent:    'center',
    minWidth:          60,
  },
  label: {
    letterSpacing: 0.1,
  },
});
