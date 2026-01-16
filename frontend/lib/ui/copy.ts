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
 * Confident + possessive. Short sentences. Declarative.
 * Warm authority — no "cute", no pleading, no comedy.
 * 85% default, 15% variant
 */
export const GREETING_VARIANTS = [
  "You're back.",              // default (most common)
  'Good. You returned.',
  "They've been waiting.",
  'Come closer.',
  'The Sanctum is yours.',
  'We kept it ready.',
] as const;

/**
 * Get a greeting — 90% default, 10% variant
 * Phase 3.22.9: Premium products repeat confidently — rotate LESS
 * Never enthusiastic. Never exclamatory. No urgency.
 */
export function getGreeting(): string {
  const roll = Math.random();
  if (roll < 0.90) {
    return GREETING_VARIANTS[0]; // "You're back." — confident repetition
  }
  // Pick from variants (indices 1-5)
  const variantIndex = 1 + Math.floor(Math.random() * (GREETING_VARIANTS.length - 1));
  return GREETING_VARIANTS[variantIndex];
}

// =============================================================================
// IDLE REWARDS — The Offering (what was prepared while you were away)
// =============================================================================

export const IDLE_COPY = {
  /** Card title — confident, possessive */
  title: 'Awaiting You',
  
  /** Subtitle variants — Phase 3.22.8.B Possession tone */
  subtitles: [
    'Kept for you.',
    'Untouched. Waiting.',
    'Time gathered. Yours.',
    'Still warm.',
  ] as const,
  
  /** Button labels — dominant, non-cringe */
  collectButton: 'Receive',
  instantButton: 'Take More',
  
  /** Timer label */
  timerLabel: 'Time Accrued',
  
  /** Pending label */
  pendingLabel: 'For you',
  
  /** Max time note */
  maxTimeNote: (hours: number) => `${hours}h cap`,
  
  /** VIP lock copy */
  vipLock: 'VIP 1+ opens this.',
  
  /** Cooldown copy */
  cooldown: 'Not yet.',
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
  // Success (warm authority, never sharp)
  success: {
    default: 'Accepted.',
    claimed: 'Bound to you.',
    collected: "It's yours.",
    levelUp: 'Strength settles into you.',
    milestone: 'A new step on the path.',
  },
  
  // Error (brief, never sharp)
  error: {
    default: 'Not now.',
    connection: 'Connection faltered.',
    notReady: 'Again.',
    failed: 'Not yet.',
  },
  
  // Locked/Gated (controlled)
  locked: {
    vip: (level: number) => `VIP ${level}+ opens this.`,
    level: (level: number) => `Unlocks at level ${level}.`,
    progress: 'This path opens later.',
    premium: 'A deeper commitment opens this.',
  },
  
  // Purchase (possessive warmth)
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
