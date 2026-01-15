// /app/frontend/lib/entitlements/navigation.ts
// CANONICAL Premium Navigation - single entry point for all paywall routing
//
// STRICT INVARIANT: All premium navigation MUST go through these helpers.
// Direct router.push('/paid-features') or router.push('/store') is FORBIDDEN
// in screens - only allowed in this file.
//
// This ensures:
// - Analytics/telemetry for all premium funnels
// - Single place to change paywall route
// - Consistent UX for premium denial flows
// - Easy debugging of purchase funnels

import { router } from 'expo-router';
import { type ProductKey, getProduct } from './products';

// Debug logging
const dlog = (...args: any[]) => { if (__DEV__) console.log('[navigation]', ...args); };

/**
 * Source of the paywall navigation (for analytics + debugging)
 */
export type PaywallSource = 
  | 'cinematic_gate'       // Premium cinematic access denied
  | 'battle_pass'          // Battle pass premium track
  | 'store'                // Direct store access
  | 'profile'              // Profile premium section
  | 'hero_detail'          // Hero detail premium feature
  | 'gating_alert'         // Generic gating helper alert
  | 'manual'               // Manual navigation (dev/testing)
  | string;                // Extensible for future sources

/**
 * Options for paywall navigation
 */
export interface GoToPaywallOptions {
  /** Product to highlight/pre-select on paywall (from PRODUCTS keys) */
  productKey?: ProductKey;
  
  /** Source of the navigation (for analytics) */
  source: PaywallSource;
  
  /** Hero ID if relevant (e.g., cinematic gate) */
  heroId?: string;
  
  /** Route to return to after purchase (optional) */
  returnTo?: string;
}

/**
 * The ONE route for premium purchases
 * Change this ONLY here to update all premium navigation
 */
const PAYWALL_ROUTE = '/paid-features' as const;
const STORE_ROUTE = '/store' as const;

/**
 * Canonical entry point for all paywall/premium navigation
 * 
 * USE THIS instead of router.push('/paid-features') or router.push('/store')
 * 
 * @example
 * // From cinematic gate
 * goToPaywall({ productKey: 'PREMIUM_CINEMATICS_PACK', source: 'cinematic_gate', heroId: hero.id });
 * 
 * // From battle pass
 * goToPaywall({ productKey: 'PREMIUM_SUBSCRIPTION', source: 'battle_pass' });
 * 
 * // Generic store access
 * goToPaywall({ source: 'profile' });
 */
export function goToPaywall(opts: GoToPaywallOptions): void {
  const { productKey, source, heroId, returnTo } = opts;
  
  dlog('goToPaywall:', { productKey, source, heroId, returnTo });
  
  // Build query params
  const params = new URLSearchParams();
  
  if (productKey) {
    params.set('productKey', productKey);
    // Also include productId for convenience
    const product = getProduct(productKey);
    if (product) {
      params.set('productId', product.productId);
    }
  }
  
  if (source) {
    params.set('source', source);
  }
  
  if (heroId) {
    params.set('heroId', heroId);
  }
  
  if (returnTo) {
    params.set('returnTo', returnTo);
  }
  
  // Build final route
  const queryString = params.toString();
  const route = queryString 
    ? `${PAYWALL_ROUTE}?${queryString}` 
    : PAYWALL_ROUTE;
  
  // TODO: Add telemetry/analytics event here
  // track(Events.PAYWALL_VIEWED, { productKey, source, heroId });
  
  router.push(route as any);
}

/**
 * Navigate to the general store/shop screen
 * Use this for browsing, not for specific premium denial flows
 */
export function goToStore(source?: PaywallSource): void {
  dlog('goToStore:', { source });
  
  if (source) {
    router.push(`${STORE_ROUTE}?source=${source}` as any);
  } else {
    router.push(STORE_ROUTE as any);
  }
}

/**
 * Navigate to purchase success screen (optional, for post-purchase UX)
 */
export function goToPurchaseSuccess(opts?: {
  productKey?: ProductKey;
  returnTo?: string;
}): void {
  dlog('goToPurchaseSuccess:', opts);
  
  // For now, just go back or to a success route
  // This can be expanded to show a dedicated success screen
  if (opts?.returnTo) {
    router.replace(opts.returnTo as any);
  } else {
    router.back();
  }
}

/**
 * Get the paywall route for use in gating helpers
 * (Internal use - screens should use goToPaywall instead)
 */
export function getPaywallRoute(): string {
  return PAYWALL_ROUTE;
}

/**
 * Get the store route
 * (Internal use - screens should use goToStore instead)
 */
export function getStoreRoute(): string {
  return STORE_ROUTE;
}
