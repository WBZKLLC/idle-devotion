// /app/frontend/lib/ui/desire.ts
// Phase 3.22.8: Desire Accents System
//
// Core Rule: Desire must feel accidental.
// If the user notices it *trying*, it's dead.
//
// Everything here is:
// - Session-limited
// - Non-repeatable
// - Peripheral
// - Never stacks

import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// SESSION STATE (resets on app restart)
// =============================================================================

const sessionState = {
  eyeShiftTriggered: false,
  glanceTriggered: false,
  sessionStartTime: Date.now(),
  lastInteractionTime: Date.now(),
  scrollDetected: false,
  // Phase 3.22.8.B: Global desire budget — only ONE accent per session
  desireBudgetSpent: false,
};

// =============================================================================
// GLOBAL DESIRE BUDGET (keeps it premium)
// =============================================================================

/**
 * Check if desire budget is available
 * If user sees >1 accent per session, it feels like a trick.
 */
export function hasDesireBudget(): boolean {
  return !sessionState.desireBudgetSpent;
}

/**
 * Spend the desire budget (only one accent fires per session)
 */
export function spendDesireBudget(): void {
  sessionState.desireBudgetSpent = true;
}

/**
 * Atomically try to spend the desire budget
 * Returns true if budget was available and is now spent
 * Returns false if budget was already spent (safe for race conditions)
 */
export function trySpendDesireBudget(): boolean {
  if (sessionState.desireBudgetSpent) return false;
  sessionState.desireBudgetSpent = true;
  return true;
}

// =============================================================================
// EYE-LINE SHIFT (Peripheral Attention)
// =============================================================================

export const EYE_SHIFT = {
  /** Maximum horizontal offset (px) */
  maxOffsetX: 2,
  /** Maximum vertical offset (px) */
  maxOffsetY: 1,
  /** Animation duration (ms) */
  duration: 600,
  /** Easing function name */
  easing: 'easeOut',
} as const;

/**
 * Check if eye-line shift can trigger
 * Only triggers once per session, on first scroll, if budget available
 */
export function canTriggerEyeShift(): boolean {
  if (!hasDesireBudget()) return false; // Budget already spent
  if (sessionState.eyeShiftTriggered) return false;
  if (!sessionState.scrollDetected) return false;
  return true;
}

/**
 * Mark eye-line shift as triggered (never repeats this session)
 */
export function markEyeShiftTriggered(): void {
  sessionState.eyeShiftTriggered = true;
  spendDesireBudget(); // Consume the session's desire budget
}

/**
 * Mark that scroll has been detected
 */
export function markScrollDetected(): void {
  if (!sessionState.scrollDetected) {
    sessionState.scrollDetected = true;
  }
}

// =============================================================================
// RARE GLANCE (Session-Based)
// =============================================================================

export const GLANCE_RULES = {
  /** Minimum session time before glance can trigger (ms) */
  minSessionTime: 30_000,
  /** Maximum session time window for glance (ms) */
  maxSessionTime: 90_000,
  /** Idle time required before triggering (ms) */
  idleRequired: 3_000,
  /** Probability of triggering (0-1) */
  chance: 0.35,
  /** Head tilt angle (degrees) */
  headTilt: 1.5,
  /** Animation duration (ms) */
  duration: 900,
} as const;

/**
 * Check if rare glance can trigger
 * Respects desire budget — only one accent per session
 */
export function canTriggerGlance(): boolean {
  if (!hasDesireBudget()) return false; // Budget already spent
  if (sessionState.glanceTriggered) return false;
  
  const sessionTime = Date.now() - sessionState.sessionStartTime;
  if (sessionTime < GLANCE_RULES.minSessionTime) return false;
  if (sessionTime > GLANCE_RULES.maxSessionTime) return false;
  
  const idleTime = Date.now() - sessionState.lastInteractionTime;
  if (idleTime < GLANCE_RULES.idleRequired) return false;
  
  // Probabilistic trigger
  return Math.random() < GLANCE_RULES.chance;
}

/**
 * Mark glance as triggered (never repeats this session)
 */
export function markGlanceTriggered(): void {
  sessionState.glanceTriggered = true;
  spendDesireBudget(); // Consume the session's desire budget
}

/**
 * Update last interaction time (call on any user tap)
 */
export function markInteraction(): void {
  sessionState.lastInteractionTime = Date.now();
}

/**
 * Cancel glance if user interacts during animation
 */
export function shouldCancelGlance(): boolean {
  const idleTime = Date.now() - sessionState.lastInteractionTime;
  return idleTime < 100; // User just tapped
}

// =============================================================================
// "NOTICED" MOMENTS (Once Per Real-World Day)
// =============================================================================

const NOTICED_KEY = 'lastNoticedAt';

/** Phase 3.22.8.B: Possession tone — "You're expected. You're claimed." */
export const NOTICED_VARIANTS = {
  /** Daily micro-moments (pick 1/day) — quiet certainty, not pleading */
  copy: [
    "You're late.",
    'There you are.',
    'Good.',
    'Still ours.',
    'Come closer.',
    'We kept it warm.',
    "Everything's ready.",
  ] as const,
  /** Idle card subtitle shift (one render only) */
  idleSubtitle: 'Still warm.',
} as const;

/** Idle card subtitle variants (1 per session, low rotation) — possessive */
export const IDLE_SUBTITLE_VARIANTS = [
  'Kept for you.',
  'Untouched. Waiting.',
  'Time gathered. Yours.',
  'Still warm.',
] as const;

/**
 * Check if "noticed" moment can trigger today
 */
export async function canTriggerNoticed(): Promise<boolean> {
  try {
    const lastNoticed = await AsyncStorage.getItem(NOTICED_KEY);
    if (!lastNoticed) return true;
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return lastNoticed !== today;
  } catch {
    return false;
  }
}

/**
 * Mark "noticed" moment as triggered for today
 */
export async function markNoticedTriggered(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(NOTICED_KEY, today);
  } catch {
    // Silent fail — this is non-critical
  }
}

/**
 * Get a random "noticed" variant type
 * Returns: 'copy' | 'idle' | 'audio'
 */
export function getNoticedVariant(): 'copy' | 'idle' | 'audio' {
  const roll = Math.random();
  if (roll < 0.4) return 'copy';
  if (roll < 0.7) return 'idle';
  return 'audio';
}

/**
 * Get random noticed copy
 */
export function getNoticedCopy(): string {
  const index = Math.floor(Math.random() * NOTICED_VARIANTS.copy.length);
  return NOTICED_VARIANTS.copy[index];
}

// =============================================================================
// BREATHING SYNC
// =============================================================================

export const BREATHING_SYNC = {
  /** Base duration (ms) */
  baseDuration: 10_000,
  /** Jitter range (±ms) — prevents mechanical repetition */
  jitterRange: 500,
  /** Phase offset between elements (ms) */
  phaseOffset: 200,
} as const;

/**
 * Get breathing duration with session-unique jitter
 */
let sessionJitter: number | null = null;

export function getBreathingDuration(): number {
  if (sessionJitter === null) {
    // Calculate once per session
    sessionJitter = (Math.random() - 0.5) * 2 * BREATHING_SYNC.jitterRange;
  }
  return BREATHING_SYNC.baseDuration + sessionJitter;
}

/**
 * Get phase offset for a specific element
 */
export function getBreathingPhaseOffset(elementIndex: number): number {
  return elementIndex * BREATHING_SYNC.phaseOffset;
}

// =============================================================================
// ULTRA-RARE AUDIO CUE
// =============================================================================

export const SHIFT_AUDIO = {
  /** Volume (barely audible) */
  volume: 0.07,
  /** Maximum triggers per session */
  maxPerSession: 1,
  /** Minimum session time before can trigger (ms) */
  minSessionTime: 60_000,
  /** Probability */
  chance: 0.25,
} as const;

let shiftAudioTriggeredCount = 0;

/**
 * Check if ultra-rare audio cue can trigger
 */
export function canTriggerShiftAudio(): boolean {
  if (shiftAudioTriggeredCount >= SHIFT_AUDIO.maxPerSession) return false;
  
  const sessionTime = Date.now() - sessionState.sessionStartTime;
  if (sessionTime < SHIFT_AUDIO.minSessionTime) return false;
  
  return Math.random() < SHIFT_AUDIO.chance;
}

/**
 * Mark shift audio as triggered
 */
export function markShiftAudioTriggered(): void {
  shiftAudioTriggeredCount++;
}

// =============================================================================
// RESET (for testing only)
// =============================================================================

export function resetSessionState(): void {
  sessionState.eyeShiftTriggered = false;
  sessionState.glanceTriggered = false;
  sessionState.sessionStartTime = Date.now();
  sessionState.lastInteractionTime = Date.now();
  sessionState.scrollDetected = false;
  sessionState.desireBudgetSpent = false;
  sessionJitter = null;
  shiftAudioTriggeredCount = 0;
}
