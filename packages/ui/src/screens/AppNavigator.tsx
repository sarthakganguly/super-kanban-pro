/**
 * AppNavigator — URL Routing update
 *
 * Screen states are now managed via `@react-navigation/stack`:
 *   'Projects' — ProjectListScreen
 *   'Board'    — BoardScreen (receives projectId, projectName, and optional cardId)
 *   'Settings' — SettingsScreen
 */

import React, { useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '@kanban/services';
import { useStore } from '@kanban/store';
import { BoardScreen } from './board/BoardScreen';
import { ProjectListScreen } from './projects/ProjectListScreen';
import { SettingsScreen } from './settings/SettingsScreen';

export type RootStackParamList = {
  Projects: undefined;
  Settings: undefined;
  Board: {
    projectId: string;
    projectName: string;
    cardId?: string | undefined;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

function ProjectListScreenWrapper() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();

  const handleOpenProject = useCallback((projectId: string, projectName: string) => {
    navigation.navigate('Board', { projectId, projectName });
  }, [navigation]);

  const handleOpenSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <ProjectListScreen
      onOpenProject={handleOpenProject}
      onLogout={handleLogout}
      onOpenSettings={handleOpenSettings}
    />
  );
}

function SettingsScreenWrapper() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();

  const handleBack = useCallback(() => {
    navigation.navigate('Projects');
  }, [navigation]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <SettingsScreen
      onBack={handleBack}
      onLogout={handleLogout}
    />
  );
}

function BoardScreenWrapper() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Board'>>();
  const { projectId, projectName, cardId } = route.params;
  const clearActiveProject = useStore((s) => s.clearActiveProject);

  const handleBack = useCallback(() => {
    clearActiveProject();
    navigation.navigate('Projects');
  }, [navigation, clearActiveProject]);

  const handleSelectCard = useCallback((cId: string) => {
    navigation.navigate('Board', { projectId, projectName, cardId: cId });
  }, [navigation, projectId, projectName]);

  const handleCloseCard = useCallback(() => {
    navigation.navigate('Board', { projectId, projectName, cardId: undefined });
  }, [navigation, projectId, projectName]);

  return (
    <BoardScreen
      projectId={projectId}
      projectName={projectName}
      cardId={cardId}
      onBack={handleBack}
      onSelectCard={handleSelectCard}
      onCloseCard={handleCloseCard}
    />
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Projects" component={ProjectListScreenWrapper} />
      <Stack.Screen name="Settings" component={SettingsScreenWrapper} />
      <Stack.Screen name="Board" component={BoardScreenWrapper} />
    </Stack.Navigator>
  );
}
