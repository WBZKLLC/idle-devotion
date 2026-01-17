// /app/frontend/lib/hero/content-boundaries.ts
// Phase 3.23.9: Content Boundaries (Safety Rules)
//
// Before any intimacy enters the picture, we define hard rules.
// These protect: store approval, brand tone, future monetization.
//
// "Default state is always safe / neutral."

/**
 * Content Safety Levels
 * Each screen/context has a maximum allowed level
 */
export enum ContentLevel {
  /** Safe for all contexts - no suggestive content */
  SAFE = 0,
  
  /** Mild - slight charm, no explicit content */
  MILD = 1,
  
  /** CONTEXTUAL - requires explicit opt-in and affinity */
  CONTEXTUAL = 2,
  
  /** INTIMATE - highest level, requires max affinity + consent */
  INTIMATE = 3,
}

/**
 * Screen content boundaries (hard limits)
 * These CANNOT be exceeded regardless of affinity
 */
export const SCREEN_BOUNDARIES = {
  /** Home screen: NEVER sexual, always sanctuary */
  home: ContentLevel.SAFE,
  
  /** Heroes list/gallery: Safe presentation only */
  heroGallery: ContentLevel.SAFE,
  
  /** Hero detail/stats: Safe, informational */
  heroDetail: ContentLevel.SAFE,
  
  /** Hero presentation screen: Contextual, opt-in */
  heroPresentation: ContentLevel.CONTEXTUAL,
  
  /** Summon/gacha: Safe, exciting but not sexual */
  summon: ContentLevel.SAFE,
  
  /** Mail/Social: Always safe */
  mail: ContentLevel.SAFE,
  friends: ContentLevel.SAFE,
  
  /** Shop: Safe, transactional */
  shop: ContentLevel.SAFE,
} as const;

/**
 * Affinity thresholds for content escalation
 * Higher affinity = more intimate content allowed (within screen limits)
 */
export const AFFINITY_THRESHOLDS = {
  /** Level 0-1: Safe content only */
  safe: 0,
  
  /** Level 2: Mild charm unlocked */
  mild: 2,
  
  /** Level 3: Contextual content unlocked */
  contextual: 3,
  
  /** Level 5: Intimate content unlocked (on appropriate screens) */
  intimate: 5,
} as const;

/**
 * Check if content level is allowed for a given screen
 */
export function isContentAllowed(
  screen: keyof typeof SCREEN_BOUNDARIES,
  level: ContentLevel
): boolean {
  return level <= SCREEN_BOUNDARIES[screen];
}

/**
 * Get maximum content level allowed for affinity
 */
export function getMaxContentForAffinity(affinityLevel: number): ContentLevel {
  if (affinityLevel >= AFFINITY_THRESHOLDS.intimate) return ContentLevel.INTIMATE;
  if (affinityLevel >= AFFINITY_THRESHOLDS.contextual) return ContentLevel.CONTEXTUAL;
  if (affinityLevel >= AFFINITY_THRESHOLDS.mild) return ContentLevel.MILD;
  return ContentLevel.SAFE;
}

/**
 * Get effective content level (respects both screen and affinity limits)
 */
export function getEffectiveContentLevel(
  screen: keyof typeof SCREEN_BOUNDARIES,
  affinityLevel: number
): ContentLevel {
  const screenMax = SCREEN_BOUNDARIES[screen];
  const affinityMax = getMaxContentForAffinity(affinityLevel);
  return Math.min(screenMax, affinityMax) as ContentLevel;
}

/**
 * Content boundary rules documentation
 * This is a reference for developers, not runtime code
 */
export const CONTENT_RULES = {
  general: [
    'Default state is always safe / neutral',
    'Intimacy requires explicit opt-in',
    'Affinity gates all escalation',
    'Screen boundaries are hard limits',
  ],
  
  homeScreen: [
    'NEVER sexual content',
    'Always sanctuary tone',
    'Heroes shown in neutral poses only',
    'No suggestive idle animations',
  ],
  
  heroPresentation: [
    'Contextual content allowed (with affinity)',
    'Intimate mode requires affinity 3+',
    'Camera intimacy locked until threshold',
    'User must opt-in to enhanced modes',
  ],
  
  storeCompliance: [
    'No nudity ever',
    'Suggestive content gated behind age verification',
    'All intimate content is implied, not explicit',
    'Screenshots must pass store review',
  ],
} as const;
