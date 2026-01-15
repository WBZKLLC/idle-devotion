// /app/frontend/lib/telemetry/events.ts
// Analytics event tracking - disabled by default, never blocks UI

const ENABLED = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'true';

/**
 * Track an analytics event
 * Safe to call anywhere - never throws, never blocks
 */
export function track(event: string, props: Record<string, any> = {}) {
  if (!ENABLED) return;
  
  try {
    // In dev, log to console for debugging
    if (__DEV__) {
      console.log('[track]', event, props);
    }
    
    // TODO: Integrate with PostHog/Segment/Amplitude when ready
    // Example: posthog.capture(event, props);
    
  } catch {
    // Never throw from analytics - it should never break the app
  }
}

// Pre-defined event names for consistency
export const Events = {
  APP_START: 'app_start',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  FORCE_LOGOUT_401: 'force_logout_401',
  GACHA_PULL: 'gacha_pull',
  PURCHASE_ATTEMPT: 'purchase_attempt',
  PURCHASE_SUCCESS: 'purchase_success',
  PURCHASE_FAILURE: 'purchase_failure',
  SCREEN_VIEW: 'screen_view',
  OFFLINE_DETECTED: 'offline_detected',
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',
} as const;
