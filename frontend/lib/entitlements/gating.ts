// /app/frontend/lib/entitlements/gating.ts
// Entitlement gating helpers - enforce premium access at UI/navigation level
// Server-side enforcement is separate (backend must also reject)
// 
// NOTE: This file imports entitlementStore dynamically to avoid circular deps

import { Alert } from 'react-native';
import { router } from 'expo-router';
import { 
  ENTITLEMENT_KEYS, 
  PREMIUM_CINEMATIC_OWNED_PREFIX,
  isEntitlementOwned,
  type ServerEntitlement,
} from './types';

// Dynamic import to avoid circular dependency
let _entitlementStore: any = null;
function getEntitlementStore() {
  if (!_entitlementStore) {
    _entitlementStore = require('../../stores/entitlementStore').useEntitlementStore;
  }
  return _entitlementStore;
}

/**
 * Check if user has a specific entitlement (owned + not expired)
 * Uses server_time for expiry checks
 */
export function hasEntitlement(key: string): boolean {
  const store = getEntitlementStore();
  const state = store.getState();
  const entitlement = state.entitlementsByKey[key];
  const serverTime = state.snapshot?.server_time || new Date().toISOString();
  return isEntitlementOwned(entitlement, serverTime);
}

/**
 * Require entitlement or show paywall
 * Use this for guarding premium actions/navigation
 * 
 * @returns true if entitled, false if blocked (and redirected to paywall)
 */
export function requireEntitlement(
  key: string,
  options?: {
    alertTitle?: string;
    alertMessage?: string;
    showPaywall?: boolean;
    paywallRoute?: string;
  }
): boolean {
  const isEntitled = hasEntitlement(key);
  
  if (isEntitled) {
    return true;
  }
  
  const {
    alertTitle = 'Premium Feature',
    alertMessage = 'This feature requires a premium purchase.',
    showPaywall = true,
    paywallRoute = '/store',
  } = options ?? {};
  
  Alert.alert(
    alertTitle,
    alertMessage,
    showPaywall
      ? [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'View Store', 
            onPress: () => router.push(paywallRoute as any) 
          },
        ]
      : [{ text: 'OK' }]
  );
  
  return false;
}

/**
 * Hook version of hasEntitlement for reactive components
 * Must be called at top level of component
 */
export function useHasEntitlement(key: string): boolean {
  const store = getEntitlementStore();
  const entitlement = store((s: any) => s.entitlementsByKey[key]);
  const serverTime = store((s: any) => s.snapshot?.server_time) || new Date().toISOString();
  return isEntitlementOwned(entitlement, serverTime);
}

/**
 * Check premium cinematics pack ownership
 */
export function hasPremiumCinematicsPack(): boolean {
  return hasEntitlement(ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK);
}

/**
 * Check specific hero cinematic ownership
 */
export function hasHeroCinematic(heroId: string): boolean {
  return hasEntitlement(`${PREMIUM_CINEMATIC_OWNED_PREFIX}${heroId}`);
}

/**
 * Check if user can access any premium cinematic
 * (either owns pack or individual hero cinematic)
 */
export function canAccessHeroCinematic(heroId: string): boolean {
  return hasPremiumCinematicsPack() || hasHeroCinematic(heroId);
}

/**
 * Require premium cinematic access or show paywall
 */
export function requireCinematicAccess(heroId: string): boolean {
  if (canAccessHeroCinematic(heroId)) {
    return true;
  }
  
  return requireEntitlement(
    ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK,
    {
      alertTitle: 'Premium Cinematic',
      alertMessage: 'Unlock this cinematic with the Premium Cinematics Pack or purchase it individually.',
    }
  );
}

/**
 * Check Pro subscription status
 */
export function hasProSubscription(): boolean {
  return hasEntitlement(ENTITLEMENT_KEYS.PREMIUM);
}

/**
 * Check No Ads status
 */
export function hasNoAds(): boolean {
  return hasEntitlement(ENTITLEMENT_KEYS.NO_ADS);
}
