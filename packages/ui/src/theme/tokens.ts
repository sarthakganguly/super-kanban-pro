/**
 * Design tokens
 *
 * The single source of truth for visual design values.
 * All components must consume these tokens — never hardcode colors or sizes.
 * Supports light and dark mode out of the box.
 */

export interface ColorPalette {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgCard: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;

  // Borders
  borderDefault: string;
  borderFocus: string;

  // Brand / interactive
  accent: string;
  accentPressed: string;

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Swimlane defaults (mirrored from DEFAULT_LANES in types)
  laneTodo: string;
  laneInProgress: string;
  laneDone: string;
}

export interface TypographyTokens {
  fontSizeXs: number;
  fontSizeSm: number;
  fontSizeMd: number;
  fontSizeLg: number;
  fontSizeXl: number;
  fontWeightRegular: string;
  fontWeightMedium: string;
  fontWeightBold: string;
  lineHeightTight: number;
  lineHeightNormal: number;
  lineHeightRelaxed: number;
}

export interface SpacingTokens {
  xs: number;    // 4
  sm: number;    // 8
  md: number;    // 16
  lg: number;    // 24
  xl: number;    // 32
  xxl: number;   // 48
}

export interface Theme {
  colors: ColorPalette;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  isDark: boolean;
}

// ---------------------------------------------------------------------------
// Light theme
// ---------------------------------------------------------------------------

const lightColors: ColorPalette = {
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  bgTertiary: '#F3F4F6',
  bgCard: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  borderDefault: '#E5E7EB',
  borderFocus: '#3B82F6',
  accent: '#3B82F6',
  accentPressed: '#2563EB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  laneTodo: '#6B7280',
  laneInProgress: '#3B82F6',
  laneDone: '#10B981',
};

// ---------------------------------------------------------------------------
// Dark theme
// ---------------------------------------------------------------------------

const darkColors: ColorPalette = {
  bgPrimary: '#111827',
  bgSecondary: '#1F2937',
  bgTertiary: '#374151',
  bgCard: '#1F2937',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textDisabled: '#6B7280',
  borderDefault: '#374151',
  borderFocus: '#60A5FA',
  accent: '#60A5FA',
  accentPressed: '#3B82F6',
  success: '#34D399',
  warning: '#FCD34D',
  error: '#F87171',
  info: '#60A5FA',
  laneTodo: '#9CA3AF',
  laneInProgress: '#60A5FA',
  laneDone: '#34D399',
};

// ---------------------------------------------------------------------------
// Shared token values (same for both themes)
// ---------------------------------------------------------------------------

const typography: TypographyTokens = {
  fontSizeXs: 11,
  fontSizeSm: 13,
  fontSizeMd: 15,
  fontSizeLg: 17,
  fontSizeXl: 20,
  fontWeightRegular: '400',
  fontWeightMedium: '500',
  fontWeightBold: '700',
  lineHeightTight: 1.25,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

const spacing: SpacingTokens = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

export const lightTheme: Theme = {
  colors: lightColors,
  typography,
  spacing,
  borderRadius,
  isDark: false,
};

export const darkTheme: Theme = {
  colors: darkColors,
  typography,
  spacing,
  borderRadius,
  isDark: true,
};
