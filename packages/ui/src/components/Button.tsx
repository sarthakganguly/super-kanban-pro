/**
 * Button
 *
 * Shared button component with three visual variants:
 *   'primary'     — filled accent color, used for main CTAs
 *   'secondary'   — outlined, used for secondary actions
 *   'destructive' — filled error color, used for delete/logout
 *
 * Loading state shows an ActivityIndicator and disables the button.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  label,
  variant = 'primary',
  isLoading = false,
  size = 'md',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme      = useTheme();
  const isDisabled = disabled || isLoading;

  // Resolve colors per variant
  const bgColor = variant === 'primary'
    ? theme.colors.accent
    : variant === 'destructive'
    ? theme.colors.error
    : 'transparent';

  const borderColor = variant === 'secondary'
    ? theme.colors.borderDefault
    : 'transparent';

  const textColor = variant === 'secondary'
    ? theme.colors.textPrimary
    : '#FFFFFF';

  const padding = size === 'sm'
    ? { paddingVertical: 8,  paddingHorizontal: 14 }
    : size === 'lg'
    ? { paddingVertical: 16, paddingHorizontal: 24 }
    : { paddingVertical: 13, paddingHorizontal: 20 };

  const fontSize = size === 'sm'
    ? theme.typography.fontSizeSm
    : size === 'lg'
    ? theme.typography.fontSizeLg
    : theme.typography.fontSizeMd;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        padding,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style as object,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' ? theme.colors.accent : '#FFFFFF'}
        />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize, fontWeight: '600' }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    letterSpacing: 0.2,
  },
});
