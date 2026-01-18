// /app/frontend/lib/api/heroProgression.ts
// Phase 3.39-3.41: Hero Progression API
//
// Server-authoritative hero star/stat system.
// All mutations go through canonical receipts.
// NO CLIENT-SIDE STAR/STAT MUTATIONS.

// Auth handled by config.ts
import { track, Events } from '../telemetry/events';
import { apiUrl, getAuthHeaders } from './config';

// =============================================================================
// TYPES
// =============================================================================

export interface StarTableEntry {
  shardCost: number;
  statMultiplier: number;
}

export interface ProgressionTable {
  starTable: Record<string, StarTableEntry>;
  maxStar: number;
  baseStatsByRarity: Record<string, { hp: number; atk: number; def: number }>;
  affinityMultipliers: Record<string, number>;
}

export interface HeroStats {
  baseStats: { hp: number; atk: number; def: number };
  starMultiplier: number;
  affinityMultiplier: number;
  starBonus: { hp: number; atk: number; def: number };
  affinityBonus: { hp: number; atk: number; def: number };
  finalStats: { hp: number; atk: number; def: number };
}

export interface HeroStatsResponse {
  heroId: string;
  rarity: string;
  star: number;
  affinityTier: number;
  shards: number;
  stats: HeroStats;
  promotion: {
    canPromote: boolean;
    nextStar: number | null;
    shardCost: number;
    hasEnoughShards: boolean;
    maxStarReached: boolean;
  };
}

export interface PromotionReceipt {
  source: 'hero_promotion';
  sourceId: string;
  heroId: string;
  heroDelta: {
    starBefore: number;
    starAfter: number;
  };
  shardsSpent: number;
  items: Array<{ type: string; amount: number; hero_id?: string }>;
  balances: Record<string, number>;
  alreadyClaimed: boolean;
}

export interface InsufficientShardsError {
  code: 'INSUFFICIENT_SHARDS';
  message: string;
  required: number;
  available: number;
  deficit: number;
}

export function isInsufficientShardsError(error: unknown): error is InsufficientShardsError {
  if (!error || typeof error !== 'object') return false;
  return (error as Record<string, unknown>).code === 'INSUFFICIENT_SHARDS';
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get the locked progression table (read-only)
 */
export async function getProgressionTable(): Promise<ProgressionTable> {
  const res = await fetch(apiUrl('/api/hero/progression-table'));
  
  if (!res.ok) {
    throw new Error('Failed to fetch progression table');
  }
  
  return await res.json();
}

/**
 * Get server-derived stats for a hero (Phase 3.41)
 */
export async function getHeroStats(heroId: string): Promise<HeroStatsResponse> {
  const headers = await getAuthHeaders();
  
  track(Events.HERO_STATS_VIEWED, { heroId });
  
  const res = await fetch(apiUrl(`/api/hero/${heroId}/stats`), { headers });
  
  if (!res.ok) {
    throw new Error('Failed to fetch hero stats');
  }
  
  return await res.json();
}

/**
 * Promote hero to next star (Phase 3.39)
 * 
 * @param heroId - Hero to promote
 * @param sourceId - Client-generated ID for idempotency
 */
export async function promoteHero(
  heroId: string,
  sourceId: string
): Promise<PromotionReceipt> {
  const headers = await getAuthHeaders();
  
  track(Events.HERO_PROMOTION_SUBMITTED, { heroId, sourceId });
  
  const res = await fetch(apiUrl('/api/hero/promote'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      hero_id: heroId,
      source_id: sourceId,
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    
    if (errorData.code === 'INSUFFICIENT_SHARDS') {
      track(Events.HERO_PROMOTION_INSUFFICIENT_SHARDS, {
        heroId,
        required: errorData.required,
        available: errorData.available,
      });
    } else {
      track(Events.HERO_PROMOTION_FAILED, {
        heroId,
        error: errorData.code || errorData.detail || 'Unknown error',
      });
    }
    
    throw errorData;
  }
  
  const receipt = await res.json();
  
  track(Events.HERO_PROMOTION_SUCCESS, {
    heroId,
    starBefore: receipt.heroDelta.starBefore,
    starAfter: receipt.heroDelta.starAfter,
    shardsSpent: receipt.shardsSpent,
  });
  
  return receipt;
}

/**
 * Generate source ID for promotion
 */
let promotionCounter = 0;
export function generatePromotionSourceId(heroId: string): string {
  promotionCounter = (promotionCounter + 1) % 10000;
  return `promote_${heroId}_${Date.now()}_${promotionCounter.toString().padStart(4, '0')}`;
}
