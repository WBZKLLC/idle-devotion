/**
 * Phase 4.2: PvP Season API Wrappers
 * 
 * All calls use centralized api instance from lib/api.ts.
 * Returns canonical receipts for claim operations.
 */

import { api } from '../api';
import { track, Events } from '../telemetry/events';

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface PvpSeasonResponse {
  season_id: string;
  name: string;
  start_at: string;
  end_at: string;
  time_remaining_seconds: number;
  current_rank_band: string;
  rating: number;
}

export interface RankReward {
  rank_band: string;
  min_rating: number;
  rewards: Record<string, number>;
  title?: string;
  frame?: string;
}

export interface PvpRewardsPreviewResponse {
  rewards: RankReward[];
  note: string;
}

export interface PvpClaimReceipt {
  success: boolean;
  source: 'pvp_daily_claim' | 'pvp_season_claim';
  error?: string;
  rank_band: string;
  rewards: Record<string, number>;
  balances_before?: Record<string, number>;
  balances_after?: Record<string, number>;
  claim_date?: string;
  season_id?: string;
  title?: string;
  frame?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// API Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get current PvP season info.
 */
export async function getPvpSeason(): Promise<PvpSeasonResponse> {
  const res = await api.get('/pvp/season');
  return res.data;
}

/**
 * Get preview of all rank band rewards.
 */
export async function getPvpRewardsPreview(): Promise<PvpRewardsPreviewResponse> {
  const res = await api.get('/pvp/rewards/preview');
  return res.data;
}

/**
 * Claim daily PvP participation reward.
 * 
 * @param sourceId - Idempotency key (use makeSourceId('pvp_daily'))
 * @returns Canonical receipt for ReceiptViewer
 */
export async function claimPvpDaily(sourceId: string): Promise<PvpClaimReceipt> {
  track(Events.PVP_DAILY_CLAIM_SUBMITTED, { sourceId });
  
  try {
    const res = await api.post('/pvp/daily/claim', { source_id: sourceId });
    const data = res.data as PvpClaimReceipt;
    
    if (data.error === 'already_claimed') {
      track(Events.PVP_DAILY_CLAIM_ALREADY_CLAIMED, { sourceId });
    } else if (data.success) {
      track(Events.PVP_DAILY_CLAIM_SUCCESS, { sourceId, rank_band: data.rank_band });
    }
    
    return data;
  } catch (error: any) {
    track(Events.PVP_DAILY_CLAIM_ERROR, { sourceId, error: error.message });
    throw error;
  }
}

/**
 * Claim end-of-season PvP reward.
 * 
 * @param sourceId - Idempotency key (use makeSourceId('pvp_season'))
 * @param seasonId - Season ID to claim for
 * @returns Canonical receipt for ReceiptViewer
 */
export async function claimPvpSeason(sourceId: string, seasonId?: string): Promise<PvpClaimReceipt> {
  track(Events.PVP_SEASON_CLAIM_SUBMITTED, { sourceId, seasonId });
  
  try {
    const res = await api.post('/pvp/season/claim', { 
      source_id: sourceId,
      season_id: seasonId 
    });
    const data = res.data as PvpClaimReceipt;
    
    if (data.error === 'already_claimed') {
      track(Events.PVP_SEASON_CLAIM_ALREADY_CLAIMED, { sourceId });
    } else if (data.success) {
      track(Events.PVP_SEASON_CLAIM_SUCCESS, { sourceId, rank_band: data.rank_band });
    }
    
    return data;
  } catch (error: any) {
    track(Events.PVP_SEASON_CLAIM_ERROR, { sourceId, error: error.message });
    throw error;
  }
}
