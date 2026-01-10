// /app/frontend/lib/features.ts
/**
 * FEATURE FLAGS (single source of truth)
 * 
 * All experimental/preview features should be gated by flags here.
 * This prevents accidental activation in production builds.
 * 
 * Supports:
 * - Compile-time defaults (DEFAULT_FLAGS)
 * - Remote overrides (fetched from backend, cached locally)
 * - Percentage rollouts (deterministic by userId)
 * 
 * Usage:
 *   if (isFeatureEnabled('AWAKENING_PREVIEW_UI')) { ... }
 *   if (isFeatureEnabled('NEW_LOGIN_FLOW', { userId: 'abc123' })) { ... }
 */

import { createHash } from './featureUtils';

// ─────────────────────────────────────────────────────────────
// DEFAULT FLAGS (compile-time safe defaults)
// ─────────────────────────────────────────────────────────────

export const DEFAULT_FLAGS = {
  /**
   * Awakening Preview UI (tiers 7★-10★)
   * When false: hides all awakening teaser content
   * When true: shows "coming soon" awakening tiers in progression screen
   */
  AWAKENING_PREVIEW_UI: false,

  /**
   * Gacha Pity UI - Enhanced pity display
   */
  GACHA_PITY_UI: true,

  /**
   * New Login Flow - Redesigned authentication screens
   */
  NEW_LOGIN_FLOW: false,

  /**
   * Maintenance Mode - Shows maintenance screen
   */
  MAINTENANCE_MODE: false,

  /**
   * Campaign Sweep - Multi-sweep cleared stages
   */
  CAMPAIGN_SWEEP: true,

  /**
   * Hero Cinematics - 5+ star hero video previews
   */
  HERO_CINEMATICS: true,
} as const;

// Type helper for feature flag keys
export type FeatureFlag = keyof typeof DEFAULT_FLAGS;

// ─────────────────────────────────────────────────────────────
// REMOTE FLAGS STATE
// ─────────────────────────────────────────────────────────────

/**
 * Remote flag value can be:
 * - boolean: hard on/off
 * - { enabled: boolean, rollout?: number }: percentage rollout (0..1)
 */
export type RemoteFlagValue = boolean | { enabled: boolean; rollout?: number };

export interface RemoteFeaturesPayload {
  version: number;
  ttlSeconds: number;
  flags: Record<string, RemoteFlagValue>;
}

// In-memory snapshot of remote flags
let remoteFlags: Record<string, RemoteFlagValue> = {};
let remoteVersion = 0;

/**
 * Set remote flags from backend payload.
 * Called by feature store during hydration.
 */
export function setRemoteFlags(payload: RemoteFeaturesPayload | null): void {
  if (!payload || typeof payload !== 'object') {
    remoteFlags = {};
    remoteVersion = 0;
    return;
  }
  remoteFlags = payload.flags ?? {};
  remoteVersion = payload.version ?? 0;
  if (__DEV__) {
    console.log('[features] Remote flags applied, version:', remoteVersion, Object.keys(remoteFlags));
  }
}

/**
 * Get current remote flags (for debugging/dev tools)
 */
export function getRemoteFlags(): { flags: Record<string, RemoteFlagValue>; version: number } {
  return { flags: { ...remoteFlags }, version: remoteVersion };
}

// ─────────────────────────────────────────────────────────────
// DEV OVERRIDES (only in __DEV__ builds)
// ─────────────────────────────────────────────────────────────

let devOverrides: Partial<Record<FeatureFlag, boolean>> = {};

/**
 * Override a flag in dev builds (for testing)
 * @param flag - The flag to override
 * @param value - The value to set (or undefined to remove override)
 */
export function setDevOverride(flag: FeatureFlag, value: boolean | undefined): void {
  if (!__DEV__) {
    console.warn('[features] Dev overrides only work in __DEV__ builds');
    return;
  }
  if (value === undefined) {
    delete devOverrides[flag];
  } else {
    devOverrides[flag] = value;
  }
  console.log('[features] Dev override set:', flag, '=', value);
}

/**
 * Clear all dev overrides
 */
export function clearDevOverrides(): void {
  devOverrides = {};
  if (__DEV__) console.log('[features] Dev overrides cleared');
}

// ─────────────────────────────────────────────────────────────
// ROLLOUT BUCKETING
// ─────────────────────────────────────────────────────────────

/**
 * Compute deterministic rollout bucket for a user.
 * Returns a value between 0 and 1.
 * Same userId always gets same bucket (stable UX).
 */
function computeRolloutBucket(flag: string, userId: string): number {
  const seed = `${flag}:${userId}`;
  const hash = createHash(seed);
  // Convert hash to number between 0-1
  return (hash % 10000) / 10000;
}

// ─────────────────────────────────────────────────────────────
// MAIN API: isFeatureEnabled
// ─────────────────────────────────────────────────────────────

export interface FeatureContext {
  userId?: string;
}

/**
 * Check if a feature is enabled.
 * 
 * Resolution order:
 * 1. Dev override (if __DEV__ and override exists)
 * 2. Remote flag (if exists)
 * 3. Default flag
 * 
 * For rollout flags, userId is required for deterministic bucketing.
 * 
 * @param flag - The feature flag to check
 * @param ctx - Optional context with userId for rollout features
 * @returns boolean - Whether the feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag, ctx?: FeatureContext): boolean {
  // 1. Check dev override first (only in dev)
  if (__DEV__ && flag in devOverrides) {
    return devOverrides[flag] === true;
  }

  // 2. Check remote flags
  const remoteValue = remoteFlags[flag];
  if (remoteValue !== undefined) {
    return resolveFlag(flag, remoteValue, ctx);
  }

  // 3. Fall back to compile-time default
  return DEFAULT_FLAGS[flag] === true;
}

/**
 * Resolve a flag value (handles both boolean and rollout objects)
 */
function resolveFlag(
  flag: string,
  value: RemoteFlagValue,
  ctx?: FeatureContext
): boolean {
  // Simple boolean
  if (typeof value === 'boolean') {
    return value;
  }

  // Rollout object
  if (typeof value === 'object' && value !== null) {
    const { enabled, rollout } = value;
    
    // If not enabled at all, return false
    if (!enabled) return false;
    
    // If no rollout percentage, treat as fully enabled
    if (rollout === undefined || rollout >= 1) return true;
    
    // If rollout is 0, no one gets it
    if (rollout <= 0) return false;
    
    // Need userId for rollout
    const userId = ctx?.userId;
    if (!userId) {
      // Without userId, we can't determine rollout - default to false for safety
      if (__DEV__) {
        console.warn(
          `[features] Flag "${flag}" has rollout=${rollout} but no userId provided. ` +
          `Pass { userId } to isFeatureEnabled() for deterministic rollout.`
        );
      }
      return false;
    }
    
    // Deterministic rollout based on userId
    const bucket = computeRolloutBucket(flag, userId);
    return bucket < rollout;
  }

  // Unknown shape - default to false
  return false;
}

// ─────────────────────────────────────────────────────────────
// LEGACY EXPORT (backward compatibility)
// ─────────────────────────────────────────────────────────────

// Keep FEATURES as a getter that returns current effective state
// This allows old code using `FEATURES.FLAG` to still work
export const FEATURES = new Proxy(DEFAULT_FLAGS, {
  get(target, prop: string) {
    if (prop in target) {
      return isFeatureEnabled(prop as FeatureFlag);
    }
    return undefined;
  },
});
