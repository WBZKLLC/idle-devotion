/**
 * lib/ui/gradients.ts
 * 
 * SINGLE SOURCE OF TRUTH for LinearGradient color tuples.
 * 
 * Phase 3.20.2: Fix LinearGradient tuple typing errors by using `as const`.
 * This ensures TypeScript infers the correct readonly tuple type instead of string[].
 * 
 * Usage:
 *   import { BG_NAVY, BG_GOLD } from '../lib/ui/gradients';
 *   <LinearGradient colors={BG_NAVY} ... />
 * 
 * Benefits:
 * - Type-safe (no `as any` casts needed)
 * - Consistent gradients across the app
 * - Easy to update colors in one place
 */

import COLORS from '../../theme/colors';

// ============================================================
// BACKGROUND GRADIENTS (2-stop)
// ============================================================

/** Navy background - most common page background */
export const BG_NAVY = [COLORS.navy.darkest, COLORS.navy.dark] as const;

/** Navy background with primary accent */
export const BG_NAVY_PRIMARY = [COLORS.navy.darkest, COLORS.navy.primary] as const;

/** Navy medium to dark */
export const BG_NAVY_MEDIUM = [COLORS.navy.medium, COLORS.navy.primary] as const;

/** Navy medium to dark (alternate) */
export const BG_NAVY_MEDIUM_DARK = [COLORS.navy.medium, COLORS.navy.dark] as const;

/** Navy dark to darkest (inverted) */
export const BG_NAVY_INVERTED = [COLORS.navy.dark, COLORS.navy.darkest] as const;

/** Navy primary to dark */
export const BG_NAVY_PRIMARY_DARK = [COLORS.navy.primary, COLORS.navy.dark] as const;

/** Navy dark to primary */
export const BG_NAVY_DARK_PRIMARY = [COLORS.navy.dark, COLORS.navy.primary] as const;

// ============================================================
// BACKGROUND GRADIENTS (3-stop)
// ============================================================

/** Navy 3-stop gradient */
export const BG_NAVY_3 = [COLORS.navy.darkest, COLORS.navy.dark, COLORS.navy.primary] as const;

/** Mystical purple 3-stop */
export const BG_MYSTICAL = ['#1e1b4b', '#0f0a1f', COLORS.navy.darkest] as const;

/** Dark overlay gradient */
export const BG_DARK_OVERLAY = ['rgba(0,0,0,0.95)', 'rgba(10,10,30,0.98)', 'rgba(0,0,0,0.95)'] as const;

// ============================================================
// ACCENT GRADIENTS (buttons, highlights)
// ============================================================

/** Gold accent - primary gold button/highlight */
export const ACCENT_GOLD = [COLORS.gold.primary, COLORS.gold.dark] as const;

/** Gold subtle - for badges, status indicators */
export const ACCENT_GOLD_SUBTLE = [COLORS.gold.dark + '40', COLORS.navy.medium] as const;

/** Success/green gradient */
export const ACCENT_SUCCESS = ['#22c55e', '#16a34a'] as const;

/** Success darker variant */
export const ACCENT_SUCCESS_DARK = [COLORS.success, '#0d5c2e'] as const;

/** Warning/amber gradient */
export const ACCENT_WARNING = ['#f59e0b', '#d97706'] as const;

/** Error/red gradient */
export const ACCENT_ERROR = ['#e74c3c', '#c0392b'] as const;

// ============================================================
// SPECIAL THEME GRADIENTS
// ============================================================

/** War/blood theme (guild war) - using available colors */
export const BG_WAR = ['#7f1d1d', COLORS.navy.darkest] as const;

/** War action button */
export const ACCENT_WAR = ['#dc2626', '#7f1d1d'] as const;

/** Cave/dungeon theme */
export const BG_CAVE = ['#44403c', '#1c1917'] as const;

/** Chrono/time theme */
export const ACCENT_CHRONO = ['#8b5cf6', '#4c1d95'] as const;

/** Chrono secondary */
export const ACCENT_CHRONO_SECONDARY = ['#8b5cf6', '#7c3aed'] as const;

/** Mystical purple (2-stop) */
export const BG_MYSTICAL_2 = ['#1e1b4b', COLORS.navy.dark] as const;

/** Dark red background */
export const BG_DARK_RED = ['#1a0a0a', '#2d1f1f'] as const;

// ============================================================
// CINEMATIC/SPECIAL EFFECT GRADIENTS
// ============================================================

/** Purple cinematic gradient */
export const CINEMATIC_PURPLE = ['rgba(123, 104, 238, 0.85)', 'rgba(155, 89, 182, 0.85)'] as const;

/** Loading/skeleton shimmer base */
export const SKELETON_BASE = ['#1a1a2e', '#2d2d44', '#1a1a2e'] as const;

// ============================================================
// HELPER TYPES
// ============================================================

/** Type for gradient colors (readonly tuple) */
export type GradientColors = readonly [string, string, ...string[]];

/**
 * Helper to create a gradient with dynamic opacity
 * @param baseColor - The base color (e.g., COLORS.gold.primary)
 * @param opacity - Opacity as hex suffix (e.g., '40' for 25%)
 * @param secondColor - Second gradient color
 */
export function gradientWithOpacity(
  baseColor: string,
  opacity: string,
  secondColor: string
): readonly [string, string] {
  return [baseColor + opacity, secondColor] as const;
}
