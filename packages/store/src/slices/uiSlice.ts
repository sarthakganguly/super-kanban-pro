/**
 * UI store slice
 *
 * Global UI state: theme, loading indicators, modal visibility.
 * Kept minimal — component-local state should stay in components.
 */

import type { ThemeMode } from '@kanban/types';
import { StateCreator } from 'zustand';

export interface UISlice {
  themeMode: ThemeMode;
  isLoading: boolean;
  loadingMessage: string | null;

  setThemeMode: (mode: ThemeMode) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  themeMode: 'system',
  isLoading: false,
  loadingMessage: null,

  setThemeMode: (mode) => set({ themeMode: mode }),

  setLoading: (loading, message = null) =>
    set({ isLoading: loading, loadingMessage: loading ? message : null }),
});
