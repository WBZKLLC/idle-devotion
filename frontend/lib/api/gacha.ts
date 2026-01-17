// /app/frontend/lib/api/gacha.ts
// Phase 3.33: Gacha/Summon API wrapper
//
// All gacha operations go through here.
// Uses canonical receipt system.
// Server-authoritative - NO client-side RNG.

import { loadAuthToken } from '../authStorage';
import { track, Events } from '../telemetry/events';
import { GachaReceipt, isValidGachaReceipt } from '../types/receipt';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// Auth header helper
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await loadAuthToken();
  if (!token) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// =============================================================================
// TYPES
// =============================================================================

export interface BannerInfo {
  id: string;  // standard, premium, divine, or featured banner ID
  name: string;
  description: string;
  currency: string;  // coins, crystals, divine_essence
  costSingle: number;
  costMulti: number;
  rates: Record<string, number>;  // { "SR": 0.9, "SSR": 0.08, ... }
  pityThreshold: number;
  guaranteedRarity: string;  // SSR+, UR, UR+
  featuredHeroId?: string;  // For featured banners
  featuredHeroName?: string;
  endsAt?: string;  // ISO timestamp for limited banners
}

export interface PityStatus {
  bannerId: string;
  current: number;
  threshold: number;
  guaranteed: string;
}

export interface GachaBannersResponse {
  banners: BannerInfo[];
  pity: Record<string, PityStatus>;  // keyed by bannerId
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get all available gacha banners + user pity state
 */
export async function getGachaBanners(): Promise<GachaBannersResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/gacha/banners`, { headers });
  
  if (!res.ok) {
    throw new Error('Failed to fetch gacha banners');
  }
  
  const data = await res.json();
  
  // Transform backend response to frontend types
  const banners: BannerInfo[] = (data.banners || []).map((b: any) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    currency: b.currency,
    costSingle: b.cost_single,
    costMulti: b.cost_multi,
    rates: b.rates,
    pityThreshold: b.pity,
    guaranteedRarity: b.guaranteed,
    featuredHeroId: b.featured_hero_id,
    featuredHeroName: b.featured_hero_name,
    endsAt: b.ends_at,
  }));
  
  return {
    banners,
    pity: data.pity || {},
  };
}

/**
 * Get pity status for all banners
 */
export async function getPityStatus(): Promise<Record<string, PityStatus>> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/gacha/pity`, { headers });
  
  if (!res.ok) {
    throw new Error('Failed to fetch pity status');
  }
  
  return await res.json();
}

/**
 * Perform a gacha summon (canonical receipt)
 * 
 * @param bannerId - Banner to pull from (standard, premium, divine)
 * @param count - 1 for single, 10 for multi
 * @param sourceId - Client-generated unique ID for idempotency (optional)
 */
export async function summon(
  bannerId: string,
  count: 1 | 10,
  sourceId?: string
): Promise<GachaReceipt> {
  const headers = await getAuthHeaders();
  
  // Emit telemetry: summon submitted
  track(Events.GACHA_SUMMON_SUBMITTED, {
    bannerId,
    count,
    sourceId,
  });
  
  const body: Record<string, any> = {
    banner_id: bannerId,
    count,
  };
  
  if (sourceId) {
    body.source_id = sourceId;
  }
  
  const res = await fetch(`${API_BASE}/api/gacha/summon`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    track(Events.GACHA_SUMMON_ERROR, {
      bannerId,
      count,
      status: res.status,
      error: errorData.detail || 'Unknown error',
    });
    throw new Error(errorData.detail || 'Summon failed');
  }
  
  const receipt = await res.json();
  
  // Emit telemetry: summon success
  track(Events.GACHA_SUMMON_SUCCESS, {
    bannerId,
    count,
    sourceId: receipt.sourceId,
    heroCount: receipt.results?.filter((r: any) => !r.isFiller).length || 0,
    fillerCount: receipt.results?.filter((r: any) => r.isFiller).length || 0,
    pityTriggered: receipt.pityTriggered,
  });
  
  // Emit pity telemetry
  if (receipt.pityTriggered) {
    track(Events.GACHA_PITY_TRIGGERED, {
      bannerId,
      pityBefore: receipt.pityBefore,
    });
  } else if (receipt.pityAfter > receipt.pityBefore) {
    track(Events.GACHA_PITY_INCREMENTED, {
      bannerId,
      pityBefore: receipt.pityBefore,
      pityAfter: receipt.pityAfter,
    });
  }
  
  return receipt;
}

/**
 * Generate a client-side source ID for idempotency
 * Uses timestamp + counter to ensure uniqueness
 * NOTE: This is NOT used for RNG decisions - only for deduplication
 */
let sourceIdCounter = 0;
export function generateSourceId(): string {
  sourceIdCounter = (sourceIdCounter + 1) % 10000;
  return `summon_${Date.now()}_${sourceIdCounter.toString().padStart(4, '0')}`;
}

// =============================================================================
// PHASE 3.35: INSUFFICIENT FUNDS ERROR TYPE
// =============================================================================

export interface InsufficientFundsError {
  code: 'INSUFFICIENT_FUNDS';
  message: string;
  currency: string;
  required: number;
  available: number;
  deficit: number;
}

export function isInsufficientFundsError(error: unknown): error is InsufficientFundsError {
  if (!error || typeof error !== 'object') return false;
  return (error as Record<string, unknown>).code === 'INSUFFICIENT_FUNDS';
}

// =============================================================================
// PHASE 3.35: GACHA HISTORY
// =============================================================================

export interface GachaHistoryItem {
  sourceId: string;
  bannerId: string;
  pullCount: number;
  at: string;
  pityBefore: number;
  pityAfter: number;
  pityTriggered: boolean;
  summary: {
    rarities: Record<string, number>;
    newHeroes: number;
    duplicates: number;
    fillers: number;
  };
  currencySpent: {
    type: string;
    amount: number;
  };
  results: Array<{
    heroDataId: string;
    heroName: string;
    rarity: string;
    outcome: string;
    isFiller: boolean;
  }>;
}

export interface GachaHistoryResponse {
  history: GachaHistoryItem[];
  count: number;
}

/**
 * Get user's gacha summon history (Phase 3.35)
 */
export async function getGachaHistory(limit: number = 50): Promise<GachaHistoryResponse> {
  const headers = await getAuthHeaders();
  
  track(Events.GACHA_HISTORY_VIEWED, { limit });
  
  const res = await fetch(`${API_BASE}/api/gacha/history?limit=${limit}`, { headers });
  
  if (!res.ok) {
    throw new Error('Failed to fetch gacha history');
  }
  
  return await res.json();
}
