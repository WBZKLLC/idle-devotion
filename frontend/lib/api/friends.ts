// /app/frontend/lib/api/friends.ts
// Phase 3.23.2: Friends API Layer
//
// Canonical API calls for friends system.
// Graceful error handling — returns defaults on failure.

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

/**
 * Get friends summary (badge counts)
 */
export async function getFriendsSummary(username: string): Promise<{
  pendingRequests: number;
  totalFriends: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/friends/summary/${username}`);
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
    const res = await fetch(`${API_BASE}/api/friends/list/${username}`);
    if (!res.ok) throw new Error('Failed to fetch friends list');
    return await res.json();
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
    const res = await fetch(`${API_BASE}/api/friends/requests/${username}`);
    if (!res.ok) throw new Error('Failed to fetch friend requests');
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Accept friend request
 */
export async function acceptFriendRequest(username: string, requestId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/friends/requests/${username}/${requestId}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to accept request');
}

/**
 * Decline friend request
 */
export async function declineFriendRequest(username: string, requestId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/friends/requests/${username}/${requestId}/decline`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to decline request');
}

/**
 * Search for players
 */
export async function searchPlayers(query: string): Promise<Array<{
  id: string;
  username: string;
  level: number;
  isFriend: boolean;
  hasPendingRequest: boolean;
}>> {
  if (!query || query.length < 2) return [];
  
  try {
    const res = await fetch(`${API_BASE}/api/friends/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to search players');
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Send friend request
 */
export async function sendFriendRequest(fromUsername: string, toUsername: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/friends/requests/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromUsername, to: toUsername }),
  });
  if (!res.ok) throw new Error('Failed to send request');
}
