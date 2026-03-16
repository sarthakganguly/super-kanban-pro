/**
 * Root store
 *
 * Composes all slices using Zustand's slice pattern.
 * Each slice owns its own state shape and actions — this file just wires them together.
 *
 * Usage:
 *   import { useStore } from '@kanban/store';
 *   const user = useStore(s => s.currentUser);
 *   const setUser = useStore(s => s.setCurrentUser);
 *
 * Performance note:
 *   Always use granular selectors so components only re-render when their
 *   specific slice of state changes. Avoid selecting the whole store object.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type AuthSlice, createAuthSlice } from './slices/authSlice';
import { type ProjectSlice, createProjectSlice } from './slices/projectSlice';
import { type UISlice, createUISlice } from './slices/uiSlice';

// Combined store type — extend here as new slices are added
export type RootStore = AuthSlice & ProjectSlice & UISlice;

export const useStore = create<RootStore>()(
  devtools(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createProjectSlice(...args),
      ...createUISlice(...args),
    }),
    {
      name: 'KanbanStore',
      // Only enable Redux DevTools in development
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// ---------------------------------------------------------------------------
// Typed selector hooks — memoized, granular
// These prevent unnecessary re-renders by selecting only what's needed.
// ---------------------------------------------------------------------------

export const useCurrentUser = () => useStore((s) => s.currentUser);
export const useIsAuthenticated = () => useStore((s) => s.isAuthenticated);
export const useActiveProjectId = () => useStore((s) => s.activeProjectId);
export const useThemeMode = () => useStore((s) => s.themeMode);
export const useIsLoading = () => useStore((s) => s.isLoading);
