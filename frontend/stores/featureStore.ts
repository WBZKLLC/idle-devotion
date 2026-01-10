// /app/frontend/stores/featureStore.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { fetchRemoteFeatures } from '../lib/api';
import {
  FEATURES_STORAGE_KEY,
  clampTtlSeconds,
  type RemoteFeaturesPayload,
} from '../lib/featureUtils';
import { setRemoteFeatures } from '../lib/features';

type StoredFeatureCache = {
  savedAt: number;
  nextFetchAt: number;
  payload: RemoteFeaturesPayload;
};

type RefreshOpts = {
  force?: boolean;
};

type FeatureStoreState = {
  featuresReady: boolean;
  lastError: string | null;

  // cache metadata (optional, handy for debugging screens)
  remoteVersion: number | null;
  nextFetchAt: number | null;
  savedAt: number | null;

  hydrateRemoteFeatures: () => Promise<void>;
  refreshRemoteFeatures: (opts?: RefreshOpts) => Promise<void>;
  clearCachedFeatures: () => Promise<void>;
};

async function readCache(): Promise<StoredFeatureCache | null> {
  const raw = await AsyncStorage.getItem(FEATURES_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredFeatureCache;
    if (!parsed?.payload?.flags || typeof parsed?.payload?.version !== 'number') return null;
    if (typeof parsed.savedAt !== 'number' || typeof parsed.nextFetchAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(payload: RemoteFeaturesPayload, ttlSeconds: number): Promise<StoredFeatureCache> {
  const now = Date.now();
  const nextFetchAt = now + ttlSeconds * 1000;

  const stored: StoredFeatureCache = {
    savedAt: now,
    nextFetchAt,
    payload,
  };

  await AsyncStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export const useFeatureStore = create<FeatureStoreState>((set, get) => ({
  featuresReady: false,
  lastError: null,

  remoteVersion: null,
  nextFetchAt: null,
  savedAt: null,

  hydrateRemoteFeatures: async () => {
    // 1) apply cached payload immediately (if present)
    const cached = await readCache();
    if (cached) {
      setRemoteFeatures(cached.payload);
      set({
        remoteVersion: cached.payload.version ?? null,
        nextFetchAt: cached.nextFetchAt,
        savedAt: cached.savedAt,
      });
    }

    // Mark ready after cache apply (or even if none)
    set({ featuresReady: true });

    // 2) refresh if expired (don't block UI)
    const now = Date.now();
    const shouldFetch = !cached || cached.nextFetchAt <= now;
    if (shouldFetch) {
      await get().refreshRemoteFeatures({ force: true });
    }
  },

  refreshRemoteFeatures: async (opts?: RefreshOpts) => {
    const force = !!opts?.force;
    const now = Date.now();

    if (!force) {
      const nextFetchAt = get().nextFetchAt;
      if (typeof nextFetchAt === 'number' && nextFetchAt > now) return;
    }

    try {
      const payload = await fetchRemoteFeatures();

      // TTL clamp protects you from backend mistakes
      const ttlSeconds = clampTtlSeconds(payload.ttlSeconds);

      // Apply remote in-memory first
      setRemoteFeatures(payload);

      // Persist + update store metadata
      const stored = await writeCache(payload, ttlSeconds);

      set({
        lastError: null,
        remoteVersion: payload.version ?? null,
        nextFetchAt: stored.nextFetchAt,
        savedAt: stored.savedAt,
      });
    } catch (e: any) {
      set({
        lastError: e?.message ? String(e.message) : 'Failed to refresh remote feature flags',
      });
      // Do NOT clear remote features here; keep cached/default behavior stable.
    }
  },

  clearCachedFeatures: async () => {
    await AsyncStorage.removeItem(FEATURES_STORAGE_KEY);
    set({
      remoteVersion: null,
      nextFetchAt: null,
      savedAt: null,
      lastError: null,
    });
  },
}));
