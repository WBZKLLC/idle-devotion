// /app/frontend/lib/ui/badges.ts
// Phase 3.22.12.R2: Badge selectors
//
// Centralized badge state derived from user data.
// These should be called from components to get real-time badge values.
//
// "Quiet when empty. Truthful when there's something."

import { useGameStore } from '../../stores/gameStore';

/**
 * Get mail badge count
 * Currently shows 1 if daily login rewards are available
 */
export function useMailBadge(): number {
  const user = useGameStore((s) => s.user);
  if (!user) return 0;
  
  // Check if daily login reward is available
  // login_days increments after claiming, so if last_claimed is not today, badge = 1
  // For now, always show 1 as "daily rewards available" indicator
  return 1;
}

/**
 * Get friends badge count
 * Shows pending friend request count (placeholder: always 0)
 */
export function useFriendsBadge(): number {
  // TODO: Wire to actual friend request API when available
  return 0;
}

/**
 * Get events badge count
 * Shows if there are active events with unclaimed rewards
 */
export function useEventsBadge(): boolean {
  // TODO: Wire to actual events API
  // For now, return true to indicate "events available"
  return true;
}

/**
 * Get all rail badges at once (for performance)
 */
export function useRailBadges() {
  const mailBadge = useMailBadge();
  const friendsBadge = useFriendsBadge();
  const eventsBadge = useEventsBadge();
  
  return {
    mail: mailBadge > 0 ? mailBadge : undefined,
    friends: friendsBadge > 0 ? friendsBadge : undefined,
    events: eventsBadge || undefined,
  };
}
