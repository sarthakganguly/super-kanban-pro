/**
 * ThemeProvider
 *
 * Wraps the app and provides the current theme via React context.
 * Respects the user's stored preference ('light' | 'dark' | 'system').
 * 'system' reads from Appearance (React Native) / matchMedia (web).
 *
 * Usage:
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 *
 *   const theme = useTheme();
 *   <View style={{ backgroundColor: theme.colors.bgPrimary }} />
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import { useThemeMode } from '@kanban/store';
import { darkTheme, lightTheme, type Theme } from './tokens';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<Theme>(lightTheme);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeMode = useThemeMode();

  // Track system color scheme for 'system' mode
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const resolveTheme = useCallback((): Theme => {
    switch (themeMode) {
      case 'light':
        return lightTheme;
      case 'dark':
        return darkTheme;
      case 'system':
        return systemScheme === 'dark' ? darkTheme : lightTheme;
    }
  }, [themeMode, systemScheme]);

  // Memoize so downstream components only re-render when the theme actually changes
  const theme = useMemo(() => resolveTheme(), [resolveTheme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the active theme object.
 * Throws if used outside a ThemeProvider.
 */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
