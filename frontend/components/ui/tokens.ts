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
// LIST ROW TOKENS (Phase 3.22.5)
// =============================================================================
export const LIST = {
  /** Minimum row height for touch accessibility */
  ROW_MIN_HEIGHT: 56,
  /** Horizontal padding inside rows */
  ROW_PAD_X: 14,
  /** Vertical padding inside rows */
  ROW_PAD_Y: 12,
  /** Gap between rows (gap-based separation, not borders) */
  ROW_GAP: 12,
  /** Leading icon/avatar container size */
  LEADING_SIZE: 44,
  /** Icon size inside leading container */
  LEADING_ICON: 22,
  /** Trailing chevron/icon size */
  TRAILING_ICON: 18,
} as const;

/** Dense variant for compact lists (optional) */
export const LIST_DENSE = {
  ROW_MIN_HEIGHT: 48,
  ROW_PAD_X: 12,
  ROW_PAD_Y: 10,
  ROW_GAP: 10,
  LEADING_SIZE: 40,
  LEADING_ICON: 20,
  TRAILING_ICON: 16,
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
  // Phase 3.22.7: Single ambient shadow for restraint
  ambient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
} as const;

// =============================================================================
// PHASE 3.22.7: RESTRAINT TOKENS
// =============================================================================

/** Single Invitation Rule — only one element invites at a time */
export const INVITATION = {
  /** Primary element (Idle card) — full presence */
  primary: 1,
  /** Secondary elements (Quick links) — available but not eager */
  secondary: 0.82,
  /** Dormant elements (banners, tertiary) — quiet until chosen */
  dormant: 0.72,
} as const;

/** Vertical Breathing Rhythm — intentional gaps create pacing */
export const SECTION_GAP = {
  /** Standard breathing space */
  breath: 28,
  /** Smaller rest between related items */
  rest: 18,
  /** Larger pause between major sections */
  pause: 36,
} as const;

/** Silhouette constraints — presence, not display */
export const SILHOUETTE = {
  /** Maximum opacity (felt, not seen) */
  maxOpacity: 0.06,
  /** Maximum parallax movement */
  maxTranslateY: -8,
  /** Scale range for breathing */
  scaleRange: [1, 1.015] as const,
} as const;

// =============================================================================
// PHASE 3.22.9: SETTLE ANIMATION
// =============================================================================

/** Home screen settle animation — calm dominance after entry */
export const SETTLE = {
  /** Duration of settle animation (ms) */
  duration: 350,
  /** Initial scale (slightly larger, then settles) */
  initialScale: 1.008,
  /** Initial opacity */
  initialOpacity: 0.92,
  /** Delay before secondary elements settle (ms) */
  secondaryDelay: 80,
  /** Delay before tertiary elements settle (ms) */
  tertiaryDelay: 150,
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
