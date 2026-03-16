/**
 * Auth store slice
 *
 * Manages the currently authenticated user.
 * Authentication logic (hashing, DB queries) lives in @kanban/services.
 * This slice only holds the result.
 */

import type { User } from '@kanban/types';
import { StateCreator } from 'zustand';

export interface AuthSlice {
  // State
  currentUser: User | null;
  isAuthenticated: boolean;

  // Actions
  setCurrentUser: (user: User) => void;
  clearCurrentUser: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  currentUser: null,
  isAuthenticated: false,

  setCurrentUser: (user) =>
    set({ currentUser: user, isAuthenticated: true }),

  clearCurrentUser: () =>
    set({ currentUser: null, isAuthenticated: false }),
});
