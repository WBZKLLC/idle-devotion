// /app/frontend/lib/tier.ts
// SINGLE SOURCE OF TRUTH for stars → tiers → art → gating
// DO NOT reimplement this logic elsewhere

export type DisplayTier = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Raw backend stars (0–6). UI shows EXACT value.
 */
export const displayStars = (hero: any): number => {
  const s = Number(hero?.stars ?? 0);
  if (!isFinite(s)) return 0;
  return Math.max(0, Math.min(6, s));
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
 */
export const unlockedTierForHero = (hero: any): DisplayTier => {
  const stars = displayStars(hero);
  const awaken = Number(hero?.awakening_level ?? 0);

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
