/**
 * RegisterScreen
 *
 * New user registration form.
 *
 * UX decisions:
 *   - Confirm password field validates on blur, not on every keystroke
 *   - Username validation fires after the field loses focus (not while typing)
 *   - Password fields use secureTextEntry
 *   - Submit disabled until all fields are non-empty and passwords match
 *   - Server errors (e.g. username taken) shown inline
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
import { validatePassword, validateUsername } from '@kanban/services';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterScreenProps {
  onRegisterSuccess?: () => void;
  onNavigateToLogin?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterScreen({
  onRegisterSuccess,
  onNavigateToLogin,
}: RegisterScreenProps) {
  const theme = useTheme();
  const { register, isLoading, error: serverError, clearError } = useAuth();

  const [username,        setUsername]        = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Field-level validation errors (different from server error)
  const [usernameError,        setUsernameError]        = useState<string | null>(null);
  const [passwordError,        setPasswordError]        = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const passwordRef        = useRef<RNTextInput>(null);
  const confirmPasswordRef = useRef<RNTextInput>(null);

  // ---------------------------------------------------------------------------
  // Field validators (run on blur)
  // ---------------------------------------------------------------------------

  const validateUsernameField = useCallback(() => {
    const result = validateUsername(username);
    setUsernameError(result.valid ? null : result.error);
    return result.valid;
  }, [username]);

  const validatePasswordField = useCallback(() => {
    const result = validatePassword(password);
    setPasswordError(result.valid ? null : result.error);
    return result.valid;
  }, [password]);

  const validateConfirmField = useCallback(() => {
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  }, [password, confirmPassword]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const canSubmit =
    username.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !isLoading;

  const handleSubmit = useCallback(async () => {
    // Run all validators before submitting
    const uOk = validateUsernameField();
    const pOk = validatePasswordField();
    const cOk = validateConfirmField();
    if (!uOk || !pOk || !cOk) return;

    try {
      await register(username.trim(), password);
      onRegisterSuccess?.();
    } catch {
      // Server error is displayed via serverError from useAuth
    }
  }, [
    validateUsernameField,
    validatePasswordField,
    validateConfirmField,
    register,
    username,
    password,
    onRegisterSuccess,
  ]);

  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
    if (usernameError) setUsernameError(null);
    if (serverError)   clearError();
  }, [usernameError, serverError, clearError]);

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
            Create account
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Your data stays on this device
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
            onBlur={validateUsernameField}
            editable={!isLoading}
            error={usernameError ?? serverError}
          />

          <TextInput
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(null);
            }}
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            onBlur={validatePasswordField}
            editable={!isLoading}
            error={passwordError}
          />

          <TextInput
            ref={confirmPasswordRef}
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmPasswordError) setConfirmPasswordError(null);
            }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            onBlur={validateConfirmField}
            editable={!isLoading}
            error={confirmPasswordError}
          />

          <Button
            label="Create account"
            onPress={handleSubmit}
            isLoading={isLoading}
            disabled={!canSubmit}
            size="lg"
            style={styles.submitButton}
          />
        </View>

        {/* Login link */}
        {onNavigateToLogin ? (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Pressable
              onPress={onNavigateToLogin}
              accessibilityRole="link"
              accessibilityLabel="Sign in instead"
            >
              <Text style={[styles.link, { color: theme.colors.accent }]}>
                Sign in
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1 },
  scroll:       { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48, gap: 24 },
  header:       { gap: 6, alignItems: 'center' },
  title:        { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle:     { fontSize: 15, fontWeight: '400' },
  card:         { borderRadius: 16, borderWidth: 1, padding: 20, gap: 16 },
  submitButton: { marginTop: 4 },
  footer:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText:   { fontSize: 14 },
  link:         { fontSize: 14, fontWeight: '600' },
});
