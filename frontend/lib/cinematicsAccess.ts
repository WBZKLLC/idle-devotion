/**
 * Cinematics Access Helper
 * 
 * Determines if user can access cinematics based on:
 * 1. Paid entitlement (PAID_CINEMATICS_PACK)
 * 2. Feature flag (HERO_CINEMATICS)
 * 
 * Also provides per-hero ownership check for stat bonuses.
 * 
 * Usage:
 * if (!canAccessCinematics(user?.id)) {
 *   navigate('paid-features');
 *   return;
 * }
 * openCinematic();
 */

import { isFeatureEnabled } from './features';
import { useEntitlementStore } from '../stores/entitlementStore';

/**
 * Check if user can access cinematics system (synchronous check)
 * Requires BOTH: paid pack entitlement AND feature flag enabled
 * @param stableId - User ID for feature flag rollout
 * @returns true if user has paid AND feature flag is enabled
 */
export function canAccessCinematics(stableId?: string): boolean {
  const store = useEntitlementStore.getState();
  const hasPack = store.hasEntitlement('PAID_CINEMATICS_PACK');
  if (!hasPack) return false;
  
  return isFeatureEnabled('HERO_CINEMATICS', { stableId });
}

/**
 * Hook version for reactive updates
 */
export function useCanAccessCinematics(stableId?: string): boolean {
  const entitlements = useEntitlementStore(s => s.entitlements);
  const hasPack = Boolean(entitlements['PAID_CINEMATICS_PACK']);
  if (!hasPack) return false;
  
  return isFeatureEnabled('HERO_CINEMATICS', { stableId });
}

/**
 * Check if user owns the cinematic for a specific hero.
 * This is what grants the stat perk (+10% HP, +5% ATK).
 * @param heroId - The hero's stable ID (e.g., 'michael_the_archangel')
 * @returns true if user owns this hero's cinematic
 */
export function hasHeroCinematicOwned(heroId: string): boolean {
  if (!heroId) return false;
  return useEntitlementStore.getState().hasHeroCinematicOwned(heroId);
}

/**
 * Hook version for reactive per-hero ownership check
 */
export function useHasHeroCinematicOwned(heroId: string): boolean {
  const entitlements = useEntitlementStore(s => s.entitlements);
  if (!heroId) return false;
  const key = `CINEMATIC_OWNED:${heroId}`;
  return Boolean(entitlements[key]);
}
