/**
 * Entitlements - Paid Feature Definitions
 * 
 * Single source of truth for all paid/premium features.
 * Used by entitlementStore and paywall UI.
 */

export type EntitlementKey = 'PAID_CINEMATICS';

export interface EntitlementInfo {
  priceUsd: number;
  title: string;
  description: string;
}

export const ENTITLEMENTS: Record<EntitlementKey, EntitlementInfo> = {
  PAID_CINEMATICS: {
    priceUsd: 9.99,
    title: 'Hero Cinematics',
    description: 'Unlock 5★+ hero cinematic videos and future cinematic content.',
  },
};
