/**
 * useSettings hook
 *
 * Bridges SettingsService with components and the Zustand store.
 *
 * Responsibilities:
 *   - Load the user's config on mount
 *   - Expose typed setter actions for every configurable field
 *   - Sync themeMode changes to Zustand immediately (so the whole app
 *     re-renders with the new theme without a reload)
 *   - Track isSaving per-field so individual rows can show a spinner
 *
 * Usage:
 *   const { settings, setThemeMode, setFontSize, isSaving } = useSettings();
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDatabase } from '@kanban/database';
import { useCurrentUser, useStore } from '@kanban/store';
import type { ThemeMode } from '@kanban/types';
import { SettingsService, type SettingsSnapshot } from './SettingsService';

export interface UseSettingsReturn {
  settings:         SettingsSnapshot | null;
  isLoading:        boolean;
  isSaving:         boolean;
  error:            string | null;
  clearError:       () => void;

  setThemeMode:     (mode: ThemeMode) => Promise<void>;
  setFontFamily:    (family: string) => Promise<void>;
  setFontSize:      (size: number) => Promise<void>;
  setDefaultLanes:  (names: string[], colors: string[]) => Promise<void>;
  setImageMaxSize:  (mb: number) => Promise<void>;
  setMarkdownDefault: (enabled: boolean) => Promise<void>;
  setSyncEndpoint:  (endpoint: string | null) => Promise<void>;
  setEnableSync:    (enabled: boolean) => Promise<void>;
  resetToDefaults:  () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const db          = useDatabase();
  const currentUser = useCurrentUser();
  const setTheme    = useStore((s) => s.setThemeMode);

  const [settings,  setSettings]  = useState<SettingsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const svc = useRef(new SettingsService(db));
  useEffect(() => { svc.current = new SettingsService(db); }, [db]);

  const clearError = useCallback(() => setError(null), []);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    svc.current
      .getSettings(currentUser.id)
      .then((s) => {
        setSettings(s);
        // Hydrate Zustand store with persisted theme
        if (s) setTheme(s.themeMode);
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setIsLoading(false));
  }, [currentUser, setTheme]);

  // ---------------------------------------------------------------------------
  // Generic update wrapper — handles loading state + optimistic local update
  // ---------------------------------------------------------------------------

  const update = useCallback(
    async (
      fn: (configId: string) => Promise<void>,
      patch: Partial<SettingsSnapshot>,
    ) => {
      if (!settings) return;
      setIsSaving(true);
      setError(null);

      // Optimistic update
      setSettings((prev) => prev ? { ...prev, ...patch } : prev);

      try {
        await fn(settings.id);
      } catch (err) {
        // Roll back
        setSettings((prev) => prev ? { ...prev, ...Object.fromEntries(
          Object.keys(patch).map((k) => [k, (settings as Record<string, unknown>)[k]])
        )} : prev);
        setError(err instanceof Error ? err.message : 'Failed to save settings.');
      } finally {
        setIsSaving(false);
      }
    },
    [settings],
  );

  // ---------------------------------------------------------------------------
  // Typed setters
  // ---------------------------------------------------------------------------

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      setTheme(mode); // Update Zustand immediately — whole app re-renders
      await update(
        (id) => svc.current.setThemeMode(id, mode),
        { themeMode: mode },
      );
    },
    [setTheme, update],
  );

  const setFontFamily = useCallback(
    (family: string) =>
      update((id) => svc.current.setFontFamily(id, family), { fontFamily: family }),
    [update],
  );

  const setFontSize = useCallback(
    (size: number) =>
      update((id) => svc.current.setFontSize(id, size), { fontSize: size }),
    [update],
  );

  const setDefaultLanes = useCallback(
    (names: string[], colors: string[]) =>
      update(
        (id) => svc.current.setDefaultSwimlanes(id, names, colors),
        { defaultSwimlanes: names, defaultLaneColors: colors },
      ),
    [update],
  );

  const setImageMaxSize = useCallback(
    (mb: number) =>
      update((id) => svc.current.setImageMaxSizeMb(id, mb), { imageMaxSizeMb: mb }),
    [update],
  );

  const setMarkdownDefault = useCallback(
    (enabled: boolean) =>
      update(
        (id) => svc.current.setMarkdownDefault(id, enabled),
        { markdownDefault: enabled },
      ),
    [update],
  );

  const setSyncEndpoint = useCallback(
    (endpoint: string | null) =>
      update(
        (id) => svc.current.setSyncEndpoint(id, endpoint),
        { syncEndpoint: endpoint },
      ),
    [update],
  );

  const setEnableSync = useCallback(
    (enabled: boolean) =>
      update((id) => svc.current.setEnableSync(id, enabled), { enableSync: enabled }),
    [update],
  );

  const resetToDefaults = useCallback(async () => {
    if (!settings) return;
    setIsSaving(true);
    setError(null);
    try {
      await svc.current.resetToDefaults(settings.id);
      // Re-fetch to get canonical defaults
      if (currentUser) {
        const fresh = await svc.current.getSettings(currentUser.id);
        setSettings(fresh);
        if (fresh) setTheme(fresh.themeMode);
      }
    } catch (err) {
      setError('Failed to reset settings.');
    } finally {
      setIsSaving(false);
    }
  }, [settings, currentUser, setTheme]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    clearError,
    setThemeMode,
    setFontFamily,
    setFontSize,
    setDefaultLanes,
    setImageMaxSize,
    setMarkdownDefault,
    setSyncEndpoint,
    setEnableSync,
    resetToDefaults,
  };
}
