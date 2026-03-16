import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createDatabaseProvider, DatabaseContextProvider } from '@kanban/database';
import { AppNavigator, AuthGate, ThemeProvider } from '@kanban/ui';
import { createIndexedDBAdapter } from '@kanban/adapters-indexeddb';

const indexedDBAdapter = createIndexedDBAdapter('kanban');
const databaseProvider = createDatabaseProvider(indexedDBAdapter);

export default function App() {
  return (
    <ThemeProvider>
      <DatabaseContextProvider provider={databaseProvider}>
        <AuthGate>
          <View style={styles.root}>
            <AppNavigator />
          </View>
        </AuthGate>
      </DatabaseContextProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100vh' as unknown as number },
});
