// /app/frontend/lib/featureUtils.ts

export const FEATURES_STORAGE_KEY = '@idledevotion/features/v1';
export const DEFAULT_FEATURES_TTL_SECONDS = 3600; // 1h fallback if server omits
export const MIN_FEATURES_TTL_SECONDS = 60; // don't thrash the endpoint
export const MAX_FEATURES_TTL_SECONDS = 24 * 60 * 60; // 24h clamp

export type RemoteFlagValue =
  | boolean
  | {
      enabled: boolean;
      rollout?: number; // 0..1
    };

export type RemoteFeaturesPayload = {
  version: number;
  ttlSeconds?: number;
  flags: Record<string, RemoteFlagValue>;
};

export type NormalizedRemoteFlag = {
  enabled: boolean;
  rollout?: number; // 0..1
};

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function clampTtlSeconds(ttlSeconds?: number): number {
  const raw = typeof ttlSeconds === 'number' ? ttlSeconds : DEFAULT_FEATURES_TTL_SECONDS;
  const clamped = Math.max(MIN_FEATURES_TTL_SECONDS, Math.min(MAX_FEATURES_TTL_SECONDS, raw));
  return clamped;
}

export function normalizeRemoteFlagValue(value: RemoteFlagValue): NormalizedRemoteFlag {
  if (typeof value === 'boolean') return { enabled: value };
  const enabled = !!value.enabled;
  const rollout =
    typeof value.rollout === 'number' ? clamp01(value.rollout) : undefined;
  return rollout === undefined ? { enabled } : { enabled, rollout };
}

export function normalizeRemoteFlags(
  flags: Record<string, RemoteFlagValue> | undefined | null,
): Record<string, NormalizedRemoteFlag> {
  const out: Record<string, NormalizedRemoteFlag> = {};
  if (!flags) return out;

  for (const [k, v] of Object.entries(flags)) {
    out[k] = normalizeRemoteFlagValue(v);
  }
  return out;
}

/**
 * Fast deterministic 32-bit FNV-1a hash.
 * Good enough for rollout bucketing; not for cryptography.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5; // offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619 (with 32-bit overflow)
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Convert a stable identifier into a bucket in [0,1).
 */
export function bucket01(stableId: string): number {
  const h = fnv1a32(stableId);
  // 2^32 = 4294967296
  return h / 4294967296;
}
