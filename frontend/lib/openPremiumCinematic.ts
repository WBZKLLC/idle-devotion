/**
 * openPremiumCinematic.ts
 * 
 * CANONICAL ROUTER for premium cinematic access.
 * 
 * INVARIANT: This is the ONLY entry point for cinematic playback.
 * ───────────────────────────────────────────────────────────────
 * 
 * This file:
 * - Calls requireCinematicAccess() - the SINGLE canonical gate
 * - If denied, routes via goToPaywall() - the SINGLE canonical navigation
 * - If allowed, opens the cinematic modal
 * 
 * This file does NOT:
 * - Implement its own entitlement checks (uses gating.ts only)
 * - Implement purchase logic
 * - Show its own alerts (gating.ts or paywall handles that)
 * - Use direct router.push() for paywall (uses navigation.ts)
 * 
 * Requirements for playback:
 * 1. User has PREMIUM_CINEMATICS_PACK entitlement (global pack) OR
 *    User has PREMIUM_CINEMATIC_OWNED:<heroId> entitlement (per-hero)
 * 2. HERO_CINEMATICS feature flag is enabled
 */

import { requireCinematicAccess } from './entitlements/gating';
import { goToPaywall } from './entitlements/navigation';
import { isFeatureEnabled } from './features';

export interface OpenCinematicResult {
  success: boolean;
  reason?: 'no_entitlement' | 'feature_disabled' | 'not_implemented';
}

/**
 * Attempt to open the premium cinematic for a hero.
 * 
 * This is the CANONICAL entry point for cinematic playback.
 * All screens must use this function - no direct modal opening.
 * 
 * @param heroId - The hero's stable ID
 * @param stableId - User's stable ID for feature flag rollout
 * @returns Result indicating success or reason for failure
 */
export function openPremiumCinematic(
  heroId: string,
  stableId?: string
): OpenCinematicResult {
  // Check feature flag first (fast fail)
  if (!isFeatureEnabled('HERO_CINEMATICS', { stableId })) {
    if (__DEV__) console.log('[openPremiumCinematic] Feature flag disabled');
    return { success: false, reason: 'feature_disabled' };
  }
  
  // Use SINGLE CANONICAL GATE - all policy logic lives in gating.ts
  // On denial, route via CANONICAL NAVIGATION (no direct router.push)
  const hasAccess = requireCinematicAccess(heroId, {
    onDenied: () => goToPaywall({
      productKey: 'PREMIUM_CINEMATICS_PACK',
      source: 'cinematic_gate',
      heroId,
    }),
  });
  
  if (!hasAccess) {
    return { success: false, reason: 'no_entitlement' };
  }
  
  // User has access - open the cinematic
  // TODO: When cinematics modal is wired, open it here
  // For now, return not_implemented
  if (__DEV__) {
    console.log('[openPremiumCinematic] Access granted, but playback not yet implemented');
  }
  
  return { success: false, reason: 'not_implemented' };
}

/**
 * Check if a hero's cinematic can be played (all requirements met)
 * Use this for UI state (show play button vs lock icon).
 * 
 * This does NOT navigate or show any UI - it's a pure check.
 * Uses the same canonical gate for consistency.
 * 
 * @param heroId - The hero's stable ID
 * @param stableId - User's stable ID for feature flag rollout
 * @returns true if all requirements are met for playback
 */
export function canPlayHeroCinematic(
  heroId: string,
  stableId?: string
): boolean {
  // Feature flag must be enabled
  if (!isFeatureEnabled('HERO_CINEMATICS', { stableId })) {
    return false;
  }
  
  // Use canonical gate with no-op denial handler (pure check)
  return requireCinematicAccess(heroId, { onDenied: () => {} });
}
