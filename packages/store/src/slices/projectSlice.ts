/**
 * Project store slice
 *
 * Tracks which project is currently open.
 * Actual project data is loaded from WatermelonDB via @kanban/database.
 */

import type { UUID } from '@kanban/types';
import { StateCreator } from 'zustand';

export interface ProjectSlice {
  activeProjectId: UUID | null;
  setActiveProject: (id: UUID) => void;
  clearActiveProject: () => void;
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
  activeProjectId: null,
  setActiveProject: (id) => set({ activeProjectId: id }),
  clearActiveProject: () => set({ activeProjectId: null }),
});
