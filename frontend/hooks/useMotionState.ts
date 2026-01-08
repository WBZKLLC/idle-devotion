// =============================================================================
// useMotionState Hook
// CONSTRAINT: State dispatch ONLY - NO animation logic in this hook
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  MotionStateType,
  UnityToExpoMessage,
  HeroMetadata,
  DispatcherStatus,
} from '../types/motionTypes';
import { MotionState } from '../constants/motionStates';
import { motionStateDispatcher } from '../services/motionStateDispatcher';

/**
 * Hook return type
 */
interface UseMotionStateReturn {
  // Current status
  status: DispatcherStatus;
  
  // State dispatch methods (ONLY state commands)
  setState: (state: MotionStateType, metadata?: HeroMetadata) => boolean;
  setIntensity: (value: number) => boolean;
  setSpeed: (value: number) => boolean;
  stopMotion: () => boolean;
  resetToIdle: () => boolean;
  
  // Convenience methods
  enterIdle: (metadata?: HeroMetadata) => boolean;
  enterCombat: (metadata?: HeroMetadata) => boolean;
  enterBanner: (metadata?: HeroMetadata) => boolean;
  enterSummon: (metadata?: HeroMetadata) => boolean;
  enterVictory: (metadata?: HeroMetadata) => boolean;
  enterDefeat: (metadata?: HeroMetadata) => boolean;
}

/**
 * React hook for motion state dispatch
 * 
 * RESPONSIBILITIES:
 * - Expose state dispatch methods to React components
 * - Track dispatcher status
 * - Subscribe to Unity status updates
 * 
 * PROHIBITED:
 * - Animation logic
 * - Interpolation
 * - Easing
 * - Profile parsing
 * - Parameter manipulation
 * 
 * @example
 * ```tsx
 * function HeroScreen({ heroId }) {
 *   const { setState, enterCombat, status } = useMotionState();
 *   
 *   const handleBattle = () => {
 *     enterCombat({ heroId });
 *   };
 *   
 *   return (
 *     <Button onPress={handleBattle}>Enter Battle</Button>
 *   );
 * }
 * ```
 */
export function useMotionState(): UseMotionStateReturn {
  const [status, setStatus] = useState<DispatcherStatus>(
    motionStateDispatcher.getStatus()
  );

  // Subscribe to Unity messages
  useEffect(() => {
    const unsubscribe = motionStateDispatcher.subscribe(
      (message: UnityToExpoMessage) => {
        // Update status when Unity sends updates
        setStatus(motionStateDispatcher.getStatus());
      }
    );

    return unsubscribe;
  }, []);

  // Wrap dispatch methods to update status after dispatch
  const wrapDispatch = useCallback(
    <T extends (...args: any[]) => boolean>(fn: T): T => {
      return ((...args: Parameters<T>) => {
        const result = fn(...args);
        setStatus(motionStateDispatcher.getStatus());
        return result;
      }) as T;
    },
    []
  );

  return {
    status,
    
    // Core dispatch methods
    setState: wrapDispatch(motionStateDispatcher.setState.bind(motionStateDispatcher)),
    setIntensity: wrapDispatch(motionStateDispatcher.setIntensity.bind(motionStateDispatcher)),
    setSpeed: wrapDispatch(motionStateDispatcher.setSpeed.bind(motionStateDispatcher)),
    stopMotion: wrapDispatch(motionStateDispatcher.stopMotion.bind(motionStateDispatcher)),
    resetToIdle: wrapDispatch(motionStateDispatcher.resetToIdle.bind(motionStateDispatcher)),
    
    // Convenience methods
    enterIdle: wrapDispatch(motionStateDispatcher.enterIdle.bind(motionStateDispatcher)),
    enterCombat: wrapDispatch(motionStateDispatcher.enterCombat.bind(motionStateDispatcher)),
    enterBanner: wrapDispatch(motionStateDispatcher.enterBanner.bind(motionStateDispatcher)),
    enterSummon: wrapDispatch(motionStateDispatcher.enterSummon.bind(motionStateDispatcher)),
    enterVictory: wrapDispatch(motionStateDispatcher.enterVictory.bind(motionStateDispatcher)),
    enterDefeat: wrapDispatch(motionStateDispatcher.enterDefeat.bind(motionStateDispatcher)),
  };
}

/**
 * Hook for subscribing to specific motion events
 * 
 * @example
 * ```tsx
 * function BannerReveal() {
 *   useMotionEvent('BLEND_COMPLETE', () => {
 *     // Show UI after animation completes
 *     setShowDetails(true);
 *   });
 * }
 * ```
 */
export function useMotionEvent(
  eventType: UnityToExpoMessage['type'],
  callback: (message: UnityToExpoMessage) => void
): void {
  useEffect(() => {
    const unsubscribe = motionStateDispatcher.subscribe((message) => {
      if (message.type === eventType) {
        callback(message);
      }
    });

    return unsubscribe;
  }, [eventType, callback]);
}

/**
 * Hook to get current motion state (read-only)
 */
export function useCurrentMotionState(): MotionStateType | null {
  const [currentState, setCurrentState] = useState<MotionStateType | null>(
    motionStateDispatcher.getStatus().currentState
  );

  useEffect(() => {
    const unsubscribe = motionStateDispatcher.subscribe((message) => {
      if (message.type === 'STATE_CHANGED') {
        setCurrentState(message.state);
      }
    });

    return unsubscribe;
  }, []);

  return currentState;
}
