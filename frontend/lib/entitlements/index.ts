// /app/frontend/lib/entitlements/index.ts
// Entitlements module - re-exports for clean imports

export * from './types';
export * from './gating';

// Legacy exports (for backwards compatibility with existing code)
export { 
  premiumCinematicOwnedKey,
  LEGACY_PACK_KEY,
  LEGACY_OWNED_PREFIX,
  migrateLegacyKey,
} from './legacy';
