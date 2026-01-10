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

import { isFeatureEnabled } from './features';
import type { DisplayTier } from './tier';
import { TIER_LABELS } from './tier';

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

// ─────────────────────────────────────────────────────────────
// TIER SELECTOR OPTIONS (feature-flag aware)
// ─────────────────────────────────────────────────────────────

export const ACTIVE_TIERS: DisplayTier[] = [1, 2, 3, 4, 5, 6];
export const AWAKENING_TIERS: DisplayTier[] = [7, 8, 9, 10];

export type TierOptionKind = 'active' | 'awakening';

export interface TierSelectorOption {
  tier: DisplayTier;
  label: string;
  kind: TierOptionKind;
}

/**
 * Display-safe tier label (no assertions).
 * Use this for UI display where awakening tiers may be shown as preview.
 * Does NOT call assertTierIsActive().
 */
export function labelForTierDisplay(tier: number): string {
  const t = Math.max(1, Math.min(10, Math.floor(tier))) as DisplayTier;
  return TIER_LABELS[t] ?? `${t}★`;
}

/**
 * Get tier selector options for UI.
 * - Returns active tiers (1-6) always
 * - Appends awakening tiers (7-10) ONLY when AWAKENING_PREVIEW_UI flag is on
 * 
 * @param stableId - Optional user ID for rollout bucketing
 */
export function tierSelectorOptions(stableId?: string): TierSelectorOption[] {
  const showAwakening = isFeatureEnabled('AWAKENING_PREVIEW_UI', { stableId });

  const tiers: DisplayTier[] = showAwakening
    ? [...ACTIVE_TIERS, ...AWAKENING_TIERS]
    : ACTIVE_TIERS;

  return tiers.map(tier => ({
    tier,
    label: labelForTierDisplay(tier),
    kind: (tier <= 6 ? 'active' : 'awakening') as TierOptionKind,
  }));
}
