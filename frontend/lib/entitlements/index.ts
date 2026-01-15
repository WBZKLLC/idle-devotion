// /app/frontend/lib/entitlements/index.ts
// Entitlements module - re-exports for clean imports
// NOTE: gating.ts is NOT re-exported here to avoid circular deps
// Import gating helpers directly from './gating'

export * from './types';

// Purchase flow helpers
export {
  startPurchaseFlow,
  verifyAndApplyPurchase,
  cancelPurchaseFlow,
  resetPurchaseFlow,
  getPendingPurchase,
} from './purchase-flow';

// Phase 3.11: Canonical navigation helpers
export {
  goToPaywall,
  goToStore,
  goToPurchaseSuccess,
  getPaywallRoute,
  getStoreRoute,
  KNOWN_SOURCES,
  type PaywallSource,
  type GoToPaywallOptions,
} from './navigation';

// Legacy exports (for backwards compatibility with existing code)
export { 
  premiumCinematicOwnedKey,
  LEGACY_PACK_KEY,
  LEGACY_OWNED_PREFIX,
  migrateLegacyKey,
} from './legacy';
