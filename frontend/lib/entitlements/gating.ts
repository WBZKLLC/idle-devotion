// /app/frontend/lib/entitlements/gating.ts
// Entitlement gating helpers - enforce premium access at UI/navigation level
// Server-side enforcement is separate (backend must also reject)

import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useEntitlementStore } from '../../stores/entitlementStore';
import { EntitlementKeys } from './types';

/**
 * Check if user has a specific entitlement
 * Use this for simple boolean checks in UI
 */
export function hasEntitlement(key: string): boolean {
  return useEntitlementStore.getState().hasEntitlement(key);
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
 */
export function useHasEntitlement(key: string): boolean {
  return useEntitlementStore(s => s.hasEntitlement(key));
}

/**
 * Check premium cinematics pack ownership
 */
export function hasPremiumCinematicsPack(): boolean {
  return hasEntitlement(EntitlementKeys.PREMIUM_CINEMATICS_PACK);
}

/**
 * Check specific hero cinematic ownership
 */
export function hasHeroCinematic(heroId: string): boolean {
  return hasEntitlement(EntitlementKeys.premiumCinematicOwned(heroId));
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
    EntitlementKeys.PREMIUM_CINEMATICS_PACK,
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
  return hasEntitlement(EntitlementKeys.PRO_SUBSCRIPTION);
}
