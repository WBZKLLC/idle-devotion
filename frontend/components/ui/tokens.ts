// /app/frontend/components/ui/tokens.ts
// Design system tokens - single source of truth for spacing, colors, typography

import COLORS from '../../theme/colors';

// =============================================================================
// SPACING (8pt grid)
// =============================================================================
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================
export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  display: 32,
} as const;

export const FONT_WEIGHT = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// =============================================================================
// TOUCH TARGETS (accessibility)
// =============================================================================
export const TOUCH_TARGET = {
  min: 44, // iOS minimum
  android: 48, // Material Design minimum
} as const;

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================
export const LAYOUT = {
  /** Standard screen horizontal padding */
  SCREEN_PADDING: 16,
  /** Bottom gutter for scroll content (prevents home indicator overlap on iOS) */
  BOTTOM_GUTTER: 16,
  /** Tab bar safe padding (when tabs are visible) */
  TAB_BAR_HEIGHT: 65,
} as const;

// =============================================================================
// SHADOWS
// =============================================================================
export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// =============================================================================
// PREMIUM COLORS (from UX spec)
// =============================================================================
export const PREMIUM_COLORS = {
  gold: '#FFD700',
  green: '#22C55E',
  purple: '#A855F7',
  blue: '#3B82F6',
  amber: '#F59E0B',
} as const;

// Re-export theme colors for convenience
export { COLORS };
