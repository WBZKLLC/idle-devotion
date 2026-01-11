/**
 * Entitlement Store
 * 
 * Manages paid feature entitlements (offline-first, cached).
 * Supports both global keys (PAID_CINEMATICS_PACK) and
 * dynamic per-hero keys (CINEMATIC_OWNED:<heroId>).
 * 
 * Future: will integrate with StoreKit/Play Billing for real purchases.
 */

import { create } from 'zustand';
import { storageGet, storageSet, storageRemove } from '../lib/storage';
import { cinematicOwnedKey } from '../lib/entitlements';

const STORAGE_KEY = '@idledevotion/entitlements/v2';

interface EntitlementState {
  // Dynamic map: supports any string key (global or per-hero)
  entitlements: Record<string, boolean>;
  isHydrated: boolean;
  
  // Actions
  hydrateEntitlements: () => Promise<void>;
  
  // Generic entitlement checks
  hasEntitlement: (key: string) => boolean;
  setEntitlement: (key: string, value: boolean) => Promise<void>;
  
  // Convenience: per-hero cinematic ownership
  hasHeroCinematicOwned: (heroId: string) => boolean;
  setHeroCinematicOwned: (heroId: string, owned: boolean) => Promise<void>;
  
  // DEV-only helpers
  grantEntitlementDevOnly: (key: string) => Promise<void>;
  revokeEntitlementDevOnly: (key: string) => Promise<void>;
  clearAllEntitlementsDevOnly: () => Promise<void>;
}

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  entitlements: {},
  isHydrated: false,

  hydrateEntitlements: async () => {
    try {
      const raw = await storageGet(STORAGE_KEY);
      if (!raw) {
        set({ isHydrated: true });
        return;
      }
      const parsed = JSON.parse(raw);
      set({ entitlements: parsed?.entitlements ?? {}, isHydrated: true });
      if (__DEV__) {
        console.log('[entitlementStore] Hydrated:', Object.keys(parsed?.entitlements ?? {}));
      }
    } catch (e) {
      console.error('[entitlementStore] Hydration error:', e);
      set({ isHydrated: true });
    }
  },

  hasEntitlement: (key: string) => Boolean(get().entitlements[key]),

  setEntitlement: async (key: string, value: boolean) => {
    const current = get().entitlements;
    const next = { ...current };
    if (value) {
      next[key] = true;
    } else {
      delete next[key];
    }
    set({ entitlements: next });
    await storageSet(STORAGE_KEY, JSON.stringify({ entitlements: next }));
    if (__DEV__) {
      console.log(`[entitlementStore] Set ${key} = ${value}`);
    }
  },

  // Convenience: per-hero cinematic ownership
  hasHeroCinematicOwned: (heroId: string) => {
    const key = cinematicOwnedKey(heroId);
    return Boolean(get().entitlements[key]);
  },

  setHeroCinematicOwned: async (heroId: string, owned: boolean) => {
    const key = cinematicOwnedKey(heroId);
    await get().setEntitlement(key, owned);
  },

  // DEV ONLY: Grant entitlement for testing
  grantEntitlementDevOnly: async (key: string) => {
    if (!__DEV__) {
      console.warn('[entitlementStore] grantEntitlementDevOnly called in production!');
      return;
    }
    await get().setEntitlement(key, true);
    console.log('[entitlementStore] DEV: Granted', key);
  },

  // DEV ONLY: Revoke entitlement for testing
  revokeEntitlementDevOnly: async (key: string) => {
    if (!__DEV__) {
      console.warn('[entitlementStore] revokeEntitlementDevOnly called in production!');
      return;
    }
    await get().setEntitlement(key, false);
    console.log('[entitlementStore] DEV: Revoked', key);
  },

  // DEV ONLY: Clear all entitlements
  clearAllEntitlementsDevOnly: async () => {
    if (!__DEV__) {
      console.warn('[entitlementStore] clearAllEntitlementsDevOnly called in production!');
      return;
    }
    set({ entitlements: {} });
    await storageRemove(STORAGE_KEY);
    console.log('[entitlementStore] DEV: Cleared all entitlements');
  },
}));
