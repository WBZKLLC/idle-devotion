// /app/frontend/lib/progression.ts
/**
 * PUBLIC PROGRESSION HELPERS (single import surface for UI)
 * 
 * UI screens should import from this barrel, NOT directly from lib/tier.ts.
 * This keeps tier.ts as an internal implementation detail.
 * 
 * Usage:
 *   import { labelForTier, labelForStars, tierLabel } from '../lib/progression';
 */

// Types
export type {
  DisplayTier,
  BackendStars,
  TierArtKey,
} from './tier';

// Constants
export {
  MAX_STAR_TIER,
  MAX_AWAKENING_TIER,
  MAX_ACTIVE_TIER,
  AWAKENING_MIN_TIER,
  AWAKENING_MAX_TIER,
  TIER_LABELS,
  TIER_LABEL_ARRAY,
} from './tier';

// Tier helpers
export {
  clampTier,
  tierLabel,
  labelForTier,
  getTierLabel,
  assertTierIsActive,
  starsToTierIndex,
  tierIndexToArtKey,
  starsToTierArtKey,
} from './tier';

// Stars helpers
export {
  normalizeBackendStars,
  getHeroBackendStars,
  displayStars,
  labelForStars,
  starsSuffix,
} from './tier';

// Progression math
export {
  nextBackendStar,
  isAtMaxStars,
  unlockedTierForHero,
  effectiveTierForHero,
  computeUserMaxUnlockedTier,
} from './tier';

// Art resolution
export {
  resolveTierArt,
  getHeroTierArt,
} from './tier';
