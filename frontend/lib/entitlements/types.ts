// /app/frontend/lib/entitlements/types.ts
// Canonical Entitlements Contract - SINGLE SOURCE OF TRUTH
// Server is authoritative; client caches for UX only

/**
 * Entitlement status from server
 */
export type EntitlementStatus = 'owned' | 'not_owned' | 'expired' | 'pending' | 'revoked' | 'grace_period';

/**
 * Known entitlement keys (finite set, type-safe)
 */
export type EntitlementKey =
  | 'PREMIUM'
  | 'PREMIUM_CINEMATICS_PACK'
  | 'NO_ADS'
  | 'STARTER_PACK';

export const ENTITLEMENT_KEYS = {
  PREMIUM: 'PREMIUM',
  PREMIUM_CINEMATICS_PACK: 'PREMIUM_CINEMATICS_PACK',
  NO_ADS: 'NO_ADS',
  STARTER_PACK: 'STARTER_PACK',
} as const satisfies Record<string, EntitlementKey>;

/**
 * Per-hero cinematic ownership key helper
 * Dynamic keys: PREMIUM_CINEMATIC_OWNED:<heroId>
 */
export const PREMIUM_CINEMATIC_OWNED_PREFIX = 'PREMIUM_CINEMATIC_OWNED:';

export function premiumCinematicOwnedKey(heroId: string): string {
  return `${PREMIUM_CINEMATIC_OWNED_PREFIX}${heroId}`;
}

export function isHeroCinematicKey(key: string): boolean {
  return key.startsWith(PREMIUM_CINEMATIC_OWNED_PREFIX);
}

export function extractHeroIdFromKey(key: string): string | null {
  if (!isHeroCinematicKey(key)) return null;
  return key.slice(PREMIUM_CINEMATIC_OWNED_PREFIX.length);
}

/**
 * Single entitlement from server
 */
export type ServerEntitlement = {
  key: EntitlementKey | string; // string for dynamic keys like hero cinematics
  status: EntitlementStatus;

  // Server timestamps (ISO8601 strings)
  granted_at?: string | null;
  expires_at?: string | null;

  // Purchase system references (may be null for grants)
  transaction_id?: string | null;
  product_id?: string | null;

  // Why this status is what it is (helps UX + support)
  reason?: 'purchase' | 'trial' | 'promo' | 'admin' | 'refund' | 'chargeback' | 'unknown';
};

/**
 * Server entitlements response shape
 * This is the SINGLE source of truth for what user owns
 * 
 * STRICT INVARIANTS:
 * - entitlements must include ALL known keys (even if not_owned)
 * - server_time is required (no client Date.now decisions for expiry)
 * - version increments whenever entitlements change
 */
export type EntitlementsSnapshot = {
  // Server's "now", so expiry checks are deterministic
  server_time: string;

  // Monotonic version for caching + invalidation
  version: number;

  // Who this snapshot is for
  username: string;

  // Map for O(1) reads everywhere
  entitlements: Record<string, ServerEntitlement>;

  // Optional: backend can instruct refresh policies
  ttl_seconds?: number;

  // Optional debug info (safe)
  source?: 'revenuecat' | 'database' | 'hybrid';
};

/**
 * Create empty entitlements map with all known keys as not_owned
 */
export function createEmptyEntitlementsMap(): Record<string, ServerEntitlement> {
  return Object.values(ENTITLEMENT_KEYS).reduce((acc, key) => {
    acc[key] = { key, status: 'not_owned' };
    return acc;
  }, {} as Record<string, ServerEntitlement>);
}

/**
 * Check if entitlement is owned and not expired
 * Uses server_time for expiry checks (NOT client time)
 */
export function isEntitlementOwned(
  entitlement: ServerEntitlement | undefined,
  serverTime: string
): boolean {
  if (!entitlement) return false;
  if (entitlement.status !== 'owned') return false;
  
  // Check expiry using server time
  if (entitlement.expires_at) {
    const expiresAt = new Date(entitlement.expires_at).getTime();
    const serverNow = new Date(serverTime).getTime();
    if (serverNow > expiresAt) return false;
  }
  
  return true;
}
