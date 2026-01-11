/**
 * Entitlements - Paid Feature Definitions
 * 
 * Single source of truth for all paid/premium features.
 * Used by entitlementStore and paywall UI.
 * 
 * KEY NAMING:
 * - Global packs: PREMIUM_CINEMATICS_PACK
 * - Per-hero ownership: PREMIUM_CINEMATIC_OWNED:<heroId>
 * 
 * MIGRATION: Old keys (PAID_CINEMATICS_PACK, CINEMATIC_OWNED:*) are
 * automatically migrated to new keys on hydration.
 */

// Global entitlement keys (finite set)
export type GlobalEntitlementKey = 'PREMIUM_CINEMATICS_PACK';

// Per-hero entitlement prefix (NEW)
export const PREMIUM_CINEMATIC_OWNED_PREFIX = 'PREMIUM_CINEMATIC_OWNED:';

// Legacy prefixes for migration
export const LEGACY_PACK_KEY = 'PAID_CINEMATICS_PACK';
export const LEGACY_OWNED_PREFIX = 'CINEMATIC_OWNED:';

// Helper to create per-hero key (NEW format)
export function premiumCinematicOwnedKey(heroId: string): string {
  return `${PREMIUM_CINEMATIC_OWNED_PREFIX}${heroId}`;
}

// Check if a key is a per-hero premium cinematic ownership key
export function isPremiumCinematicOwnedKey(key: string): boolean {
  return key.startsWith(PREMIUM_CINEMATIC_OWNED_PREFIX);
}

// Check if a key is a legacy per-hero key
export function isLegacyCinematicOwnedKey(key: string): boolean {
  return key.startsWith(LEGACY_OWNED_PREFIX);
}

// Extract heroId from a per-hero key (works with both old and new format)
export function extractHeroIdFromKey(key: string): string | null {
  if (key.startsWith(PREMIUM_CINEMATIC_OWNED_PREFIX)) {
    return key.slice(PREMIUM_CINEMATIC_OWNED_PREFIX.length);
  }
  if (key.startsWith(LEGACY_OWNED_PREFIX)) {
    return key.slice(LEGACY_OWNED_PREFIX.length);
  }
  return null;
}

// Migrate legacy key to new format
export function migrateLegacyKey(key: string): string {
  if (key === LEGACY_PACK_KEY) {
    return 'PREMIUM_CINEMATICS_PACK';
  }
  if (key.startsWith(LEGACY_OWNED_PREFIX)) {
    const heroId = key.slice(LEGACY_OWNED_PREFIX.length);
    return `${PREMIUM_CINEMATIC_OWNED_PREFIX}${heroId}`;
  }
  return key; // No migration needed
}

export interface EntitlementInfo {
  priceUsd: number;
  title: string;
  description: string;
}

export const ENTITLEMENTS: Record<GlobalEntitlementKey, EntitlementInfo> = {
  PREMIUM_CINEMATICS_PACK: {
    priceUsd: 9.99,
    title: 'Premium Cinematics',
    description: 'Unlock cinematic videos for 5★+ heroes. Owning a hero\'s Premium Cinematic grants +10% HP and +5% ATK to that hero.',
  },
};
