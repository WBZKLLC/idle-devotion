// /app/frontend/lib/features.ts
/**
 * FEATURE FLAGS (single source of truth)
 * 
 * All experimental/preview features should be gated by flags here.
 * This prevents accidental activation in production builds.
 * 
 * To enable a feature:
 * 1. Set the flag to true
 * 2. Run drift checks to ensure it's properly gated elsewhere
 * 3. Test thoroughly before shipping
 */

export const FEATURES = {
  /**
   * Awakening Preview UI (tiers 7★-10★)
   * When false: hides all awakening teaser content
   * When true: shows "coming soon" awakening tiers in progression screen
   */
  AWAKENING_PREVIEW_UI: false,
} as const;

// Type helper for feature flag keys
export type FeatureFlag = keyof typeof FEATURES;

/**
 * Check if a feature is enabled.
 * Use this for programmatic checks.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag] === true;
}
