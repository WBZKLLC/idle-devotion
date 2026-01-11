/**
 * Entitlements - Paid Feature Definitions
 * 
 * Single source of truth for all paid/premium features.
 * Used by entitlementStore and paywall UI.
 * 
 * KEY NAMING:
 * - Global packs: PAID_CINEMATICS_PACK, PAID_SKINS_PACK, etc.
 * - Per-hero ownership: CINEMATIC_OWNED:<heroId>
 */

// Global entitlement keys (finite set)
export type GlobalEntitlementKey = 'PAID_CINEMATICS_PACK';

// Per-hero entitlement prefix
export const CINEMATIC_OWNED_PREFIX = 'CINEMATIC_OWNED:';

// Helper to create per-hero key
export function cinematicOwnedKey(heroId: string): string {
  return `${CINEMATIC_OWNED_PREFIX}${heroId}`;
}

// Check if a key is a per-hero cinematic ownership key
export function isCinematicOwnedKey(key: string): boolean {
  return key.startsWith(CINEMATIC_OWNED_PREFIX);
}

// Extract heroId from a per-hero key
export function extractHeroIdFromKey(key: string): string | null {
  if (!isCinematicOwnedKey(key)) return null;
  return key.slice(CINEMATIC_OWNED_PREFIX.length);
}

export interface EntitlementInfo {
  priceUsd: number;
  title: string;
  description: string;
}

export const ENTITLEMENTS: Record<GlobalEntitlementKey, EntitlementInfo> = {
  PAID_CINEMATICS_PACK: {
    priceUsd: 9.99,
    title: 'Hero Cinematics Pack',
    description: 'Unlock cinematic videos for 5★+ heroes. Owning a hero\'s cinematic grants +10% HP and +5% ATK to that hero.',
  },
};
