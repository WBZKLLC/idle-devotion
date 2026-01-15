/**
 * Cinematics Access Helper
 * 
 * Determines if user can access cinematics based on:
 * 1. Paid entitlement (PREMIUM_CINEMATICS_PACK)
 * 2. Feature flag (HERO_CINEMATICS)
 * 
 * Also provides per-hero ownership check for stat bonuses.
 * 
 * NOTE: For navigation to paywall, use openPremiumCinematic() from openPremiumCinematic.ts
 * or goToPaywall() from entitlements/navigation.ts - NOT direct router.push.
 */

import { isFeatureEnabled } from './features';
import { useEntitlementStore } from '../stores/entitlementStore';
import { useHasEntitlement, hasEntitlement, canAccessHeroCinematic } from './entitlements/gating';
import { ENTITLEMENT_KEYS, premiumCinematicOwnedKey } from './entitlements/types';

/**
 * Check if user can access cinematics system (synchronous check)
 * Requires BOTH: paid pack entitlement AND feature flag enabled
 * @param stableId - User ID for feature flag rollout
 * @returns true if user has paid AND feature flag is enabled
 */
export function canAccessCinematics(stableId?: string): boolean {
  // Use canonical gating helper
  const hasPack = hasEntitlement(ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK);
  if (!hasPack) return false;
  
  return isFeatureEnabled('HERO_CINEMATICS', { stableId });
}

/**
 * Hook version for reactive updates
 */
export function useCanAccessCinematics(stableId?: string): boolean {
  // Use canonical gating hook
  const hasPack = useHasEntitlement(ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK);
  if (!hasPack) return false;
  
  return isFeatureEnabled('HERO_CINEMATICS', { stableId });
}

/**
 * Check if user owns the premium cinematic for a specific hero.
 * This is what grants the stat perk (+10% HP, +5% ATK).
 * @param heroId - The hero's stable ID (e.g., 'michael_the_archangel')
 * @returns true if user owns this hero's premium cinematic
 */
export function hasHeroPremiumCinematicOwned(heroId: string): boolean {
  if (!heroId) return false;
  // Use canonical gating helper
  return canAccessHeroCinematic(heroId);
}

/**
 * Hook version for reactive per-hero ownership check
 */
export function useHasHeroPremiumCinematicOwned(heroId: string): boolean {
  // Use canonical gating hook with dynamic key
  const key = premiumCinematicOwnedKey(heroId);
  const hasHero = useHasEntitlement(key);
  const hasPack = useHasEntitlement(ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK);
  // User has access if they own the pack OR own the individual hero cinematic
  return hasHero || hasPack;
}
