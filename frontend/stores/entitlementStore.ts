/**
 * Entitlement Store
 * 
 * Manages paid feature entitlements (offline-first, cached).
 * Supports both global keys (PREMIUM_CINEMATICS_PACK) and
 * dynamic per-hero keys (PREMIUM_CINEMATIC_OWNED:<heroId>).
 * 
 * MIGRATION: Automatically migrates old keys (PAID_CINEMATICS_PACK,
 * CINEMATIC_OWNED:*) to new format on hydration.
 * 
 * Future: will integrate with StoreKit/Play Billing for real purchases.
 */

import { create } from 'zustand';
import { storageGet, storageSet, storageRemove } from '../lib/storage';
import { 
  premiumCinematicOwnedKey, 
  LEGACY_PACK_KEY, 
  LEGACY_OWNED_PREFIX,
  migrateLegacyKey 
} from '../lib/entitlements';

const STORAGE_KEY = '@idledevotion/entitlements/v3';
const LEGACY_STORAGE_KEY = '@idledevotion/entitlements/v2';

interface EntitlementState {
  // Dynamic map: supports any string key (global or per-hero)
  entitlements: Record<string, boolean>;
  isHydrated: boolean;
  
  // Actions
  hydrateEntitlements: () => Promise<void>;
  
  // Generic entitlement checks
  hasEntitlement: (key: string) => boolean;
  setEntitlement: (key: string, value: boolean) => Promise<void>;
  
  // Convenience: per-hero premium cinematic ownership
  hasHeroPremiumCinematicOwned: (heroId: string) => boolean;
  setHeroPremiumCinematicOwned: (heroId: string, owned: boolean) => Promise<void>;
  
  // DEV-only helpers
  grantEntitlementDevOnly: (key: string) => Promise<void>;
  revokeEntitlementDevOnly: (key: string) => Promise<void>;
  clearAllEntitlementsDevOnly: () => Promise<void>;
}

/**
 * Migrate legacy entitlements to new format
 */
function migrateEntitlements(oldEntitlements: Record<string, boolean>): Record<string, boolean> {
  const newEntitlements: Record<string, boolean> = {};
  let migrated = false;
  
  for (const [key, value] of Object.entries(oldEntitlements)) {
    const newKey = migrateLegacyKey(key);
    if (newKey !== key) {
      migrated = true;
      if (__DEV__) {
        console.log(`[entitlementStore] Migrating ${key} -> ${newKey}`);
      }
    }
    newEntitlements[newKey] = value;
  }
  
  if (migrated && __DEV__) {
    console.log('[entitlementStore] Migration complete');
  }
  
  return newEntitlements;
}

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  entitlements: {},
  isHydrated: false,

  hydrateEntitlements: async () => {
    try {
      // Try new storage key first
      let raw = await storageGet(STORAGE_KEY);
      let needsMigration = false;
      
      // If not found, try legacy key
      if (!raw) {
        raw = await storageGet(LEGACY_STORAGE_KEY);
        if (raw) {
          needsMigration = true;
          if (__DEV__) {
            console.log('[entitlementStore] Found legacy storage, will migrate');
          }
        }
      }
      
      if (!raw) {
        set({ isHydrated: true });
        return;
      }
      
      const parsed = JSON.parse(raw);
      let entitlements = parsed?.entitlements ?? {};
      
      // Migrate legacy keys to new format
      entitlements = migrateEntitlements(entitlements);
      
      set({ entitlements, isHydrated: true });
      
      // If we migrated, save to new storage and clean up
      if (needsMigration) {
        await storageSet(STORAGE_KEY, JSON.stringify({ entitlements }));
        await storageRemove(LEGACY_STORAGE_KEY);
        if (__DEV__) {
          console.log('[entitlementStore] Migrated to new storage key');
        }
      }
      
      if (__DEV__) {
        console.log('[entitlementStore] Hydrated:', Object.keys(entitlements));
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

  // Convenience: per-hero premium cinematic ownership
  hasHeroPremiumCinematicOwned: (heroId: string) => {
    const key = premiumCinematicOwnedKey(heroId);
    return Boolean(get().entitlements[key]);
  },

  setHeroPremiumCinematicOwned: async (heroId: string, owned: boolean) => {
    const key = premiumCinematicOwnedKey(heroId);
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
