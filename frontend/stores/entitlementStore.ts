/**
 * Entitlement Store
 * 
 * Manages paid feature entitlements (offline-first, cached).
 * Future: will integrate with StoreKit/Play Billing for real purchases.
 */

import { create } from 'zustand';
import { storageGet, storageSet, storageRemove } from '../lib/storage';
import type { EntitlementKey } from '../lib/entitlements';

const STORAGE_KEY = '@idledevotion/entitlements/v1';

interface EntitlementState {
  entitlements: Partial<Record<EntitlementKey, boolean>>;
  isHydrated: boolean;
  
  // Actions
  hydrateEntitlements: () => Promise<void>;
  hasEntitlement: (k: EntitlementKey) => boolean;
  
  // Future: real purchase/restore hooks
  // For now, DEV-only helper for testing
  grantEntitlementDevOnly: (k: EntitlementKey) => Promise<void>;
  revokeEntitlementDevOnly: (k: EntitlementKey) => Promise<void>;
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
        console.log('[entitlementStore] Hydrated:', parsed?.entitlements);
      }
    } catch (e) {
      console.error('[entitlementStore] Hydration error:', e);
      set({ isHydrated: true });
    }
  },

  hasEntitlement: (k) => Boolean(get().entitlements?.[k]),

  // DEV ONLY: Grant entitlement for testing
  grantEntitlementDevOnly: async (k) => {
    if (!__DEV__) {
      console.warn('[entitlementStore] grantEntitlementDevOnly called in production!');
      return;
    }
    const next = { ...(get().entitlements ?? {}), [k]: true };
    set({ entitlements: next });
    await storageSet(STORAGE_KEY, JSON.stringify({ entitlements: next }));
    console.log('[entitlementStore] DEV: Granted', k);
  },

  // DEV ONLY: Revoke entitlement for testing
  revokeEntitlementDevOnly: async (k) => {
    if (!__DEV__) {
      console.warn('[entitlementStore] revokeEntitlementDevOnly called in production!');
      return;
    }
    const next = { ...(get().entitlements ?? {}) };
    delete next[k];
    set({ entitlements: next });
    await storageSet(STORAGE_KEY, JSON.stringify({ entitlements: next }));
    console.log('[entitlementStore] DEV: Revoked', k);
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
