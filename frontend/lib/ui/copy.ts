// /app/frontend/lib/ui/copy.ts
// Phase 3.22.6: Sanctum Design Language — Microcopy Palette
// 
// Core Emotional Frame: "Return to the Sanctum"
// - You didn't arrive — you came back
// - You are expected, wanted
// - Time continued for you while you were gone
//
// Voice Rules:
// - Neutral (default): Clear, calm, no hype
// - Sacred (progress/rewards): One line, reverent, never guilt
// - Steel (combat/failure): Brief, steady, respectful

// =============================================================================
// HOME HEADER — Recognition, not Welcome
// =============================================================================

/** 
 * Greeting variants for HomeHeader
 * Only ONE line ever. Power is assumed — it does not announce itself.
 * 10-15% chance of variant, rest default
 */
export const GREETING_VARIANTS = [
  'Welcome back.',           // default (most common)
  "You've returned.",
  "They've been waiting.",
  'Your absence was noted.',
  'The Sanctum remembers.',
  'Time has been kind.',
] as const;

/**
 * Get a greeting — 85% default, 15% variant
 */
export function getGreeting(): string {
  const roll = Math.random();
  if (roll < 0.85) {
    return GREETING_VARIANTS[0]; // "Welcome back."
  }
  // Pick from variants (indices 1-5)
  const variantIndex = 1 + Math.floor(Math.random() * (GREETING_VARIANTS.length - 1));
  return GREETING_VARIANTS[variantIndex];
}

// =============================================================================
// IDLE REWARDS — The Offering (what was prepared while you were away)
// =============================================================================

export const IDLE_COPY = {
  /** Card title — reframed from "Idle Rewards" */
  title: 'Devotion Accrued',
  
  /** Subtitle variants — one line, calm */
  subtitles: [
    'Time has not been wasted.',
    'Your presence was anticipated.',
    'They kept working while you rested.',
    'What was gathered in your absence.',
  ] as const,
  
  /** Button labels — confident, not aggressive */
  collectButton: 'Receive',
  instantButton: 'Demand More',
  
  /** Timer label */
  timerLabel: 'Time Elapsed',
  
  /** Max time note */
  maxTimeNote: (hours: number) => `Cap: ${hours}h`,
} as const;

/**
 * Get idle subtitle — rotates subtly
 */
export function getIdleSubtitle(): string {
  const index = Math.floor(Math.random() * IDLE_COPY.subtitles.length);
  return IDLE_COPY.subtitles[index];
}

// =============================================================================
// TOAST PHRASES — Sacred/Steel Voice
// =============================================================================

export const TOAST_COPY = {
  // Success (Sacred voice)
  success: {
    default: 'Received.',
    claimed: 'Bound to your account.',
    collected: 'Added to your reliquary.',
    levelUp: 'Strength settles into you.',
    milestone: 'A new step on the path.',
  },
  
  // Error (Steel voice)
  error: {
    default: 'That didn't take. Try again.',
    connection: 'Connection faltered.',
    notReady: 'Not yet ready.',
    failed: 'It didn't hold.',
  },
  
  // Locked/Gated (Neutral, clear)
  locked: {
    vip: (level: number) => `Requires VIP ${level}+.`,
    level: (level: number) => `Unlocks at level ${level}.`,
    progress: 'This path opens later.',
    premium: 'A deeper commitment is required.',
  },
  
  // Purchase (respectful, ceremonial)
  purchase: {
    success: 'The vow is sealed.',
    restored: 'Your devotion was remembered.',
    oneTime: 'A permanent blessing.',
  },
} as const;

// =============================================================================
// QUICK LINKS — Familiar Faces, Not Buttons
// =============================================================================

export const QUICK_LINK_ZONES = {
  /** Core Companions — the ones you check on first */
  primary: ['teams', 'heroes', 'journey'] as const,
  
  /** Systems — responsibilities, not relationships */
  secondary: ['guild', 'gear', 'dungeons'] as const,
  
  /** Temptations — opportunity, not home */
  tertiary: ['events', 'pass', 'store'] as const,
} as const;

// =============================================================================
// FEATURED BANNERS — Brief urgency without pressure
// =============================================================================

export const BANNER_COPY = {
  limited: 'Fate does not wait.',
  ending: 'The window closes.',
  new: 'Something stirs.',
} as const;

// =============================================================================
// MISC UI COPY
// =============================================================================

export const UI_COPY = {
  /** Loading states */
  loading: {
    default: 'Preparing...',
    heroes: 'Gathering your companions...',
    guild: 'Reaching the guild hall...',
    store: 'Opening the sanctum vault...',
  },
  
  /** Empty states */
  empty: {
    noHeroes: 'No companions yet.',
    noGuild: 'You walk alone.',
    noEvents: 'A quiet moment.',
  },
  
  /** Confirmations */
  confirm: {
    proceed: 'Continue',
    cancel: 'Not now',
    claim: 'Accept',
  },
} as const;
