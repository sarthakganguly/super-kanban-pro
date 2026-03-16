/**
 * AppNavigator — Phase 9 update
 *
 * Screen states:
 *   'projects' — ProjectListScreen
 *   'board'    — BoardScreen
 *   'settings' — SettingsScreen (new)
 *
 * A gear icon in the ProjectListScreen header navigates to settings.
 */

import React, { useCallback, useState } from 'react';
import { useAuth, useProjects } from '@kanban/services';
import { useStore } from '@kanban/store';
import { BoardScreen } from './board/BoardScreen';
import { ProjectListScreen } from './projects/ProjectListScreen';
import { SettingsScreen } from './settings/SettingsScreen';

type AppScreen = 'projects' | 'board' | 'settings';

interface BoardRoute {
  projectId:   string;
  projectName: string;
}

export function AppNavigator() {
  const { logout }         = useAuth();
  const clearActiveProject = useStore((s) => s.clearActiveProject);

  const [screen,     setScreen]     = useState<AppScreen>('projects');
  const [boardRoute, setBoardRoute] = useState<BoardRoute | null>(null);

  const handleOpenProject = useCallback((projectId: string, projectName: string) => {
    setBoardRoute({ projectId, projectName });
    setScreen('board');
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleBackToProjects = useCallback(() => {
    clearActiveProject();
    setBoardRoute(null);
    setScreen('projects');
  }, [clearActiveProject]);

  const handleOpenSettings = useCallback(() => {
    setScreen('settings');
  }, []);

  if (screen === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setScreen('projects')}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'board' && boardRoute) {
    return (
      <BoardScreen
        projectId={boardRoute.projectId}
        projectName={boardRoute.projectName}
        onBack={handleBackToProjects}
      />
    );
  }

  return (
    <ProjectListScreen
      onOpenProject={handleOpenProject}
      onLogout={handleLogout}
      onOpenSettings={handleOpenSettings}
    />
  );
}
