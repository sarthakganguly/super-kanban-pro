import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDatabaseProvider, DatabaseContextProvider } from '@kanban/database';
import { AppNavigator, AuthGate, ThemeProvider } from '@kanban/ui';
import { createIndexedDBAdapter } from '@kanban/adapters-indexeddb';

const indexedDBAdapter = createIndexedDBAdapter('kanban');
const databaseProvider = createDatabaseProvider(indexedDBAdapter);

const linking = {
  prefixes: [window.location.origin],
  config: {
    screens: {
      Projects: {
        path: '',
      },
      Settings: 'settings',
      Board: 'board/:projectId/card/:cardId?',
    },
  },
};

export default function App() {
  return (
    <ThemeProvider>
      <DatabaseContextProvider provider={databaseProvider}>
        <AuthGate>
          <View style={styles.root}>
            <NavigationContainer linking={linking}>
              <AppNavigator />
            </NavigationContainer>
          </View>
        </AuthGate>
      </DatabaseContextProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100vh' as unknown as number },
});
