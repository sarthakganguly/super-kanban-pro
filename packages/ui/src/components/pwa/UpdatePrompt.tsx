/**
 * UpdatePrompt
 *
 * Shown when a new version of the app is available (new SW waiting).
 *
 * UX flow:
 *   1. SW update detected → registration.waiting is set
 *   2. App renders UpdatePrompt at the bottom of the screen
 *   3. User taps "Update now" → SKIP_WAITING sent to SW → page reloads
 *   4. User taps "Later" → banner dismissed for this session (SW stays waiting)
 *
 * Why not auto-update?
 *   Auto-updating could interrupt the user mid-drag or mid-edit.
 *   Prompting lets the user choose a safe moment.
 *
 * Web-only component:
 *   On native, updates happen through the App Store / Play Store.
 *   This component returns null on non-web platforms.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface UpdatePromptProps {
  registration: ServiceWorkerRegistration | null;
}

export function UpdatePrompt({ registration }: UpdatePromptProps) {
  const theme = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(100)).current;

  const hasUpdate = !!registration?.waiting && !dismissed;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue:         hasUpdate ? 0 : 100,
      friction:        8,
      tension:         65,
      useNativeDriver: true,
    }).start();
  }, [hasUpdate, slideAnim]);

  const handleUpdate = useCallback(() => {
    if (!registration) return;
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    // The 'controllerchange' event on navigator.serviceWorker triggers a reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });
  }, [registration]);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  // Native builds don't have service workers
  if (Platform.OS !== 'web') return null;
  if (!hasUpdate) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bgCard,
          borderColor:     theme.colors.borderDefault,
          transform:       [{ translateY: slideAnim }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel="App update available"
    >
      <View style={styles.content}>
        <Text style={[styles.icon]}>🚀</Text>
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Update available
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Reload to get the latest version
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            { borderColor: theme.colors.borderDefault, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss update"
        >
          <Text style={[styles.btnText, { color: theme.colors.textSecondary }]}>
            Later
          </Text>
        </Pressable>
        <Pressable
          onPress={handleUpdate}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            { backgroundColor: theme.colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Install update now"
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>
            Update now
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:      'absolute',
    bottom:        24,
    left:          16,
    right:         16,
    borderRadius:  14,
    borderWidth:   1,
    padding:       16,
    gap:           12,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius:  12,
    elevation:     8,
    zIndex:        9999,
  },
  content:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon:       { fontSize: 24 },
  textGroup:  { flex: 1, gap: 2 },
  title:      { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  subtitle:   { fontSize: 12, fontWeight: '400' },
  actions:    { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  btnSecondary: { borderWidth: 1 },
  btnPrimary:   {},
  btnText:    { fontSize: 13, fontWeight: '600' },
});
