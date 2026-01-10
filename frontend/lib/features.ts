// /app/frontend/lib/features.ts

import {
  bucket01,
  normalizeRemoteFlags,
  type NormalizedRemoteFlag,
  type RemoteFeaturesPayload,
} from './featureUtils';

/**
 * Single source of truth for KNOWN flags (compile-time defaults).
 * Add new flags here first.
 */
export const DEFAULT_FLAGS = {
  AWAKENING_PREVIEW_UI: false,
  GACHA_PITY_UI: true,
  NEW_LOGIN_FLOW: false,
  MAINTENANCE_MODE: false,
  CAMPAIGN_SWEEP: true,
  HERO_CINEMATICS: true,
  HERO_PROGRESSION_ENABLED: true,
} as const;

export type FeatureKey = keyof typeof DEFAULT_FLAGS;

type FeatureEvalContext = {
  /**
   * Provide a stable identifier for deterministic rollout bucketing.
   * If omitted, rollout flags behave like `enabled` only (no percentage logic).
   */
  stableId?: string;
};

let remoteFlags: Record<string, NormalizedRemoteFlag> = {};
let remoteVersion: number | null = null;

/**
 * Dev overrides: ONLY applied in __DEV__.
 * Stored in-memory; you can optionally add persistence later.
 */
const devOverrides: Record<string, boolean> = {};

export function setDevFeatureOverride(flag: string, enabled: boolean): void {
  if (!__DEV__) return;
  devOverrides[flag] = enabled;
}

export function clearDevFeatureOverride(flag: string): void {
  if (!__DEV__) return;
  delete devOverrides[flag];
}

export function clearAllDevFeatureOverrides(): void {
  if (!__DEV__) return;
  for (const k of Object.keys(devOverrides)) delete devOverrides[k];
}

/**
 * Called by the feature store after hydration/fetch.
 */
export function setRemoteFeatures(payload: RemoteFeaturesPayload): void {
  remoteVersion = payload.version ?? null;
  remoteFlags = normalizeRemoteFlags(payload.flags);
}

export function clearRemoteFeatures(): void {
  remoteVersion = null;
  remoteFlags = {};
}

export function getRemoteFeaturesSnapshot(): {
  version: number | null;
  flags: Record<string, NormalizedRemoteFlag>;
} {
  return { version: remoteVersion, flags: remoteFlags };
}

/**
 * Main entrypoint used by UI.
 * Keep usage standardized: isFeatureEnabled('FLAG', { stableId: userId })
 */
export function isFeatureEnabled(flag: FeatureKey, ctx?: FeatureEvalContext): boolean;
export function isFeatureEnabled(flag: string, ctx?: FeatureEvalContext): boolean;
export function isFeatureEnabled(flag: string, ctx?: FeatureEvalContext): boolean {
  // 1) dev override wins (dev-only)
  if (__DEV__ && Object.prototype.hasOwnProperty.call(devOverrides, flag)) {
    return !!devOverrides[flag];
  }

  // 2) remote override next
  const r = remoteFlags[flag];
  if (r) {
    if (!r.enabled) return false;
    if (typeof r.rollout === 'number') {
      const stableId = ctx?.stableId;
      if (!stableId) return true; // enabled but no stableId => treat as on
      const b = bucket01(`${flag}:${stableId}`);
      return b < r.rollout;
    }
    return true;
  }

  // 3) local default fallback (known flags)
  if (Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, flag)) {
    return !!(DEFAULT_FLAGS as Record<string, boolean>)[flag];
  }

  // 4) unknown flag => safe off
  return false;
}
