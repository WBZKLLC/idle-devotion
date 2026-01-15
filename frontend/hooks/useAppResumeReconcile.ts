// /app/frontend/hooks/useAppResumeReconcile.ts
// Phase 3.14: App resume reconciliation hook
//
// CANONICAL ENTRY POINT for app resume freshness checks.
// This hook MUST be the ONLY place that listens to AppState for entitlements.
//
// STRICT RULES:
// - Do nothing if no user
// - Do nothing if already refreshing  
// - Do nothing if not stale (ensureFreshEntitlements handles this)
// - Never show alerts/toasts
// - Never block render
// - Fire and forget ONLY

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useEntitlementStore } from '../stores/entitlementStore';
import { useGameStore } from '../stores/gameStore';

// Debug logging
const dlog = (...args: any[]) => { if (__DEV__) console.log('[useAppResumeReconcile]', ...args); };

/**
 * Hook that reconciles entitlements when app returns to foreground.
 * 
 * MUST be called from _layout.tsx SessionProvider ONLY.
 * Guards enforce this is the only place using AppState for entitlements.
 * 
 * Uses ensureFreshEntitlements('app_resume') which:
 * - No-ops if no user
 * - No-ops if already refreshing
 * - No-ops if not stale (server-time TTL)
 * - Silent background refresh otherwise
 */
export function useAppResumeReconcile(): void {
  const user = useGameStore(s => s.user);
  const ensureFreshEntitlements = useEntitlementStore(s => s.ensureFreshEntitlements);
  
  // Track previous app state to detect background -> active transition
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Don't set up listener if no user logged in
    // (listener will be set up when user logs in via component re-render)
    if (!user) {
      dlog('No user, skipping AppState listener setup');
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      
      // Only trigger on background/inactive -> active transition
      if (
        previousState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        dlog('App resumed from background, triggering entitlements freshness check');
        
        // Fire and forget - ensureFreshEntitlements handles all guards internally:
        // - No-ops if already refreshing
        // - No-ops if not stale (server-time TTL)
        // - Silent refresh otherwise
        ensureFreshEntitlements('app_resume').catch(() => {
          // Silently ignore errors - never block or alert
        });
      }
    };

    dlog('Setting up AppState listener for user:', user.username);
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      dlog('Cleaning up AppState listener');
      subscription.remove();
    };
  }, [user, ensureFreshEntitlements]);
}
