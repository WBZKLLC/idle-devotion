// /app/frontend/lib/api/mail.ts
// Phase 3.23.2: Mail API Layer
//
// Canonical API calls for mail system.
// Graceful error handling — returns defaults on failure.

import { getEnvironmentMode } from '../../components/environment/EnvironmentDetector';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

/**
 * Get mail summary (badge counts)
 */
export async function getMailSummary(username: string): Promise<{
  rewardsAvailable: number;
  unreadMessages: number;
  giftsAvailable: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/mail/summary/${username}`);
    if (!res.ok) throw new Error('Failed to fetch mail summary');
    return await res.json();
  } catch {
    // Default fallback - show daily rewards available
    return { rewardsAvailable: 1, unreadMessages: 0, giftsAvailable: 0 };
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
    const res = await fetch(`${API_BASE}/api/mail/rewards/${username}`);
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
    const res = await fetch(`${API_BASE}/api/mail/messages/${username}`);
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
    const res = await fetch(`${API_BASE}/api/mail/gifts/${username}`);
    if (!res.ok) throw new Error('Failed to fetch gifts');
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Claim a mail reward
 */
export async function claimMailReward(username: string, rewardId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mail/rewards/${username}/${rewardId}/claim`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to claim reward');
}

/**
 * Claim a mail gift
 */
export async function claimMailGift(username: string, giftId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mail/gifts/${username}/${giftId}/claim`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to claim gift');
}
