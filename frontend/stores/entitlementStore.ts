/**
 * Entitlement Store - Server Truth Model
 * 
 * STRICT INVARIANTS:
 * - Store NEVER grants entitlements - only server can grant
 * - Store caches server snapshots for UX (offline/fast reads)
 * - All reads go through gating helpers, not direct store access
 * - Refresh from server on: startup, post-purchase, manual, gate (stale check)
 * 
 * PHASE 3.10 - TTL DISCIPLINE:
 * - Staleness uses server_time (not device time) 
 * - ensureFreshEntitlements() is the canonical refresh entry point
 * - Fast reads from cache, disciplined refresh on gates
 */

import { create } from 'zustand';
import { storageGet, storageSet, storageRemove } from '../lib/storage';
import { 
  type EntitlementsSnapshot, 
  type ServerEntitlement,
  type EntitlementKey,
  ENTITLEMENT_KEYS,
  createEmptyEntitlementsMap,
  premiumCinematicOwnedKey,
  PREMIUM_CINEMATIC_OWNED_PREFIX,
} from '../lib/entitlements/types';
import { 
  LEGACY_PACK_KEY, 
  LEGACY_OWNED_PREFIX,
  migrateLegacyKey 
} from '../lib/entitlements/legacy';

// Debug logging helpers
const dlog = (...args: any[]) => { if (__DEV__) console.log(...args); };

const STORAGE_KEY = '@idledevotion/entitlements/v4';
const LEGACY_STORAGE_KEY = '@idledevotion/entitlements/v3';

// Default TTL if server doesn't provide one (5 minutes)
const DEFAULT_TTL_SECONDS = 300;
// Minimum TTL to prevent runaway refreshes (30 seconds)
const MIN_TTL_SECONDS = 30;
// Maximum TTL to ensure eventual consistency (1 hour)
const MAX_TTL_SECONDS = 3600;

// API import (lazy to avoid circular deps at module load)
let _getEntitlementsSnapshot: (() => Promise<EntitlementsSnapshot>) | null = null;
async function getEntitlementsSnapshotApi(): Promise<EntitlementsSnapshot> {
  if (!_getEntitlementsSnapshot) {
    const api = await import('../lib/api');
    _getEntitlementsSnapshot = api.getEntitlementsSnapshot;
  }
  return _getEntitlementsSnapshot();
}

// Lazy import for gameStore to avoid circular deps
let _getAuthEpoch: (() => number) | null = null;
function getAuthEpoch(): number {
  if (!_getAuthEpoch) {
    const { useGameStore } = require('./gameStore');
    _getAuthEpoch = () => useGameStore.getState().authEpoch;
  }
  return _getAuthEpoch();
}

// Lazy import to check if user is logged in
let _getUser: (() => any) | null = null;
function getUser(): any {
  if (!_getUser) {
    const { useGameStore } = require('./gameStore');
    _getUser = () => useGameStore.getState().user;
  }
  return _getUser();
}

type RefreshReason = 'startup' | 'post_purchase' | 'manual' | 'gate' | 'app_resume';

interface EntitlementStoreState {
  // Server snapshot (source of truth when available)
  snapshot: EntitlementsSnapshot | null;
  
  // Normalized map for O(1) lookups
  entitlementsByKey: Record<string, ServerEntitlement>;
  
  // Refresh metadata
  lastRefreshAt: number | null;
  isRefreshing: boolean;
  refreshError: string | null;
  
  // Epoch for invalidating in-flight requests on logout
  entitlementEpoch: number;
  
  // Actions
  hydrateEntitlements: () => Promise<void>;
  refreshFromServer: (reason: RefreshReason) => Promise<void>;
  ensureFreshEntitlements: (reason: RefreshReason) => Promise<void>;  // Phase 3.10: Canonical refresh entry
  applySnapshot: (snap: EntitlementsSnapshot) => void;  // Apply snapshot directly (from verify response)
  clear: () => void;
  
  // Staleness check (Phase 3.10)
  isStale: () => boolean;
  
  // Read helpers (use gating.ts instead for screens)
  hasEntitlement: (key: string) => boolean;
  
  // DEV ONLY - grants for testing (guarded by __DEV__)
  devGrantEntitlement: (key: string) => void;
  devRevokeEntitlement: (key: string) => void;
  devClearAll: () => void;
}

export const useEntitlementStore = create<EntitlementStoreState>((set, get) => ({
  snapshot: null,
  entitlementsByKey: createEmptyEntitlementsMap(),
  lastRefreshAt: null,
  isRefreshing: false,
  refreshError: null,
  entitlementEpoch: 0,  // Bumped on clear() to invalidate in-flight requests

  /**
   * Hydrate from cached snapshot on app startup
   * Does NOT grant - only restores last known server state
   */
  hydrateEntitlements: async () => {
    dlog('[entitlementStore] Hydrating from cache...');
    
    try {
      // Try to load cached snapshot
      const cached = await storageGet(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as EntitlementsSnapshot;
        const normalized = { ...createEmptyEntitlementsMap(), ...parsed.entitlements };
        set({
          snapshot: parsed,
          entitlementsByKey: normalized,
        });
        dlog('[entitlementStore] Hydrated from cache:', Object.keys(normalized).length, 'keys');
      }
      
      // Migrate legacy data if present
      await migrateLegacyData(set, get);
      
    } catch (e) {
      console.error('[entitlementStore] Hydration error:', e);
    }
  },

  /**
   * Refresh entitlements from server
   * This is the ONLY way to get authoritative entitlement state
   * 
   * Phase 3.10: Also checks global authEpoch for cross-store invalidation
   */
  refreshFromServer: async (reason) => {
    if (get().isRefreshing) {
      dlog('[entitlementStore] Already refreshing, skipping');
      return;
    }
    
    const epochAtStart = get().entitlementEpoch;
    const authEpochAtStart = getAuthEpoch();  // Global auth epoch for cross-store check
    
    dlog('[entitlementStore] Refreshing from server, reason:', reason);
    set({ isRefreshing: true, refreshError: null });
    
    try {
      const snap = await getEntitlementsSnapshotApi();
      
      // Epoch check: ignore late response if clear() was called (logout)
      if (get().entitlementEpoch !== epochAtStart) {
        dlog('[entitlementStore] Local epoch mismatch - discarding stale response');
        set({ isRefreshing: false });
        return;
      }
      
      // Global auth epoch check: ignore if user logged out during request
      if (getAuthEpoch() !== authEpochAtStart) {
        dlog('[entitlementStore] Auth epoch mismatch - discarding stale response');
        set({ isRefreshing: false });
        return;
      }
      
      // Strict normalization: fill missing keys as not_owned
      const normalized = { ...createEmptyEntitlementsMap(), ...snap.entitlements };
      
      set({
        snapshot: snap,
        entitlementsByKey: normalized,
        lastRefreshAt: Date.now(),
        isRefreshing: false,
      });
      
      // Persist for offline cache
      await storageSet(STORAGE_KEY, JSON.stringify(snap));
      
      dlog('[entitlementStore] Refreshed from server:', snap.version);
      
    } catch (e: any) {
      // Epoch check before setting error state
      if (get().entitlementEpoch !== epochAtStart || getAuthEpoch() !== authEpochAtStart) {
        dlog('[entitlementStore] Epoch mismatch in error handler - discarding');
        set({ isRefreshing: false });
        return;
      }
      
      const errorMsg = e?.response?.data?.detail || e?.message || 'Failed to refresh entitlements';
      console.error('[entitlementStore] Refresh error:', errorMsg);
      set({
        isRefreshing: false,
        refreshError: errorMsg,
      });
    }
  },

  /**
   * Apply a snapshot directly (used by purchase verify flow)
   * Skips network call - uses snapshot returned from verify endpoint
   */
  applySnapshot: (snap: EntitlementsSnapshot) => {
    dlog('[entitlementStore] Applying snapshot directly, version:', snap.version);
    
    // Strict normalization
    const normalized = { ...createEmptyEntitlementsMap(), ...snap.entitlements };
    
    set({
      snapshot: snap,
      entitlementsByKey: normalized,
      lastRefreshAt: Date.now(),
      refreshError: null,
    });
    
    // Persist for offline cache
    storageSet(STORAGE_KEY, JSON.stringify(snap)).catch(() => {});
  },

  /**
   * Phase 3.10: Check if cached entitlements are stale
   * Uses SERVER time (not device time) for staleness calculation
   * 
   * Stale if: server_now > server_time + ttl_seconds
   */
  isStale: () => {
    const { snapshot } = get();
    
    // No snapshot = stale (need to fetch)
    if (!snapshot) return true;
    
    // Get server time and TTL from snapshot
    const serverTimeStr = snapshot.server_time;
    const ttlSeconds = snapshot.ttl_seconds ?? DEFAULT_TTL_SECONDS;
    
    // Clamp TTL to reasonable bounds
    const clampedTtl = Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, ttlSeconds));
    
    if (!serverTimeStr) {
      // No server time in snapshot - fall back to device time check
      const { lastRefreshAt } = get();
      if (!lastRefreshAt) return true;
      const deviceNow = Date.now();
      return deviceNow > lastRefreshAt + (clampedTtl * 1000);
    }
    
    // Parse server time
    const serverTime = new Date(serverTimeStr).getTime();
    if (isNaN(serverTime)) {
      dlog('[entitlementStore] Invalid server_time in snapshot, treating as stale');
      return true;
    }
    
    // Estimate current server time (server_time + time_since_refresh)
    const { lastRefreshAt } = get();
    const timeSinceRefresh = lastRefreshAt ? Date.now() - lastRefreshAt : 0;
    const estimatedServerNow = serverTime + timeSinceRefresh;
    
    // Stale if estimated server time exceeds expiry
    const expiresAt = serverTime + (clampedTtl * 1000);
    const isStale = estimatedServerNow > expiresAt;
    
    if (__DEV__ && isStale) {
      dlog('[entitlementStore] Cache is stale:', {
        serverTime: new Date(serverTime).toISOString(),
        estimatedServerNow: new Date(estimatedServerNow).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        ttlSeconds: clampedTtl,
      });
    }
    
    return isStale;
  },

  /**
   * Phase 3.10: Canonical refresh entry point
   * 
   * Use this at premium gates instead of direct refreshFromServer calls.
   * Fire-and-forget for non-blocking UX, or await for blocking checks.
   * 
   * Rules:
   * - If no user logged in → no-op
   * - If already refreshing → no-op (dedup)
   * - If not stale → no-op
   * - If stale → trigger refresh
   */
  ensureFreshEntitlements: async (reason: RefreshReason) => {
    // No user = no entitlements to refresh
    const user = getUser();
    if (!user) {
      dlog('[entitlementStore] ensureFresh: no user, skipping');
      return;
    }
    
    // Already refreshing = dedup
    if (get().isRefreshing) {
      dlog('[entitlementStore] ensureFresh: already refreshing, skipping');
      return;
    }
    
    // Not stale = no-op
    if (!get().isStale()) {
      dlog('[entitlementStore] ensureFresh: cache is fresh, skipping');
      return;
    }
    
    dlog('[entitlementStore] ensureFresh: cache stale, refreshing for', reason);
    await get().refreshFromServer(reason);
  },

  /**
   * Clear all entitlement state (on logout)
   * Bumps epoch to invalidate any in-flight requests
   */
  clear: () => {
    dlog('[entitlementStore] Clearing state');
    set((s) => ({
      snapshot: null,
      entitlementsByKey: createEmptyEntitlementsMap(),
      lastRefreshAt: null,
      refreshError: null,
      entitlementEpoch: s.entitlementEpoch + 1,  // Bump to invalidate in-flight requests
    }));
    storageRemove(STORAGE_KEY).catch(() => {});
  },

  /**
   * Check if user has entitlement (internal use)
   * Screens should use gating helpers instead
   */
  hasEntitlement: (key: string) => {
    const { entitlementsByKey, snapshot } = get();
    const entitlement = entitlementsByKey[key];
    if (!entitlement || entitlement.status !== 'owned') return false;
    
    // Check expiry using server time
    if (entitlement.expires_at && snapshot?.server_time) {
      const expiresAt = new Date(entitlement.expires_at).getTime();
      const serverNow = new Date(snapshot.server_time).getTime();
      if (serverNow > expiresAt) return false;
    }
    
    return true;
  },

  // ═══════════════════════════════════════════════════════════
  // DEV ONLY METHODS - For testing paywalls/features
  // These should NEVER be called in production code paths
  // ═══════════════════════════════════════════════════════════

  devGrantEntitlement: (key: string) => {
    if (!__DEV__) {
      console.warn('[entitlementStore] devGrantEntitlement called in production - BLOCKED');
      return;
    }
    
    const { entitlementsByKey } = get();
    const updated = {
      ...entitlementsByKey,
      [key]: {
        key,
        status: 'owned' as const,
        granted_at: new Date().toISOString(),
        reason: 'admin' as const,
      },
    };
    
    // Create fake snapshot for dev
    const fakeSnapshot: EntitlementsSnapshot = {
      server_time: new Date().toISOString(),
      version: Date.now(),
      username: 'DEV_USER',
      entitlements: updated,
      source: 'database',
    };
    
    set({ 
      entitlementsByKey: updated,
      snapshot: fakeSnapshot,
    });
    dlog('[entitlementStore] DEV: Granted', key);
  },

  devRevokeEntitlement: (key: string) => {
    if (!__DEV__) {
      console.warn('[entitlementStore] devRevokeEntitlement called in production - BLOCKED');
      return;
    }
    
    const { entitlementsByKey } = get();
    const updated = {
      ...entitlementsByKey,
      [key]: {
        key,
        status: 'not_owned' as const,
      },
    };
    
    set({ entitlementsByKey: updated });
    dlog('[entitlementStore] DEV: Revoked', key);
  },

  devClearAll: () => {
    if (!__DEV__) {
      console.warn('[entitlementStore] devClearAll called in production - BLOCKED');
      return;
    }
    
    set({ 
      entitlementsByKey: createEmptyEntitlementsMap(),
      snapshot: null,
    });
    storageRemove(STORAGE_KEY).catch(() => {});
    dlog('[entitlementStore] DEV: Cleared all entitlements');
  },
}));

/**
 * Migrate legacy entitlement data to new format
 */
async function migrateLegacyData(
  set: (state: Partial<EntitlementStoreState>) => void,
  get: () => EntitlementStoreState
) {
  try {
    const legacyData = await storageGet(LEGACY_STORAGE_KEY);
    if (!legacyData) return;
    
    dlog('[entitlementStore] Migrating legacy data...');
    
    const legacy = JSON.parse(legacyData);
    const { entitlementsByKey } = get();
    const updated = { ...entitlementsByKey };
    
    // Migrate each legacy key
    for (const [oldKey, value] of Object.entries(legacy)) {
      if (value) {
        const newKey = migrateLegacyKey(oldKey);
        updated[newKey] = {
          key: newKey,
          status: 'owned',
          granted_at: new Date().toISOString(),
          reason: 'unknown',
        };
        dlog('[entitlementStore] Migrated:', oldKey, '->', newKey);
      }
    }
    
    set({ entitlementsByKey: updated });
    
    // Remove legacy data after migration
    await storageRemove(LEGACY_STORAGE_KEY);
    dlog('[entitlementStore] Legacy migration complete');
    
  } catch (e) {
    console.error('[entitlementStore] Legacy migration error:', e);
  }
}
