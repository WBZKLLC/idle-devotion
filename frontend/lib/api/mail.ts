// /app/frontend/lib/api/mail.ts
// Phase 3.23.2.P: Mail API Layer with Auth
// Phase 3.24: Canonical Receipt Integration + Telemetry
//
// Canonical API calls for mail system.
// Uses auth token from gameStore for server identity.
// Returns canonical receipts for all claim operations.
// Emits telemetry events with source + sourceId.

import { loadAuthToken } from '../authStorage';
import { 
  RewardReceipt, 
  assertValidReceipt,
  isValidReceipt,
} from '../types/receipt';
import { track, Events } from '../telemetry/events';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

/**
 * Get auth headers for API calls
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await loadAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Get mail summary (badge counts) - uses auth token
 */
export async function getMailSummary(username: string): Promise<{
  rewardsAvailable: number;
  unreadMessages: number;
  giftsAvailable: number;
}> {
  try {
    const headers = await getAuthHeaders();
    // Use legacy route for compatibility, but server uses auth token for identity
    const res = await fetch(`${API_BASE}/api/mail/summary/${username}`, { headers });
    if (res.status === 401) {
      // Token invalid - return defaults, let auth layer handle logout
      return { rewardsAvailable: 0, unreadMessages: 0, giftsAvailable: 0 };
    }
    if (!res.ok) throw new Error('Failed to fetch mail summary');
    return await res.json();
  } catch {
    return { rewardsAvailable: 0, unreadMessages: 0, giftsAvailable: 0 };
  }
}

/**
 * Get mail rewards list
 */
export async function getMailRewards(username: string): Promise<Array<{
  id: string;
  type: 'daily' | 'achievement' | 'event';
  title: string;
  subtitle: string;
  claimed: boolean;
  icon: string;
}>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/mail/rewards/${username}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch rewards');
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Get mail messages list
 */
export async function getMailMessages(username: string): Promise<Array<{
  id: string;
  sender: string;
  snippet: string;
  timestamp: string;
  read: boolean;
}>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/mail/messages/${username}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Get mail gifts list
 */
export async function getMailGifts(username: string): Promise<Array<{
  id: string;
  sender: string;
  item: string;
  quantity: number;
  claimed: boolean;
}>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/mail/gifts/${username}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch gifts');
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Claim a mail reward (idempotent)
 * Phase 3.24: Returns canonical receipt + emits telemetry
 */
export async function claimMailReward(username: string, rewardId: string): Promise<RewardReceipt> {
  // Emit submission event
  track(Events.MAIL_CLAIM_SUBMITTED, { 
    source: 'mail_reward_claim', 
    sourceId: rewardId 
  });
  
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/mail/rewards/${username}/${rewardId}/claim`, {
      method: 'POST',
      headers,
    });
    
    if (!res.ok) {
      track(Events.REWARD_CLAIM_ERROR, { 
        source: 'mail_reward_claim', 
        sourceId: rewardId,
        status: res.status,
      });
      throw new Error('Failed to claim reward');
    }
    
    const receipt = await res.json();
    
    // Phase 3.24: Validate receipt shape
    if (isValidReceipt(receipt)) {
      // Emit receipt received
      track(Events.REWARD_RECEIPT_RECEIVED, { 
        source: receipt.source, 
        sourceId: receipt.sourceId,
        itemCount: receipt.items.length,
      });
      
      // Emit success/already claimed
      if (receipt.alreadyClaimed) {
        track(Events.REWARD_CLAIM_ALREADY_CLAIMED, { 
          source: receipt.source, 
          sourceId: receipt.sourceId 
        });
      } else {
        track(Events.REWARD_CLAIM_SUCCESS, { 
          source: receipt.source, 
          sourceId: receipt.sourceId,
          itemCount: receipt.items.length,
        });
      }
      
      return receipt;
    }
    
    // Legacy fallback: convert old response to canonical receipt
    console.warn('[claimMailReward] Legacy response detected, converting to receipt');
    const legacyReceipt: RewardReceipt = {
      source: 'mail_reward_claim',
      sourceId: rewardId,
      items: [],
      balances: {
        gold: 0, coins: 0, gems: 0, divine_gems: 0, crystals: 0,
        stamina: 0, divine_essence: 0, soul_dust: 0, skill_essence: 0,
        enhancement_stones: 0, hero_shards: 0, rune_essence: 0,
      },
      alreadyClaimed: receipt.alreadyClaimed ?? false,
      message: receipt.message,
    };
    
    track(Events.REWARD_RECEIPT_RECEIVED, { 
      source: legacyReceipt.source, 
      sourceId: legacyReceipt.sourceId,
      legacy: true,
    });
    
    return legacyReceipt;
  } catch (error) {
    track(Events.REWARD_CLAIM_ERROR, { 
      source: 'mail_reward_claim', 
      sourceId: rewardId,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Claim a mail gift (idempotent)
 * Phase 3.24: Returns canonical receipt + emits telemetry
 */
export async function claimMailGift(username: string, giftId: string): Promise<RewardReceipt> {
  // Emit submission event
  track(Events.MAIL_CLAIM_SUBMITTED, { 
    source: 'mail_gift_claim', 
    sourceId: giftId 
  });
  
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/mail/gifts/${username}/${giftId}/claim`, {
      method: 'POST',
      headers,
    });
    
    if (!res.ok) {
      track(Events.REWARD_CLAIM_ERROR, { 
        source: 'mail_gift_claim', 
        sourceId: giftId,
        status: res.status,
      });
      throw new Error('Failed to claim gift');
    }
    
    const receipt = await res.json();
    
    // Phase 3.24: Validate receipt shape
    if (isValidReceipt(receipt)) {
      // Emit receipt received
      track(Events.REWARD_RECEIPT_RECEIVED, { 
        source: receipt.source, 
        sourceId: receipt.sourceId,
        itemCount: receipt.items.length,
      });
      
      // Emit success/already claimed
      if (receipt.alreadyClaimed) {
        track(Events.REWARD_CLAIM_ALREADY_CLAIMED, { 
          source: receipt.source, 
          sourceId: receipt.sourceId 
        });
      } else {
        track(Events.REWARD_CLAIM_SUCCESS, { 
          source: receipt.source, 
          sourceId: receipt.sourceId,
          itemCount: receipt.items.length,
        });
      }
      
      return receipt;
    }
    
    // Legacy fallback: convert old response to canonical receipt
    console.warn('[claimMailGift] Legacy response detected, converting to receipt');
    const legacyReceipt: RewardReceipt = {
      source: 'mail_gift_claim',
      sourceId: giftId,
      items: [],
      balances: {
        gold: 0, coins: 0, gems: 0, divine_gems: 0, crystals: 0,
        stamina: 0, divine_essence: 0, soul_dust: 0, skill_essence: 0,
        enhancement_stones: 0, hero_shards: 0, rune_essence: 0,
      },
      alreadyClaimed: receipt.alreadyClaimed ?? false,
      message: receipt.message,
    };
    
    track(Events.REWARD_RECEIPT_RECEIVED, { 
      source: legacyReceipt.source, 
      sourceId: legacyReceipt.sourceId,
      legacy: true,
    });
    
    return legacyReceipt;
  } catch (error) {
    track(Events.REWARD_CLAIM_ERROR, { 
      source: 'mail_gift_claim', 
      sourceId: giftId,
      error: String(error),
    });
    throw error;
  }
}
