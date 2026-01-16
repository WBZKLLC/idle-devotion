// /app/frontend/lib/ui/badges.ts
// Phase 3.23.2: Badge selectors with real API data
//
// Centralized badge state derived from API calls.
// Graceful degradation — returns defaults on failure.
//
// "Quiet when empty. Truthful when there's something."

import { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getMailSummary } from '../api/mail';
import { getFriendsSummary } from '../api/friends';

type BadgeState = {
  mail: number | undefined;
  friends: number | undefined;
  events: boolean | undefined;
};

/**
 * Get all rail badges at once (with API calls)
 * Returns badge values for mail, friends, events
 * 
 * Badge logic:
 * - mail: rewardsAvailable + unreadMessages + giftsAvailable (cap at 9+)
 * - friends: pendingRequests
 * - events: true if active events (stubbed for now)
 */
export function useRailBadges(): BadgeState {
  const user = useGameStore((s) => s.user);
  const [badges, setBadges] = useState<BadgeState>({
    mail: 1, // Default: daily rewards available
    friends: undefined,
    events: true, // Default: events available
  });
  
  useEffect(() => {
    if (!user?.username) return;
    
    let cancelled = false;
    
    const fetchBadges = async () => {
      try {
        const [mailData, friendsData] = await Promise.all([
          getMailSummary(user.username).catch(() => ({ rewardsAvailable: 1, unreadMessages: 0, giftsAvailable: 0 })),
          getFriendsSummary(user.username).catch(() => ({ pendingRequests: 0, totalFriends: 0 })),
        ]);
        
        if (cancelled) return;
        
        const mailTotal = mailData.rewardsAvailable + mailData.unreadMessages + mailData.giftsAvailable;
        
        setBadges({
          mail: mailTotal > 0 ? mailTotal : undefined,
          friends: friendsData.pendingRequests > 0 ? friendsData.pendingRequests : undefined,
          events: true, // TODO: Wire to actual events API when available
        });
      } catch {
        // Keep defaults on error
      }
    };
    
    fetchBadges();
    
    // Refresh badges every 60 seconds
    const interval = setInterval(fetchBadges, 60000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.username]);
  
  return badges;
}

/**
 * Get mail badge count (standalone hook)
 */
export function useMailBadge(): number {
  const user = useGameStore((s) => s.user);
  const [badge, setBadge] = useState(1); // Default: daily rewards available
  
  useEffect(() => {
    if (!user?.username) return;
    
    getMailSummary(user.username)
      .then((data) => {
        const total = data.rewardsAvailable + data.unreadMessages + data.giftsAvailable;
        setBadge(total);
      })
      .catch(() => {
        // Keep default
      });
  }, [user?.username]);
  
  return badge;
}

/**
 * Get friends badge count (standalone hook)
 */
export function useFriendsBadge(): number {
  const user = useGameStore((s) => s.user);
  const [badge, setBadge] = useState(0);
  
  useEffect(() => {
    if (!user?.username) return;
    
    getFriendsSummary(user.username)
      .then((data) => {
        setBadge(data.pendingRequests);
      })
      .catch(() => {
        // Keep default
      });
  }, [user?.username]);
  
  return badge;
}

/**
 * Get events badge (standalone hook)
 * TODO: Wire to actual events API
 */
export function useEventsBadge(): boolean {
  // For now, return true to indicate "events available"
  return true;
}
