// /app/frontend/lib/entitlements/navigation.ts
// CANONICAL Premium Navigation - single entry point for all paywall routing
//
// STRICT INVARIANTS:
// 1. All premium navigation MUST go through these helpers
// 2. Direct router.push('/paid-features') or router.push('/store') is FORBIDDEN
// 3. If productKey is omitted, defaults to PAYWALL_HUB (documented policy)
// 4. source MUST be a known PaywallSource (no arbitrary strings in prod)
// 5. returnTo is sanitized (must start with /, max 256 chars)
// 6. Telemetry is ONLY emitted from this file (guards enforce)
//
// This ensures:
// - Analytics/telemetry for all premium funnels
// - Single place to change paywall route
// - Consistent UX for premium denial flows
// - Easy debugging of purchase funnels
// - No silent misroutes from implicit defaults

import { router } from 'expo-router';
import { type ProductKey, getProduct } from './products';
import { track, Events } from '../telemetry/events';

// Debug logging
const dlog = (...args: any[]) => { if (__DEV__) console.log('[navigation]', ...args); };

// ==============================================================
// TELEMETRY DEDUPE - Prevent spam from double-taps/rerenders
// ==============================================================
const DEDUPE_WINDOW_MS = 1500; // 1.5 seconds
let lastPaywallOpenedAt = 0;
let lastStoreOpenedAt = 0;

function shouldEmitPaywallEvent(): boolean {
  const now = Date.now();
  if (now - lastPaywallOpenedAt < DEDUPE_WINDOW_MS) {
    dlog('paywall_opened dedupe - skipping');
    return false;
  }
  lastPaywallOpenedAt = now;
  return true;
}

function shouldEmitStoreEvent(): boolean {
  const now = Date.now();
  if (now - lastStoreOpenedAt < DEDUPE_WINDOW_MS) {
    dlog('store_opened dedupe - skipping');
    return false;
  }
  lastStoreOpenedAt = now;
  return true;
}

// ==============================================================
// TYPES
// ==============================================================

/**
 * Source of the paywall navigation (for analytics + debugging)
 * 
 * STRICT: Only these known values are allowed.
 * Adding a new source requires updating this type.
 */
export type PaywallSource = 
  | 'cinematic_gate'       // Premium cinematic access denied
  | 'battle_pass'          // Battle pass premium track
  | 'store'                // Direct store access from home/sidebar
  | 'profile'              // Profile premium section
  | 'hero_detail'          // Hero detail premium feature
  | 'gating_alert'         // Generic gating helper alert (requireEntitlement)
  | 'equipment'            // Equipment/gear premium feature
  | 'gacha'                // Gacha premium feature
  | 'campaign'             // Campaign premium feature
  | 'unknown';             // Fallback (should be rare, logged as warning)

// Known sources for validation (exported for type checking)
export const KNOWN_SOURCES = new Set<PaywallSource>([
  'cinematic_gate', 'battle_pass', 'store', 'profile', 'hero_detail',
  'gating_alert', 'equipment', 'gacha', 'campaign', 'unknown'
]);

/**
 * Options for paywall navigation
 */
export interface GoToPaywallOptions {
  /** 
   * Product to highlight/pre-select on paywall (from PRODUCTS keys)
   * If omitted, routes to general paywall hub (documented default policy)
   */
  productKey?: ProductKey;
  
  /** Source of the navigation (for analytics) - MUST be a known PaywallSource */
  source: PaywallSource;
  
  /** Hero ID if relevant (e.g., cinematic gate) */
  heroId?: string;
  
  /** 
   * Route to return to after purchase (optional)
   * SANITIZED: Must start with '/', max 256 chars, no query fragments
   */
  returnTo?: string;
}

/**
 * The ONE route for premium purchases
 * Change this ONLY here to update all premium navigation
 */
const PAYWALL_ROUTE = '/paid-features' as const;
const STORE_ROUTE = '/store' as const;

// Constraints
const MAX_RETURN_TO_LENGTH = 256;

/**
 * Sanitize returnTo path to prevent weird routing state
 * - Must start with '/'
 * - Strip query fragments
 * - Clamp length to MAX_RETURN_TO_LENGTH
 */
function sanitizeReturnTo(returnTo: string | undefined): string | undefined {
  if (!returnTo) return undefined;
  
  // Must start with /
  if (!returnTo.startsWith('/')) {
    if (__DEV__) console.warn('[navigation] returnTo must start with /, got:', returnTo);
    return undefined;
  }
  
  // Strip query params and fragments (keep clean path only)
  let cleaned = returnTo.split('?')[0].split('#')[0];
  
  // Clamp length
  if (cleaned.length > MAX_RETURN_TO_LENGTH) {
    if (__DEV__) console.warn('[navigation] returnTo too long, truncating');
    cleaned = cleaned.substring(0, MAX_RETURN_TO_LENGTH);
  }
  
  return cleaned;
}

/**
 * Validate and normalize source
 */
function normalizeSource(source: PaywallSource): PaywallSource {
  if (KNOWN_SOURCES.has(source)) {
    return source;
  }
  
  if (__DEV__) {
    console.warn('[navigation] Unknown PaywallSource:', source, '- defaulting to "unknown"');
  }
  return 'unknown';
}

/**
 * Canonical entry point for all paywall/premium navigation
 * 
 * USE THIS instead of router.push('/paid-features') or router.push('/store')
 * 
 * POLICY: If productKey is omitted, routes to general paywall hub.
 * This is deterministic and documented - Paywall component shows all products.
 * 
 * TELEMETRY: Emits 'paywall_opened' event (with 1.5s dedupe window)
 * 
 * @example
 * // From cinematic gate (specific product)
 * goToPaywall({ productKey: 'PREMIUM_CINEMATICS_PACK', source: 'cinematic_gate', heroId: hero.id });
 * 
 * // From battle pass (specific product)
 * goToPaywall({ productKey: 'PREMIUM_SUBSCRIPTION', source: 'battle_pass' });
 * 
 * // Generic premium denial (no specific product - shows all options)
 * goToPaywall({ source: 'gating_alert' });
 */
export function goToPaywall(opts: GoToPaywallOptions): void {
  const { productKey, heroId, returnTo } = opts;
  
  // Normalize source (strict validation)
  const source = normalizeSource(opts.source);
  
  // Sanitize returnTo
  const cleanReturnTo = sanitizeReturnTo(returnTo);
  
  dlog('goToPaywall:', { productKey, source, heroId, returnTo: cleanReturnTo });
  
  // Phase 3.13: Emit telemetry (with dedupe to prevent spam)
  if (shouldEmitPaywallEvent()) {
    track(Events.PAYWALL_OPENED, {
      source,
      productKey: productKey ?? null,
      heroId: heroId ?? null,
      returnTo: cleanReturnTo ?? null,
      isHub: !productKey,  // True if going to general hub (no specific product)
    });
  }
  
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
  // NOTE: If productKey is omitted, Paywall shows general hub (all products)
  // This is documented policy, not an implicit default
  
  // Source is always set (normalized above)
  params.set('source', source);
  
  if (heroId) {
    params.set('heroId', heroId);
  }
  
  if (cleanReturnTo) {
    params.set('returnTo', cleanReturnTo);
  }
  
  // Build final route
  const queryString = params.toString();
  const route = queryString 
    ? `${PAYWALL_ROUTE}?${queryString}` 
    : PAYWALL_ROUTE;
  
  router.push(route as any);
}

/**
 * Navigate to the general store/shop screen
 * Use this for browsing, not for specific premium denial flows
 * 
 * TELEMETRY: Emits 'store_opened' event (with 1.5s dedupe window)
 */
export function goToStore(source?: PaywallSource): void {
  const normalizedSource = source ? normalizeSource(source) : 'store';
  dlog('goToStore:', { source: normalizedSource });
  
  // Phase 3.13: Emit telemetry (with dedupe to prevent spam)
  if (shouldEmitStoreEvent()) {
    track(Events.STORE_OPENED, {
      source: normalizedSource,
    });
  }
  
  router.push(`${STORE_ROUTE}?source=${normalizedSource}` as any);
}

/**
 * Navigate to purchase success screen (optional, for post-purchase UX)
 */
export function goToPurchaseSuccess(opts?: {
  productKey?: ProductKey;
  returnTo?: string;
}): void {
  dlog('goToPurchaseSuccess:', opts);
  
  // Sanitize returnTo
  const cleanReturnTo = sanitizeReturnTo(opts?.returnTo);
  
  // For now, just go back or to a success route
  // This can be expanded to show a dedicated success screen
  if (cleanReturnTo) {
    router.replace(cleanReturnTo as any);
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

// ==============================================================
// Phase 3.19.5: Safe Return Path Helper
// ==============================================================

/**
 * Generate a stable return path so Paywall/Store can send the player back
 * without each screen inventing logic.
 * 
 * - Default returnTo: current pathname (no query, sanitized)
 * - If route is already /paid-features or /store, return '/' (prevents loops)
 * - If route is undefined, return '/'
 * 
 * @param currentPath - The current route pathname
 * @returns A safe, sanitized return path
 */
export function getSafeReturnTo(currentPath?: string): string {
  // Clean up the path first
  const cleaned = sanitizeReturnTo(currentPath ?? '/');
  
  // If sanitization failed, go to home
  if (!cleaned) return '/';
  
  // Prevent navigation loops - if already on paywall/store routes, go home
  const loopRoutes = [PAYWALL_ROUTE, STORE_ROUTE, '/paid-features', '/store'];
  if (loopRoutes.some(route => cleaned === route || cleaned.startsWith(route + '?'))) {
    return '/';
  }
  
  return cleaned;
}

/**
 * Get current route path (for use in components that need returnTo)
 * This is a helper that works with expo-router
 */
export function useCurrentPath(): string {
  // In expo-router, we can use the segments or pathname
  // For now, return a placeholder that components can override
  return '/';
}
