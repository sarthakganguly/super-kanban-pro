/**
 * apps/mobile — App.tsx
 *
 * Root component for the React Native mobile app (iOS + Android).
 *
 * Provider order (outermost → innermost):
 *   ThemeProvider         — design tokens, light/dark mode
 *   DatabaseContextProvider — WatermelonDB + repositories (SQLite adapter)
 *   [Phase 3] AuthGate    — redirects to login if not authenticated
 *   AppContent            — actual screens
 */

import React, { useMemo } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { createDatabaseProvider, DatabaseContextProvider } from '@kanban/database';
import { AuthGate, AppNavigator, ThemeProvider, useTheme } from '@kanban/ui';
import { createSQLiteAdapter } from '@kanban/adapters-sqlite';

const sqliteAdapter    = createSQLiteAdapter('kanban.db');
const databaseProvider = createDatabaseProvider(sqliteAdapter);

function AppShell() {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bgPrimary }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.bgPrimary}
      />
      <AppNavigator />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DatabaseContextProvider provider={databaseProvider}>
        <AuthGate>
          <AppShell />
        </AuthGate>
      </DatabaseContextProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
