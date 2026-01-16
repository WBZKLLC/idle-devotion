// /app/frontend/lib/ui/badges.ts
// Phase 3.23.2.P: Badge selectors with real API data
//
// Centralized badge state derived from API calls.
// Graceful degradation — returns defaults on failure.
// Smart refresh: on Home focus, after claims, not constant polling.
//
// "Quiet when empty. Truthful when there's something."

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useGameStore } from '../../stores/gameStore';
import { getMailSummary } from '../api/mail';
import { getFriendsSummary } from '../api/friends';

type BadgeState = {
  mail: number | undefined;
  friends: number | undefined;
  events: boolean | undefined;
};

// Global badge refresh trigger - can be called from anywhere
let _globalRefreshTrigger: (() => void) | null = null;

/**
 * Trigger a global badge refresh (call after claims, actions, etc.)
 */
export function triggerBadgeRefresh(): void {
  _globalRefreshTrigger?.();
}

/**
 * Get all rail badges at once (with API calls)
 * Returns badge values for mail, friends, events
 * 
 * Badge logic:
 * - mail: rewardsAvailable + unreadMessages + giftsAvailable (cap at 9 in display)
 * - friends: pendingRequests
 * - events: false by default (no always-lit badge)
 * 
 * Refresh policy:
 * - On initial load
 * - On app foreground
 * - When triggerBadgeRefresh() is called
 * - No constant polling (battery friendly)
 */
export function useRailBadges(): BadgeState {
  const user = useGameStore((s) => s.user);
  const [badges, setBadges] = useState<BadgeState>({
    mail: undefined,
    friends: undefined,
    events: undefined, // Default to undefined (no badge), NOT true
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const isMounted = useRef(true);
  
  // Expose global refresh trigger
  useEffect(() => {
    _globalRefreshTrigger = () => setRefreshKey((k) => k + 1);
    return () => {
      _globalRefreshTrigger = null;
    };
  }, []);
  
  // Fetch badges
  const fetchBadges = useCallback(async () => {
    if (!user?.username) return;
    
    try {
      const [mailData, friendsData] = await Promise.all([
        getMailSummary(user.username).catch(() => ({ rewardsAvailable: 0, unreadMessages: 0, giftsAvailable: 0 })),
        getFriendsSummary(user.username).catch(() => ({ pendingRequests: 0, totalFriends: 0 })),
      ]);
      
      if (!isMounted.current) return;
      
      const mailTotal = mailData.rewardsAvailable + mailData.unreadMessages + mailData.giftsAvailable;
      
      setBadges({
        mail: mailTotal > 0 ? mailTotal : undefined,
        friends: friendsData.pendingRequests > 0 ? friendsData.pendingRequests : undefined,
        events: undefined, // No events badge until we have real events API
      });
    } catch {
      // Keep current state on error
    }
  }, [user?.username]);
  
  // Initial fetch and refresh on key change
  useEffect(() => {
    isMounted.current = true;
    fetchBadges();
    return () => {
      isMounted.current = false;
    };
  }, [fetchBadges, refreshKey]);
  
  // Refresh on app foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        fetchBadges();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [fetchBadges]);
  
  return badges;
}

/**
 * Get mail badge count (standalone hook)
 */
export function useMailBadge(): number {
  const user = useGameStore((s) => s.user);
  const [badge, setBadge] = useState(0);
  
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
 * Returns false by default - no persistent badge nag
 */
export function useEventsBadge(): boolean {
  // TODO: Wire to actual events API when available
  // For now, return false to avoid "always lit" badge that breaks sanctuary vibe
  return false;
}
