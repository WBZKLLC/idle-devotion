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
  // App lifecycle
  APP_START: 'app_start',
  
  // Auth events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  FORCE_LOGOUT_401: 'force_logout_401',
  
  // Game events
  GACHA_PULL: 'gacha_pull',
  SCREEN_VIEW: 'screen_view',
  
  // Purchase events
  PURCHASE_ATTEMPT: 'purchase_attempt',
  PURCHASE_SUCCESS: 'purchase_success',
  PURCHASE_FAILURE: 'purchase_failure',
  
  // Phase 3.13: Premium navigation & gating telemetry
  // ONLY emit from: navigation.ts, gating.ts
  PAYWALL_OPENED: 'paywall_opened',
  STORE_OPENED: 'store_opened',
  PREMIUM_GATE_DENIED: 'premium_gate_denied',
  PREMIUM_GATE_ALLOWED: 'premium_gate_allowed',
  
  // Phase 3.24: Reward receipt telemetry
  // MUST include: source, sourceId in props
  REWARD_RECEIPT_RECEIVED: 'reward_receipt_received',
  REWARD_CLAIM_SUCCESS: 'reward_claim_success',
  REWARD_CLAIM_ALREADY_CLAIMED: 'reward_claim_already_claimed',
  REWARD_CLAIM_ERROR: 'reward_claim_error',
  MAIL_CLAIM_SUBMITTED: 'mail_claim_submitted',
  BOND_TRIBUTE_SUBMITTED: 'bond_tribute_submitted',
  
  // Phase 3.26: Affinity unlock + bond telemetry
  BOND_VIEWED: 'bond_viewed',
  BOND_TIER_LADDER_VIEWED: 'bond_tier_ladder_viewed',
  BOND_NEXT_UNLOCK_VIEWED: 'bond_next_unlock_viewed',
  BOND_TIER_ADVANCED: 'bond_tier_advanced',
  MAIL_RECEIPTS_VIEWED: 'mail_receipts_viewed',
  MAIL_RECEIPT_CLAIM_SUBMITTED: 'mail_receipt_claim_submitted',
  
  // Phase 3.27: Hero stage intimacy telemetry
  HERO_STAGE_VIEWED: 'hero_stage_viewed',
  HERO_STAGE_INSPECT_TOGGLED: 'hero_stage_inspect_toggled',
  HERO_STAGE_CAMERA_MODE_RESOLVED: 'hero_stage_camera_mode_resolved',
  
  // Error events
  OFFLINE_DETECTED: 'offline_detected',
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',
} as const;
