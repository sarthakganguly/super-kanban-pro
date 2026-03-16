/**
 * LoginScreen
 *
 * Login form screen.
 *
 * UX decisions:
 *   - Username input auto-focuses on mount for fast keyboard entry
 *   - Return key on username field jumps focus to password field
 *   - Return key on password field submits the form
 *   - Loading state disables both fields and shows spinner in button
 *   - Error from AuthService is displayed inline, not as a modal
 *   - "Don't have an account?" link navigates to RegisterScreen
 *
 * The screen accepts an `onNavigateToRegister` prop for navigation,
 * keeping it decoupled from any specific navigation library.
 * React Navigation wiring happens in the app-level navigator (Phase 4+).
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useAuth } from '@kanban/services';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginScreenProps {
  onLoginSuccess?: () => void;
  onNavigateToRegister?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoginScreen({
  onLoginSuccess,
  onNavigateToRegister,
}: LoginScreenProps) {
  const theme = useTheme();
  const { login, isLoading, error, clearError } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Ref for jumping focus from username → password on Return key
  const passwordRef = useRef<RNTextInput>(null);

  const handleSubmit = useCallback(async () => {
    if (!username.trim() || !password) return;

    try {
      await login(username.trim(), password);
      onLoginSuccess?.();
    } catch {
      // Error is already set in useAuth — nothing extra to do here
    }
  }, [login, username, password, onLoginSuccess]);

  const handleUsernameChange = useCallback((text: string) => {
    if (error) clearError();
    setUsername(text);
  }, [error, clearError]);

  const handlePasswordChange = useCallback((text: string) => {
    if (error) clearError();
    setPassword(text);
  }, [error, clearError]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Welcome back
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Sign in to your board
          </Text>
        </View>

        {/* Form card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.borderDefault,
            },
          ]}
        >
          <TextInput
            label="Username"
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isLoading}
            containerStyle={styles.inputContainer}
          />

          <TextInput
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={handlePasswordChange}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!isLoading}
            error={error}
            containerStyle={styles.inputContainer}
          />

          <Button
            label="Sign in"
            onPress={handleSubmit}
            isLoading={isLoading}
            disabled={!username.trim() || !password}
            size="lg"
            style={styles.submitButton}
          />
        </View>

        {/* Register link */}
        {onNavigateToRegister ? (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <Pressable
              onPress={onNavigateToRegister}
              accessibilityRole="link"
              accessibilityLabel="Create a new account"
            >
              <Text style={[styles.link, { color: theme.colors.accent }]}>
                Create one
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 24,
  },
  header: {
    gap: 6,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  inputContainer: {
    // Spacing handled by card gap
  },
  submitButton: {
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
});
