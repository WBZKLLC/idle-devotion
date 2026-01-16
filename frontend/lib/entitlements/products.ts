// /app/frontend/lib/entitlements/products.ts
// SINGLE SOURCE OF TRUTH for purchasable products
// All screens must import from here - no inline product strings allowed

import { ENTITLEMENT_KEYS, type EntitlementKey } from './types';

/**
 * Product definition for IAP
 */
export interface Product {
  /** RevenueCat/Store product ID */
  productId: string;
  /** Entitlement key granted on purchase */
  entitlementKey: EntitlementKey | string;
  /** Display name for UI */
  displayName: string;
  /** Fallback price label (actual price comes from IAP SDK) */
  priceFallback: string;
  /** Short description */
  description: string;
  /** Whether this is a subscription (vs one-time purchase) */
  isSubscription?: boolean;
}

/**
 * Canonical product definitions
 * Add new products here - nowhere else
 */
export const PRODUCTS = {
  PREMIUM_CINEMATICS_PACK: {
    productId: 'premium_cinematics_pack',
    entitlementKey: ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK,
    displayName: 'Premium Cinematics Pack',
    priceFallback: '$9.99',
    description: 'Unlock all premium hero cinematics',
    isSubscription: false,
  },
  
  PREMIUM_SUBSCRIPTION: {
    productId: 'premium_monthly',
    entitlementKey: ENTITLEMENT_KEYS.PREMIUM,
    displayName: 'Premium Subscription',
    priceFallback: '$4.99/mo',
    description: 'All premium features + no ads',
    isSubscription: true,
  },
  
  NO_ADS: {
    productId: 'no_ads_forever',
    entitlementKey: ENTITLEMENT_KEYS.NO_ADS,
    displayName: 'Remove Ads',
    priceFallback: '$2.99',
    description: 'Remove all ads permanently',
    isSubscription: false,
  },
  
  STARTER_PACK: {
    productId: 'starter_pack',
    entitlementKey: ENTITLEMENT_KEYS.STARTER_PACK,
    displayName: 'Starter Pack',
    priceFallback: '$0.99',
    description: 'One-time starter bonus',
    isSubscription: false,
  },
} as const satisfies Record<string, Product>;

// Type-safe product lookup
export type ProductKey = keyof typeof PRODUCTS;

/**
 * Get product by key
 */
export function getProduct(key: ProductKey): Product {
  return PRODUCTS[key];
}

/**
 * Get product by product ID (for IAP callbacks)
 */
export function getProductByProductId(productId: string): Product | undefined {
  return Object.values(PRODUCTS).find(p => p.productId === productId);
}

/**
 * Get product by entitlement key
 */
export function getProductByEntitlementKey(entitlementKey: string): Product | undefined {
  return Object.values(PRODUCTS).find(p => p.entitlementKey === entitlementKey);
}
