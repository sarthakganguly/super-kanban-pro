/**
 * TextInput
 *
 * Themed text input used across all forms.
 * Wraps React Native's TextInput with consistent styling and accessibility.
 *
 * Features:
 *   - Label above the input
 *   - Inline error message below
 *   - Focus ring (borderFocus color)
 *   - Full secureTextEntry support for password fields
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextInputProps extends RNTextInputProps {
  label: string;
  error?: string | null;
  containerStyle?: object;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TextInput({
  label,
  error,
  containerStyle,
  style,
  ...rest
}: TextInputProps) {
  const theme    = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.error
    : focused
    ? theme.colors.borderFocus
    : theme.colors.borderDefault;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        style={[
          styles.label,
          { color: theme.colors.textSecondary, fontSize: theme.typography.fontSizeSm },
        ]}
      >
        {label}
      </Text>

      <RNTextInput
        {...rest}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.bgSecondary,
            borderColor,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSizeMd,
          },
          style,
        ]}
        placeholderTextColor={theme.colors.textDisabled}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        accessibilityLabel={label}
        accessibilityState={{ disabled: rest.editable === false }}
      />

      {error ? (
        <Text
          style={[
            styles.error,
            { color: theme.colors.error, fontSize: theme.typography.fontSizeXs },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    fontWeight: '400',
  },
});
