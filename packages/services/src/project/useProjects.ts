/**
 * useProjects hook
 *
 * Provides project CRUD operations to components.
 * Manages its own async state (isLoading, error) so callers
 * only need to think about what to do, not how to track it.
 *
 * Also exposes `projects` as a local list that stays in sync after mutations,
 * avoiding the need for a global refetch loop — mutations update the local
 * state optimistically/reactively.
 *
 * Usage:
 *   const { projects, createProject, isLoading } = useProjects();
 */

import { useCallback, useEffect, useState } from 'react';
import { useDatabase } from '@kanban/database';
import { useCurrentUser, useStore } from '@kanban/store';
import type { Project } from '@kanban/types';
import { ProjectError, ProjectService } from './ProjectService';

export interface UseProjectsReturn {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

  /** Loads all projects for the current user. Called automatically on mount. */
  loadProjects: () => Promise<void>;

  /** Creates a project and returns it. Adds to local list on success. */
  createProject: (name: string) => Promise<Project | null>;

  /** Renames a project in place. */
  renameProject: (projectId: string, newName: string) => Promise<void>;

  /** Soft-deletes a project. Removes from local list immediately. */
  deleteProject: (projectId: string) => Promise<void>;

  /** Sets the active project in Zustand so the board screen can read it. */
  openProject: (projectId: string) => void;
}

export function useProjects(): UseProjectsReturn {
  const db          = useDatabase();
  const currentUser = useCurrentUser();
  const setActive   = useStore((s) => s.setActiveProject);

  const [projects,  setProjects]  = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const getService = useCallback(() => new ProjectService(db), [db]);
  const clearError = useCallback(() => setError(null), []);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadProjects = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await getService().listProjects(currentUser.id);
      setProjects(list);
    } catch (err) {
      setError(err instanceof ProjectError ? err.message : 'Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, getService]);

  // Auto-load on mount / when user changes
  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  const createProject = useCallback(
    async (name: string): Promise<Project | null> => {
      if (!currentUser) return null;
      setIsLoading(true);
      setError(null);
      try {
        const project = await getService().createProject(currentUser.id, name);
        // Prepend so newest appears at top
        setProjects((prev) => [project, ...prev]);
        return project;
      } catch (err) {
        setError(err instanceof ProjectError ? err.message : 'Failed to create project.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser, getService],
  );

  // ---------------------------------------------------------------------------
  // Rename
  // ---------------------------------------------------------------------------

  const renameProject = useCallback(
    async (projectId: string, newName: string): Promise<void> => {
      if (!currentUser) return;
      setError(null);
      try {
        const updated = await getService().renameProject(
          projectId,
          currentUser.id,
          newName,
        );
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? updated : p)),
        );
      } catch (err) {
        setError(err instanceof ProjectError ? err.message : 'Failed to rename project.');
        throw err;
      }
    },
    [currentUser, getService],
  );

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const deleteProject = useCallback(
    async (projectId: string): Promise<void> => {
      if (!currentUser) return;
      setError(null);
      try {
        await getService().deleteProject(projectId, currentUser.id);
        // Remove immediately from local list — no need to refetch
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } catch (err) {
        setError(err instanceof ProjectError ? err.message : 'Failed to delete project.');
        throw err;
      }
    },
    [currentUser, getService],
  );

  // ---------------------------------------------------------------------------
  // Open
  // ---------------------------------------------------------------------------

  const openProject = useCallback(
    (projectId: string) => {
      setActive(projectId);
    },
    [setActive],
  );

  return {
    projects,
    isLoading,
    error,
    clearError,
    loadProjects,
    createProject,
    renameProject,
    deleteProject,
    openProject,
  };
}
