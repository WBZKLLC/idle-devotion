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
 * NO GUESSING. NO FALLBACKS except explicit.
 */
export const resolveTierArt = (
  heroData: any,
  tier: DisplayTier
): string | null => {
  if (!heroData?.ascension_images) return heroData?.image_url ?? null;

  return (
    heroData.ascension_images[String(tier)] ||
    heroData.image_url ||
    null
  );
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
 * Tier labels for UI
 */
export const TIER_LABELS: Record<DisplayTier, string> = {
  1: '1★',
  2: '2★',
  3: '3★',
  4: '4★',
  5: '5★',
  6: '5★+',
};
