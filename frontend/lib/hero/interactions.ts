// /app/frontend/lib/hero/interactions.ts
// Phase 3.23.9: Hero Interaction Hooks (Foundation)
//
// Wire hooks now, implement behaviors later.
// These hooks are placeholders that will be connected to:
// - Idle motion tiers
// - Affinity unlocks
// - Private view modes
//
// "Prevent future rewrites by defining the interface now."

import { useCallback, useRef, useEffect } from 'react';

// Types for interaction events
export type HeroInteractionType = 'tap' | 'longPress' | 'idleTick' | 'swipe';

export type HeroInteractionEvent = {
  type: HeroInteractionType;
  heroId: string;
  timestamp: number;
  position?: { x: number; y: number };
};

// Callback types for consumers
export type OnHeroTap = (event: HeroInteractionEvent) => void;
export type OnHeroLongPress = (event: HeroInteractionEvent) => void;
export type OnHeroIdleTick = (event: HeroInteractionEvent) => void;

/**
 * Hook for hero tap interaction
 * Currently a no-op - will be connected to reaction system later
 */
export function useHeroTap(heroId: string, onTap?: OnHeroTap) {
  return useCallback(
    (position?: { x: number; y: number }) => {
      const event: HeroInteractionEvent = {
        type: 'tap',
        heroId,
        timestamp: Date.now(),
        position,
      };
      
      // No-op for now - just log in dev
      if (__DEV__) {
        console.log('[HeroInteraction] tap', heroId);
      }
      
      onTap?.(event);
    },
    [heroId, onTap]
  );
}

/**
 * Hook for hero long press interaction
 * Currently a no-op - will be connected to intimate mode later
 */
export function useHeroLongPress(heroId: string, onLongPress?: OnHeroLongPress) {
  return useCallback(
    (position?: { x: number; y: number }) => {
      const event: HeroInteractionEvent = {
        type: 'longPress',
        heroId,
        timestamp: Date.now(),
        position,
      };
      
      // No-op for now - just log in dev
      if (__DEV__) {
        console.log('[HeroInteraction] longPress', heroId);
      }
      
      onLongPress?.(event);
    },
    [heroId, onLongPress]
  );
}

/**
 * Hook for hero idle tick (called periodically when viewing hero)
 * Currently a no-op - will be connected to idle motion tiers later
 */
export function useHeroIdleTick(
  heroId: string,
  intervalMs: number = 5000,
  onIdleTick?: OnHeroIdleTick
) {
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    if (!heroId) return;
    
    const tick = () => {
      const event: HeroInteractionEvent = {
        type: 'idleTick',
        heroId,
        timestamp: Date.now(),
      };
      
      // No-op for now - just log in dev (sparingly)
      if (__DEV__ && Math.random() < 0.1) {
        console.log('[HeroInteraction] idleTick', heroId);
      }
      
      onIdleTick?.(event);
    };
    
    tickRef.current = setInterval(tick, intervalMs);
    
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [heroId, intervalMs, onIdleTick]);
}

/**
 * Combined hook for all hero interactions
 * Use this for the main hero presentation screen
 */
export function useHeroInteractions(heroId: string) {
  const handleTap = useHeroTap(heroId);
  const handleLongPress = useHeroLongPress(heroId);
  
  // Idle tick runs automatically
  useHeroIdleTick(heroId);
  
  return {
    onTap: handleTap,
    onLongPress: handleLongPress,
  };
}
