/**
 * useAuth hook
 *
 * The bridge between AuthService (business logic) and components.
 * Components call useAuth() — they never instantiate AuthService directly.
 *
 * Responsibilities:
 *   - Expose login, register, logout, and restoreSession actions
 *   - Write results into the Zustand store (setCurrentUser / clearCurrentUser)
 *   - Track loading and error state locally so callers can show spinners/errors
 *   - Run restoreSession on mount (used by AuthGate)
 *
 * Usage:
 *   const { login, isLoading, error } = useAuth();
 *   await login('alice', 'password123');
 */

import { useCallback, useState } from 'react';
import { useDatabase } from '@kanban/database';
import { ThumbnailCache } from '../thumbnail/ThumbnailCache';
import { useStore } from '@kanban/store';
import { AuthError, AuthService } from '../auth/AuthService';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseAuthReturn {
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

  /** Registers a new user and logs them in */
  register: (username: string, password: string) => Promise<void>;

  /** Logs in an existing user */
  login: (username: string, password: string) => Promise<void>;

  /** Logs out the current user */
  logout: () => Promise<void>;

  /**
   * Restores a persisted session.
   * Returns true if a valid session was found, false otherwise.
   * Called automatically by AuthGate on mount.
   */
  restoreSession: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): UseAuthReturn {
  const db             = useDatabase();
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const clearCurrentUser = useStore((s) => s.clearCurrentUser);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Lazily construct AuthService from the current db reference.
  // This is safe because db is a stable singleton reference.
  const getService = useCallback(
    () => new AuthService(db),
    [db],
  );

  const clearError = useCallback(() => setError(null), []);

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  const register = useCallback(
    async (username: string, password: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const user = await getService().register(username, password);
        setCurrentUser(user);
      } catch (err) {
        const message = err instanceof AuthError
          ? err.message
          : 'Registration failed. Please try again.';
        setError(message);
        throw err; // Re-throw so the screen can react if needed
      } finally {
        setIsLoading(false);
      }
    },
    [getService, setCurrentUser],
  );

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const user = await getService().login(username, password);
        setCurrentUser(user);
      } catch (err) {
        const message = err instanceof AuthError
          ? err.message
          : 'Login failed. Please try again.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, setCurrentUser],
  );

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await getService().logout();
      clearCurrentUser();
      ThumbnailCache.getInstance().clear();
    } catch {
      // Logout errors are non-fatal — clear local state regardless
      clearCurrentUser();
    } finally {
      setIsLoading(false);
    }
  }, [getService, clearCurrentUser]);

  // ---------------------------------------------------------------------------
  // restoreSession
  // ---------------------------------------------------------------------------

  const restoreSession = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const user = await getService().restoreSession();
      if (user) {
        setCurrentUser(user);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getService, setCurrentUser]);

  return {
    isLoading,
    error,
    clearError,
    register,
    login,
    logout,
    restoreSession,
  };
}
