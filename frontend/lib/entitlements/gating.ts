// /app/frontend/lib/entitlements/gating.ts
// Entitlement gating helpers - enforce premium access at UI/navigation level
// Server-side enforcement is separate (backend must also reject)
// 
// NOTE: This file imports entitlementStore dynamically to avoid circular deps
// 
// PHASE 3.10: Premium gates now trigger ensureFreshEntitlements() for staleness check
// PHASE 3.11: Uses canonical navigation helper instead of direct router.push
// PHASE 3.13: Emits telemetry for gate denied/allowed events (only here, guards enforce)

import { Alert } from 'react-native';
import { 
  ENTITLEMENT_KEYS, 
  PREMIUM_CINEMATIC_OWNED_PREFIX,
  isEntitlementOwned,
  type ServerEntitlement,
} from './types';
import { goToPaywall, getPaywallRoute, type PaywallSource } from './navigation';
import { track, Events } from '../telemetry/events';

// Dynamic import to avoid circular dependency
let _entitlementStore: any = null;
function getEntitlementStore() {
  if (!_entitlementStore) {
    _entitlementStore = require('../../stores/entitlementStore').useEntitlementStore;
  }
  return _entitlementStore;
}

/**
 * Phase 3.10: Fire-and-forget freshness check for premium gates
 * Called at gate entry, does NOT block - just triggers background refresh if stale
 */
function triggerFreshnessCheck(): void {
  const store = getEntitlementStore();
  // Fire and forget - don't await
  store.getState().ensureFreshEntitlements('gate').catch(() => {});
}

// ==============================================================
// TELEMETRY HELPERS (Phase 3.13)
// ==============================================================
// Gate allowed events are sampled (10%) to reduce noise
// Gate denied events are always tracked (business-critical)
const GATE_ALLOWED_SAMPLE_RATE = 0.1; // 10%

function trackGateDenied(requiredKey: string, source: PaywallSource, heroId?: string): void {
  track(Events.PREMIUM_GATE_DENIED, {
    requiredKey,
    source,
    heroId: heroId ?? null,
  });
}

function trackGateAllowed(requiredKey: string, source: PaywallSource): void {
  // Sampled to reduce noise - gate allows are frequent and expected
  if (Math.random() < GATE_ALLOWED_SAMPLE_RATE) {
    track(Events.PREMIUM_GATE_ALLOWED, {
      requiredKey,
      source,
      sampled: true,
    });
  }
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
 * Phase 3.10: Triggers background freshness check before evaluating
 * Phase 3.11: Uses canonical navigation helper for paywall routing
 * 
 * @returns true if entitled, false if blocked (and redirected to paywall)
 */
export function requireEntitlement(
  key: string,
  options?: {
    alertTitle?: string;
    alertMessage?: string;
    showPaywall?: boolean;
    source?: PaywallSource;
  }
): boolean {
  // Phase 3.10: Fire-and-forget freshness check
  triggerFreshnessCheck();
  
  const isEntitled = hasEntitlement(key);
  
  if (isEntitled) {
    return true;
  }
  
  const {
    alertTitle = 'Premium Feature',
    alertMessage = 'This feature requires a premium purchase.',
    showPaywall = true,
    source = 'gating_alert',
  } = options ?? {};
  
  Alert.alert(
    alertTitle,
    alertMessage,
    showPaywall
      ? [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'View Store', 
            // Phase 3.11: Use canonical navigation
            // NOTE: No productKey = routes to general paywall hub (documented policy)
            // This is intentional - generic gating shows all purchase options
            onPress: () => goToPaywall({ source }) 
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
 * Require premium cinematic access or handle denial
 * 
 * CANONICAL GATE for all cinematic access checks.
 * All code paths that need cinematic access MUST use this function.
 * 
 * Phase 3.10: Triggers background freshness check before evaluating
 * 
 * @param heroId - Hero to check access for
 * @param options.onDenied - Called when access is denied (default: shows alert)
 * @returns true if access granted, false if denied
 */
export function requireCinematicAccess(
  heroId: string,
  options?: { onDenied?: () => void }
): boolean {
  // Phase 3.10: Fire-and-forget freshness check
  triggerFreshnessCheck();
  
  if (canAccessHeroCinematic(heroId)) {
    return true;
  }
  
  // Access denied - call custom handler or show default alert
  if (options?.onDenied) {
    options.onDenied();
    return false;
  }
  
  // Default: use standard requireEntitlement alert (freshness already triggered)
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
