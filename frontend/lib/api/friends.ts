// /app/frontend/lib/api/friends.ts
// Phase 3.23.2.P: Friends API Layer with Auth
//
// Canonical API calls for friends system.
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
 * Get friends summary (badge counts) - uses auth token
 */
export async function getFriendsSummary(username: string): Promise<{
  pendingRequests: number;
  totalFriends: number;
}> {
  try {
    const headers = await getAuthHeaders();
    // Use legacy route for compatibility, but server uses auth token for identity
    const res = await fetch(`${API_BASE}/api/friends/summary/${username}`, { headers });
    if (res.status === 401) {
      return { pendingRequests: 0, totalFriends: 0 };
    }
    if (!res.ok) throw new Error('Failed to fetch friends summary');
    return await res.json();
  } catch {
    return { pendingRequests: 0, totalFriends: 0 };
  }
}

/**
 * Get friends list
 */
export async function getFriendsList(username: string): Promise<Array<{
  id: string;
  username: string;
  lastOnline: string;
  status: 'online' | 'offline' | 'away';
  affinity?: number;
}>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/friends/list/${username}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch friends list');
    const data = await res.json();
    // Transform backend response to frontend format
    return data.map((f: any) => ({
      id: f.friend_id || f.id,
      username: f.friend_username || f.username,
      lastOnline: f.last_collected ? 'Earlier today' : 'Yesterday',
      status: 'offline' as const,
      affinity: f.can_collect ? 50 : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Get friend requests
 */
export async function getFriendRequests(username: string): Promise<Array<{
  id: string;
  fromUsername: string;
  timestamp: string;
}>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/friends/requests/${username}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch friend requests');
    const data = await res.json();
    // Transform to frontend format
    return data.map((r: any) => ({
      id: r.id,
      fromUsername: r.from_username,
      timestamp: 'Just now',
    }));
  } catch {
    return [];
  }
}

/**
 * Accept friend request (idempotent)
 */
export async function acceptFriendRequest(username: string, requestId: string): Promise<{ alreadyAccepted?: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/friends/requests/${username}/${requestId}/accept`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to accept request');
  return await res.json();
}

/**
 * Decline friend request (idempotent)
 */
export async function declineFriendRequest(username: string, requestId: string): Promise<{ alreadyDeclined?: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/friends/requests/${username}/${requestId}/decline`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to decline request');
  return await res.json();
}

/**
 * Search for players (auth required, min 3 chars)
 */
export async function searchPlayers(query: string, username?: string): Promise<Array<{
  id: string;
  username: string;
  level: number;
  isFriend: boolean;
  hasPendingRequest: boolean;
}>> {
  // Client-side validation - min 3 chars
  if (!query || query.length < 3) return [];
  
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ q: query });
    
    const res = await fetch(`${API_BASE}/api/friends/search?${params}`, { headers });
    if (!res.ok) throw new Error('Failed to search players');
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Send friend request (auth required)
 */
export async function sendFriendRequest(fromUsername: string, toUsername: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/friends/requests/send`, {
    method: 'POST',
    headers: { 
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: toUsername }),
  });
  if (!res.ok) throw new Error('Failed to send request');
}

// ==================== FRIEND GIFTS (Phase 3.28) ====================

import { track, Events } from '../telemetry/events';

export type GiftType = 'gold' | 'stamina' | 'gems';

export interface GiftStatus {
  sent_today: number;
  daily_limit: number;
  remaining: number;
  amount: number;
}

export interface SendGiftResult {
  success: boolean;
  message: string;
  gift_id: string;
  gift_type: GiftType;
  amount: number;
  recipient_username: string;
}

/**
 * Send a gift to a friend
 * Phase 3.28: Creates mail gift for recipient
 */
export async function sendFriendGift(
  friendId: string, 
  giftType: GiftType = 'gold'
): Promise<SendGiftResult> {
  // Emit telemetry for gift attempt
  track(Events.FRIEND_GIFT_SENT, {
    friendId,
    giftType,
  });
  
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    friend_id: friendId,
    gift_type: giftType,
  });
  
  const res = await fetch(`${API_BASE}/api/friends/gifts/send?${params}`, {
    method: 'POST',
    headers,
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to send gift' }));
    throw new Error(error.detail || 'Failed to send gift');
  }
  
  return await res.json();
}

/**
 * Get gift status for a specific friend
 * Returns remaining gifts that can be sent today by type
 */
export async function getFriendGiftStatus(friendId: string): Promise<Record<GiftType, GiftStatus>> {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ friend_id: friendId });
    
    const res = await fetch(`${API_BASE}/api/friends/gifts/status?${params}`, { headers });
    if (!res.ok) throw new Error('Failed to get gift status');
    return await res.json();
  } catch {
    // Return defaults on error
    return {
      gold: { sent_today: 0, daily_limit: 5, remaining: 5, amount: 100 },
      stamina: { sent_today: 0, daily_limit: 3, remaining: 3, amount: 10 },
      gems: { sent_today: 0, daily_limit: 1, remaining: 1, amount: 5 },
    };
  }
}

