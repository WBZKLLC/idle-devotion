// /app/frontend/lib/api/mail.ts
// Phase 3.23.2.P: Mail API Layer with Auth
//
// Canonical API calls for mail system.
// Uses auth token from gameStore for server identity.
// Graceful error handling — returns defaults on failure.

import { loadAuthToken } from '../authStorage';

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
 */
export async function claimMailReward(username: string, rewardId: string): Promise<{ alreadyClaimed?: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/mail/rewards/${username}/${rewardId}/claim`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to claim reward');
  return await res.json();
}

/**
 * Claim a mail gift (idempotent)
 */
export async function claimMailGift(username: string, giftId: string): Promise<{ alreadyClaimed?: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/mail/gifts/${username}/${giftId}/claim`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to claim gift');
  return await res.json();
}
