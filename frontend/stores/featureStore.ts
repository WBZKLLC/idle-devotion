// /app/frontend/stores/featureStore.ts
/**
 * Feature Flag Store
 * 
 * Responsibilities:
 * - Fetch remote flags on app start
 * - Cache to AsyncStorage with TTL
 * - Honor TTL (don't spam server)
 * - Expose featuresReady for screens that care
 * 
 * Boot sequence:
 * 1. Load cached payload from AsyncStorage
 * 2. Apply it immediately (setRemoteFlags)
 * 3. If expired → fetch from backend → apply → persist
 * 4. If anything fails: keep defaults + cached
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setRemoteFlags,
  RemoteFeaturesPayload,
} from '../lib/features';
import {
  FEATURES_STORAGE_KEY,
  CachedFeaturesPayload,
  DEFAULT_TTL_SECONDS,
  MIN_FETCH_INTERVAL_MS,
} from '../lib/featureUtils';
import { fetchRemoteFeatures } from '../lib/api';

interface FeatureStoreState {
  // State
  remoteFlags: Record<string, unknown>;
  featuresVersion: number;
  nextFetchAt: number; // ms epoch
  featuresReady: boolean;
  lastError: string | null;

  // Actions
  hydrateRemoteFeatures: () => Promise<void>;
  refreshRemoteFeatures: (opts?: { force?: boolean }) => Promise<void>;
}

export const useFeatureStore = create<FeatureStoreState>((set, get) => ({
  // Initial state
  remoteFlags: {},
  featuresVersion: 0,
  nextFetchAt: 0,
  featuresReady: false,
  lastError: null,

  /**
   * Hydrate remote features on app boot.
   * Loads from cache first, then fetches if expired.
   */
  hydrateRemoteFeatures: async () => {
    try {
      // 1. Load from cache
      const cached = await loadFromCache();
      
      if (cached) {
        // Apply cached flags immediately
        setRemoteFlags(cached.payload as RemoteFeaturesPayload);
        set({
          remoteFlags: cached.payload.flags,
          featuresVersion: cached.payload.version,
          nextFetchAt: cached.nextFetchAt,
        });
        
        if (__DEV__) {
          console.log('[featureStore] Loaded cached flags, version:', cached.payload.version);
        }
      }

      // Mark as ready (we have at least defaults + cache)
      set({ featuresReady: true });

      // 2. Check if we should fetch fresh data
      const now = Date.now();
      const shouldFetch = !cached || now >= cached.nextFetchAt;
      
      if (shouldFetch) {
        await get().refreshRemoteFeatures();
      }
    } catch (error: any) {
      console.error('[featureStore] Hydration error:', error);
      set({ featuresReady: true, lastError: error?.message });
      // Keep defaults - don't crash the app
    }
  },

  /**
   * Fetch fresh remote features from backend.
   * @param opts.force - Bypass TTL check
   */
  refreshRemoteFeatures: async (opts?: { force?: boolean }) => {
    const { nextFetchAt } = get();
    const now = Date.now();

    // Check TTL unless forced
    if (!opts?.force && now < nextFetchAt) {
      if (__DEV__) {
        const remaining = Math.round((nextFetchAt - now) / 1000);
        console.log(`[featureStore] Skipping fetch, TTL expires in ${remaining}s`);
      }
      return;
    }

    // Prevent spam even with force (min 5 min between fetches)
    const lastFetch = nextFetchAt - (get().remoteFlags ? DEFAULT_TTL_SECONDS * 1000 : 0);
    if (!opts?.force && now - lastFetch < MIN_FETCH_INTERVAL_MS) {
      return;
    }

    try {
      if (__DEV__) console.log('[featureStore] Fetching remote features...');
      
      const payload = await fetchRemoteFeatures();
      
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload shape');
      }

      // Apply to feature system
      setRemoteFlags(payload);

      // Calculate next fetch time
      const ttlMs = (payload.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
      const nextFetch = now + ttlMs;

      // Update store
      set({
        remoteFlags: payload.flags ?? {},
        featuresVersion: payload.version ?? 0,
        nextFetchAt: nextFetch,
        lastError: null,
      });

      // Persist to cache
      await saveToCache({
        savedAt: now,
        nextFetchAt: nextFetch,
        payload,
      });

      if (__DEV__) {
        console.log('[featureStore] Remote features updated, version:', payload.version);
      }
    } catch (error: any) {
      console.error('[featureStore] Fetch error:', error);
      set({ lastError: error?.message });
      // Don't update flags on error - keep cached/defaults
    }
  },
}));

// ─────────────────────────────────────────────────────────────
// CACHE HELPERS
// ─────────────────────────────────────────────────────────────

async function loadFromCache(): Promise<CachedFeaturesPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(FEATURES_STORAGE_KEY);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw) as CachedFeaturesPayload;
    
    // Validate shape
    if (
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.nextFetchAt !== 'number' ||
      !parsed.payload ||
      typeof parsed.payload !== 'object'
    ) {
      console.warn('[featureStore] Invalid cache shape, ignoring');
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.warn('[featureStore] Failed to load cache:', error);
    return null;
  }
}

async function saveToCache(data: CachedFeaturesPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[featureStore] Failed to save cache:', error);
  }
}
