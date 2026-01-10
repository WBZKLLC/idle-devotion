// /app/frontend/lib/tier.ts
/**
 * SINGLE SOURCE OF TRUTH:
 * - backend stars (0–6) normalization
 * - stars -> tier mapping
 * - tier -> art key mapping
 *
 * No other file should re-implement these rules.
 * All star/tier logic MUST flow through this module.
 */

// ─────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────

// 1–6 = Star tiers (currently active)
// 7–10 = Future Awakening tiers (NOT ACTIVE YET)
export type DisplayTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type BackendStars = number; // 0–6 from backend
export type TierArtKey = string;   // "1" through "6" for ascension_images lookup

// UI should clamp to MAX_STAR_TIER for now
export const MAX_STAR_TIER = 6;
export const MAX_AWAKENING_TIER = 10;

// ─────────────────────────────────────────────────────────────
// CORE NORMALIZATION (prevents drift)
// ─────────────────────────────────────────────────────────────

/**
 * Normalize raw backend stars to valid range (0-6).
 * This is the ONLY function that should clamp star values.
 */
export const normalizeBackendStars = (stars: number): BackendStars => {
  const n = Number.isFinite(stars) ? Math.floor(stars) : 0;
  return Math.max(0, Math.min(MAX_STAR_TIER, n));
};

/**
 * Extract backend stars from hero object.
 * Handles multiple possible field names to prevent drift.
 * 
 * USE THIS instead of accessing hero.stars directly.
 */
export const getHeroBackendStars = (hero: any): BackendStars => {
  const raw =
    hero?.stars ??
    hero?.new_stars ??
    hero?.backend_stars ??
    hero?.star_count ??
    0;
  return normalizeBackendStars(Number(raw));
};

/**
 * Raw backend stars (0–6). UI shows EXACT value.
 * @deprecated Use getHeroBackendStars() for new code
 */
export const displayStars = (hero: any): number => {
  return getHeroBackendStars(hero);
};

/**
 * Maps backend stars + awakening to unlocked tier.
 *
 * RULES (AUTHORITATIVE):
 * stars = 0  → tier 1
 * stars = 1  → tier 2
 * stars = 2  → tier 3
 * stars = 3  → tier 4
 * stars = 4  → tier 5
 * stars ≥ 5 OR awakening > 0 → tier 6 (5★+)
 * 
 * FUTURE (Awakening system, NOT YET ACTIVE):
 * awakening_level = 1 → tier 7 (7★)
 * awakening_level = 2 → tier 8 (8★)
 * awakening_level = 3 → tier 9 (9★)
 * awakening_level = 4 → tier 10 (10★)
 */
export const unlockedTierForHero = (hero: any): DisplayTier => {
  const stars = displayStars(hero);
  const awaken = Number(hero?.awakening_level ?? 0);

  // For now, cap at tier 6 (5★+). Awakening tiers will be added later.
  if (awaken > 0 || stars >= 5) return 6;
  return (Math.max(1, Math.min(5, stars + 1)) as DisplayTier);
};

/**
 * Clamp a requested tier (global or local) to what the hero has unlocked.
 */
export const effectiveTierForHero = (
  hero: any,
  requestedTier: DisplayTier
): DisplayTier => {
  const unlocked = unlockedTierForHero(hero);
  return requestedTier <= unlocked ? requestedTier : unlocked;
};

/**
 * Resolve ascension art EXACTLY from API response.
 * IMPORTANT: Returns a STRING url (or undefined), NOT an { uri: ... } object.
 * This prevents "Objects are not valid as a React child" errors.
 */
export const resolveTierArt = (
  heroData: any,
  tier: number
): string | undefined => {
  const t = String(Math.max(1, Math.min(6, Number(tier) || 1)));

  const asc = heroData?.ascension_images;
  if (asc && typeof asc === 'object') {
    const v = asc[t];
    if (typeof v === 'string' && v.length > 0) return v;
  }

  // Fallback to default image_url but still a STRING
  const img = heroData?.image_url;
  if (typeof img === 'string' && img.length > 0) return img;

  return undefined;
};

/**
 * Compute max unlocked tier across all heroes (for global tier selector)
 */
export const computeUserMaxUnlockedTier = (heroes: any[]): DisplayTier => {
  let max: DisplayTier = 1;
  for (const h of heroes || []) {
    const t = unlockedTierForHero(h);
    if (t > max) max = t;
  }
  return max;
};

/**
 * Tier labels for UI (object format for lookup)
 */
export const TIER_LABELS: Record<DisplayTier, string> = {
  1: '1★',
  2: '2★',
  3: '3★',
  4: '4★',
  5: '5★',
  6: '5★+',
};

/**
 * Tier labels array for mapping in UI selectors
 */
export const TIER_LABEL_ARRAY: { tier: DisplayTier; label: string }[] = [
  { tier: 1, label: '1★' },
  { tier: 2, label: '2★' },
  { tier: 3, label: '3★' },
  { tier: 4, label: '4★' },
  { tier: 5, label: '5★' },
  { tier: 6, label: '5★+' },
];
