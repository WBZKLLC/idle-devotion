// /app/frontend/lib/entitlements/types.ts
// Canonical entitlement types - shared between client and server

/**
 * Entitlement status from server
 * - owned: User has active access
 * - not_owned: User never purchased or entitlement expired
 * - pending: Purchase in progress, awaiting verification
 * - revoked: Previously owned but refunded/revoked
 */
export type EntitlementStatus = 'owned' | 'not_owned' | 'pending' | 'revoked';

/**
 * Single entitlement from server
 */
export interface ServerEntitlement {
  key: string;                    // e.g., "PREMIUM_CINEMATICS_PACK" or "PREMIUM_CINEMATIC_OWNED:hero_123"
  status: EntitlementStatus;
  granted_at?: string;            // ISO timestamp when granted
  expires_at?: string;            // ISO timestamp if time-limited (null = permanent)
  transaction_id?: string;        // For audit/support
}

/**
 * Server entitlements response shape
 * This is the SINGLE source of truth for what user owns
 */
export interface EntitlementsSnapshot {
  user_id: string;
  entitlements: ServerEntitlement[];
  snapshot_at: string;            // ISO timestamp when snapshot was taken
  cache_ttl_seconds: number;      // How long client can trust this cache
}

/**
 * Known entitlement keys (type-safe)
 */
export const EntitlementKeys = {
  // Global packs
  PREMIUM_CINEMATICS_PACK: 'PREMIUM_CINEMATICS_PACK',
  PRO_SUBSCRIPTION: 'PRO_SUBSCRIPTION',
  STARTER_PACK: 'STARTER_PACK',
  
  // Per-hero cinematics (dynamic)
  premiumCinematicOwned: (heroId: string) => `PREMIUM_CINEMATIC_OWNED:${heroId}`,
} as const;

/**
 * Check if a key is a per-hero cinematic entitlement
 */
export function isHeroCinematicKey(key: string): boolean {
  return key.startsWith('PREMIUM_CINEMATIC_OWNED:');
}

/**
 * Extract heroId from per-hero cinematic key
 */
export function extractHeroIdFromKey(key: string): string | null {
  if (!isHeroCinematicKey(key)) return null;
  return key.replace('PREMIUM_CINEMATIC_OWNED:', '');
}
