/**
 * Phase 4.3: Live Ops API Wrapper
 * 
 * Server-driven live ops status.
 * No timers - refresh on focus only.
 */

import { api } from '../api';
import { track, Events } from '../telemetry/events';

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface LiveOpsEvent {
  event_id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  time_remaining_seconds: number;
  is_default: boolean;
}

export interface LiveOpsBoost {
  type: string;
  multiplier: number;
}

export interface LiveOpsStatusResponse {
  server_time: string;
  events: LiveOpsEvent[];
  boosts: LiveOpsBoost[];
  available_banners: string[];
  has_special_event: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// API Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get current live ops status.
 * 
 * Returns active events, boosts, and available banners.
 * Call on screen focus - no polling.
 */
export async function getLiveOpsStatus(): Promise<LiveOpsStatusResponse> {
  const res = await api.get('/liveops/status');
  track(Events.LIVEOPS_VIEWED, { has_special_event: res.data.has_special_event });
  return res.data;
}
