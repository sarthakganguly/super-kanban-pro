/**
 * AuthGate
 *
 * Routing guard that sits between the providers and the main app.
 *
 * On mount it calls restoreSession(). While that's in flight it shows a
 * loading screen. After resolving:
 *   - If authenticated → renders `children` (the main app)
 *   - If not authenticated → renders the auth flow (Login / Register)
 *
 * Internal navigation between Login and Register is handled with a simple
 * local state toggle — no external navigation library needed at this phase.
 * Full React Navigation integration happens in Phase 4.
 *
 * Usage:
 *   <AuthGate>
 *     <MainApp />
 *   </AuthGate>
 */

import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@kanban/services';
import { useIsAuthenticated } from '@kanban/store';
import { useTheme } from '../theme/ThemeProvider';
import { LoginScreen } from './auth/LoginScreen';
import { RegisterScreen } from './auth/RegisterScreen';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthScreen = 'login' | 'register';

interface AuthGateProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuthGate({ children }: AuthGateProps) {
  const theme           = useTheme();
  const isAuthenticated = useIsAuthenticated();
  const { restoreSession } = useAuth();

  const [isRestoring, setIsRestoring]     = useState(true);
  const [activeScreen, setActiveScreen]   = useState<AuthScreen>('login');

  // Attempt to restore a persisted session on first render
  useEffect(() => {
    let cancelled = false;

    restoreSession().finally(() => {
      if (!cancelled) setIsRestoring(false);
    });

    return () => { cancelled = true; };
  // restoreSession is stable (wrapped in useCallback) — safe dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Loading splash — shown while session restore is in progress
  // ---------------------------------------------------------------------------

  if (isRestoring) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Authenticated — render main app
  // ---------------------------------------------------------------------------

  if (isAuthenticated) {
    return <>{children}</>;
  }

  // ---------------------------------------------------------------------------
  // Unauthenticated — render login or register screen
  // ---------------------------------------------------------------------------

  if (activeScreen === 'register') {
    return (
      <RegisterScreen
        onRegisterSuccess={() => {
          // Store will flip isAuthenticated — AuthGate re-renders into children
        }}
        onNavigateToLogin={() => setActiveScreen('login')}
      />
    );
  }

  return (
    <LoginScreen
      onLoginSuccess={() => {
        // Store flip drives re-render
      }}
      onNavigateToRegister={() => setActiveScreen('register')}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
