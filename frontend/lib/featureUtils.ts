// /app/frontend/lib/featureUtils.ts
/**
 * Utility functions for feature flag system.
 * Kept separate to avoid circular dependencies.
 */

/**
 * Simple hash function for deterministic rollout bucketing.
 * Uses djb2 algorithm - fast and good distribution.
 * 
 * @param str - String to hash
 * @returns number - Hash value
 */
export function createHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char; // hash * 33 ^ char
  }
  return Math.abs(hash);
}

/**
 * AsyncStorage key for feature flag cache
 */
export const FEATURES_STORAGE_KEY = '@idledevotion/features/v1';

/**
 * Cached feature payload shape
 */
export interface CachedFeaturesPayload {
  savedAt: number;      // ms epoch when saved
  nextFetchAt: number;  // ms epoch when cache expires
  payload: {
    version: number;
    ttlSeconds: number;
    flags: Record<string, unknown>;
  };
}

/**
 * Default TTL if backend doesn't specify (1 hour)
 */
export const DEFAULT_TTL_SECONDS = 3600;

/**
 * Minimum time between fetches to prevent spam (5 minutes)
 */
export const MIN_FETCH_INTERVAL_MS = 5 * 60 * 1000;
