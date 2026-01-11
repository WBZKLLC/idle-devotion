/**
 * Cinematics Access Helper
 * 
 * Determines if user can access cinematics based on:
 * 1. Paid entitlement (PAID_CINEMATICS)
 * 2. Feature flag (HERO_CINEMATICS)
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
 * Check if user can access cinematics (synchronous check)
 * @param stableId - User ID for feature flag rollout
 * @returns true if user has paid AND feature flag is enabled
 */
export function canAccessCinematics(stableId?: string): boolean {
  const hasEntitlement = useEntitlementStore.getState().hasEntitlement('PAID_CINEMATICS');
  if (!hasEntitlement) return false;
  
  return isFeatureEnabled('HERO_CINEMATICS', { stableId });
}

/**
 * Hook version for reactive updates
 */
export function useCanAccessCinematics(stableId?: string): boolean {
  const hasEntitlement = useEntitlementStore(s => s.hasEntitlement('PAID_CINEMATICS'));
  if (!hasEntitlement) return false;
  
  return isFeatureEnabled('HERO_CINEMATICS', { stableId });
}
