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
  
  // Phase 3.28: Friend gift telemetry
  FRIEND_GIFT_SENT: 'friend_gift_sent',
  FRIEND_GIFT_CLAIM_SUBMITTED: 'friend_gift_claim_submitted',
  
  // Phase 3.29: Events/Quests telemetry
  EVENTS_VIEWED: 'events_viewed',
  EVENT_CLAIM_SUBMITTED: 'event_claim_submitted',
  EVENT_CLAIM_SUCCESS: 'event_claim_success',
  EVENT_CLAIM_ALREADY_CLAIMED: 'event_claim_already_claimed',
  EVENT_CLAIM_ERROR: 'event_claim_error',
  
  // Phase 3.30: Store telemetry
  STORE_VIEWED: 'store_viewed',
  STORE_ITEM_SELECTED: 'store_item_selected',
  STORE_PURCHASE_INTENT_CREATED: 'store_purchase_intent_created',
  STORE_REDEEM_SUBMITTED: 'store_redeem_submitted',
  STORE_REDEEM_SUCCESS: 'store_redeem_success',
  STORE_REDEEM_ALREADY_CLAIMED: 'store_redeem_already_claimed',
  STORE_REDEEM_ERROR: 'store_redeem_error',
  
  // Phase 3.31: Idle loop telemetry
  IDLE_VIEWED: 'idle_viewed',
  IDLE_ELAPSED: 'idle_elapsed',
  IDLE_CLAIM_SUBMITTED: 'idle_claim_submitted',
  IDLE_CLAIM_SUCCESS: 'idle_claim_success',
  IDLE_CLAIM_ALREADY_CLAIMED: 'idle_claim_already_claimed',
  
  // Phase 3.32: Daily login telemetry
  DAILY_VIEWED: 'daily_viewed',
  DAILY_CLAIM_SUBMITTED: 'daily_claim_submitted',
  DAILY_CLAIM_SUCCESS: 'daily_claim_success',
  DAILY_CLAIM_ALREADY_CLAIMED: 'daily_claim_already_claimed',
  DAILY_CLAIM_ERROR: 'daily_claim_error',
  
  // Phase 3.33: Gacha/Summon telemetry
  GACHA_VIEWED: 'gacha_viewed',
  GACHA_BANNER_SELECTED: 'gacha_banner_selected',
  GACHA_SUMMON_SUBMITTED: 'gacha_summon_submitted',
  GACHA_SUMMON_SUCCESS: 'gacha_summon_success',
  GACHA_SUMMON_ERROR: 'gacha_summon_error',
  GACHA_PITY_INCREMENTED: 'gacha_pity_incremented',
  GACHA_PITY_TRIGGERED: 'gacha_pity_triggered',
  
  // Phase 3.34: Summon Results UX telemetry
  GACHA_RESULTS_VIEWED: 'gacha_results_viewed',
  GACHA_NEW_HERO_ACQUIRED: 'gacha_new_hero_acquired',
  GACHA_DUPLICATE_CONVERTED: 'gacha_duplicate_converted',
  
  // Phase 3.35: Banner Integrity telemetry
  GACHA_INSUFFICIENT_FUNDS: 'gacha_insufficient_funds',
  GACHA_RATES_VIEWED: 'gacha_rates_viewed',
  GACHA_HISTORY_VIEWED: 'gacha_history_viewed',
  
  // Phase 3.39-3.41: Hero Progression telemetry
  HERO_PROMOTION_VIEWED: 'hero_promotion_viewed',
  HERO_PROMOTION_SUBMITTED: 'hero_promotion_submitted',
  HERO_PROMOTION_SUCCESS: 'hero_promotion_success',
  HERO_PROMOTION_INSUFFICIENT_SHARDS: 'hero_promotion_insufficient_shards',
  HERO_PROMOTION_FAILED: 'hero_promotion_failed',
  HERO_STATS_VIEWED: 'hero_stats_viewed',
  
  // Phase 3.45: Profile telemetry
  PROFILE_VIEWED: 'profile_viewed',
  
  // Phase 3.47: VIP System telemetry
  VIP_VIEWED: 'vip_viewed',
  VIP_TIER_SELECTED: 'vip_tier_selected',
  VIP_BENEFITS_SHEET_OPENED: 'vip_benefits_sheet_opened',
  VIP_PROGRESS_VIEWED: 'vip_progress_viewed',
  
  // Phase 3.50: Battle Presentation telemetry
  PVE_BATTLE_PRESENTATION_VIEWED: 'pve_battle_presentation_viewed',
  PVE_BATTLE_PRESENTATION_SKIPPED: 'pve_battle_presentation_skipped',
  PVE_BATTLE_PRESENTATION_COMPLETED: 'pve_battle_presentation_completed',
  PVE_BATTLE_RESULT_SHOWN: 'pve_battle_result_shown',
  PVE_VICTORY_VIEWED: 'pve_victory_viewed',
  PVE_DEFEAT_VIEWED: 'pve_defeat_viewed',
  PVE_DEFEAT_RECOMMENDATION_CLICKED: 'pve_defeat_recommendation_clicked',
  
  // Phase 3.54: Skill Cut-In telemetry
  PVE_SKILL_CUTIN_SHOWN: 'pve_skill_cutin_shown',
  
  // Phase 3.55: Combat Readability telemetry
  PVE_BATTLE_KEY_MOMENT_SHOWN: 'pve_battle_key_moment_shown',
  
  // Phase 3.56: Difficulty telemetry
  PVE_STAGE_VIEWED: 'pve_stage_viewed',
  
  // Phase 3.57-3.58: PvP telemetry
  PVP_VIEWED: 'pvp_viewed',
  PVP_RULES_OPENED: 'pvp_rules_opened',
  PVP_OPPONENT_LIST_VIEWED: 'pvp_opponent_list_viewed',
  PVP_MATCH_PREVIEW: 'pvp_match_preview',
  
  // Phase 4.0: Battle Feel telemetry
  SFX_BATTLE_START_PLAYED: 'sfx_battle_start_played',
  SFX_VICTORY_PLAYED: 'sfx_victory_played',
  SFX_DEFEAT_PLAYED: 'sfx_defeat_played',
  PVE_CUTIN_ASSET_SHOWN: 'pve_cutin_asset_shown',
  
  // Phase 4.1: IAP/RevenueCat telemetry
  IAP_PURCHASE_STARTED: 'iap_purchase_started',
  IAP_PURCHASE_SUCCESS: 'iap_purchase_success',
  IAP_PURCHASE_ERROR: 'iap_purchase_error',
  IAP_VERIFY_SUBMITTED: 'iap_verify_submitted',
  IAP_VERIFY_SUCCESS: 'iap_verify_success',
  IAP_VERIFY_ERROR: 'iap_verify_error',
  ENTITLEMENTS_UPDATED: 'entitlements_updated',
  
  // Phase 4.2: PvP Depth telemetry
  PVP_SEASON_VIEWED: 'pvp_season_viewed',
  PVP_REWARDS_PREVIEW_VIEWED: 'pvp_rewards_preview_viewed',
  PVP_DAILY_CLAIM_SUBMITTED: 'pvp_daily_claim_submitted',
  PVP_DAILY_CLAIM_SUCCESS: 'pvp_daily_claim_success',
  PVP_DAILY_CLAIM_ALREADY_CLAIMED: 'pvp_daily_claim_already_claimed',
  PVP_DAILY_CLAIM_ERROR: 'pvp_daily_claim_error',
  PVP_SEASON_CLAIM_SUBMITTED: 'pvp_season_claim_submitted',
  PVP_SEASON_CLAIM_SUCCESS: 'pvp_season_claim_success',
  PVP_SEASON_CLAIM_ALREADY_CLAIMED: 'pvp_season_claim_already_claimed',
  PVP_SEASON_CLAIM_ERROR: 'pvp_season_claim_error',
  
  // Phase 4.3: Live Ops telemetry
  LIVEOPS_STATUS_VIEWED: 'liveops_status_viewed',
  LIVEOPS_BANNER_SHOWN: 'liveops_banner_shown',
  LIVEOPS_CTA_CLICKED: 'liveops_cta_clicked',
  
  // Phase E2: RN Equivalency telemetry
  PVE_KEY_MOMENT_BEAT_SHOWN: 'pve_key_moment_beat_shown',
  PVE_DAMAGE_NUMBER_BATCH_SHOWN: 'pve_damage_number_batch_shown',
  PVE_VICTORY_CEREMONY_VIEWED: 'pve_victory_ceremony_viewed',
  PVE_REWARD_RECORD_VIEWED: 'pve_reward_record_viewed',
  
  // Phase E3: Hero Stage Live Motion telemetry
  HERO_STAGE_VIEWED: 'hero_stage_viewed',
  HERO_STAGE_MOTION_ENABLED: 'hero_stage_motion_enabled',
  HERO_STAGE_MOTION_DISABLED: 'hero_stage_motion_disabled',
  
  // Phase E4: PvP Tournament telemetry
  PVP_TOURNAMENT_VIEWED: 'pvp_tournament_viewed',
  PVP_TOURNAMENT_MATCH_SELECTED: 'pvp_tournament_match_selected',
  PVP_RULES_SHEET_OPENED: 'pvp_rules_sheet_opened',
  
  // Phase 3.50: UI bug tracking (DEV-only)
  UI_TIMER_INVALID_SUPPRESSED: 'ui_timer_invalid_suppressed',
  
  // Error events
  OFFLINE_DETECTED: 'offline_detected',
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',
} as const;
