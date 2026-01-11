/**
 * Combat Stats - SINGLE SOURCE OF TRUTH
 * 
 * This is the CANONICAL place where hero combat stats are computed for display.
 * All UI screens MUST use this helper for HP/ATK/DEF/SPD display and power calculations.
 * 
 * Applies all bonuses (currently: premium cinematic ownership).
 * 
 * Later, when server-side verification is implemented, this logic can be
 * mirrored on the backend for actual combat outcomes.
 */

import { premiumCinematicOwnershipBonus, type CombatBonus } from './combatBonuses';
import { hasHeroPremiumCinematicOwned } from './cinematicsAccess';

/**
 * Clamp a number to integer within bounds
 */
function clampInt(n: any, min: number, max: number): number {
  const x = Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 0;
  return Math.max(min, Math.min(max, x));
}

/**
 * Combat stats structure returned by computeCombatStats
 */
export type CombatStats = {
  hp: number;
  atk: number;
  def: number;
  speed: number;
  // Bonus info for UI display
  hasPremiumCinematicBonus: boolean;
};

/**
 * Extract hero ID from various hero object formats
 */
function extractHeroId(hero: any): string {
  // Try various common field names
  return String(
    hero?.hero_id ??
    hero?.hero_key ??
    hero?.stableId ??
    hero?.stable_id ??
    hero?.id ??
    hero?.hero_data?.hero_id ??
    hero?.hero_data?.stable_id ??
    hero?.hero_data?.id ??
    ''
  );
}

/**
 * Compute final combat stats for a hero with all bonuses applied.
 * 
 * THIS IS THE ONLY PLACE WHERE PREMIUM CINEMATIC PERK IS APPLIED.
 * All UI must use this function for consistency.
 * 
 * @param hero - User's hero instance (with current_hp, current_atk, etc.)
 * @param heroData - Hero base data (with base_hp, base_atk, etc.)
 * @returns CombatStats with all bonuses applied
 */
export function computeCombatStats(hero: any, heroData: any): CombatStats {
  // Get base stats (prefer current_ from hero, fallback to base_ from heroData)
  const baseHp = clampInt(hero?.current_hp ?? heroData?.base_hp ?? 0, 0, 999999999);
  const baseAtk = clampInt(hero?.current_atk ?? heroData?.base_atk ?? 0, 0, 999999999);
  const baseDef = clampInt(hero?.current_def ?? heroData?.base_def ?? 0, 0, 999999999);
  const baseSpeed = clampInt(hero?.current_speed ?? heroData?.base_speed ?? 100, 0, 999999999);

  // Get hero ID for per-hero bonuses
  const heroId = extractHeroId(hero) || extractHeroId(heroData);
  
  // Check premium cinematic ownership
  const hasPremiumCinematicOwned = heroId ? hasHeroPremiumCinematicOwned(heroId) : false;
  const bonus = premiumCinematicOwnershipBonus(hasPremiumCinematicOwned);

  // Apply bonuses
  return {
    hp: Math.floor(baseHp * bonus.hpMult),
    atk: Math.floor(baseAtk * bonus.atkMult),
    def: Math.floor(baseDef * bonus.defMult),
    speed: Math.floor(baseSpeed * bonus.speedMult),
    hasPremiumCinematicBonus: hasPremiumCinematicOwned,
  };
}

/**
 * Compute combat stats from pre-calculated stats (e.g., from backend).
 * Applies premium cinematic bonus on top.
 * 
 * @param stats - Pre-calculated stats object { hp, atk, def, speed }
 * @param heroId - Hero ID for bonus lookup
 * @returns CombatStats with all bonuses applied
 */
export function computeCombatStatsFromCalculated(
  stats: { hp?: number; atk?: number; def?: number; speed?: number } | null,
  heroId: string
): CombatStats {
  const baseHp = clampInt(stats?.hp ?? 0, 0, 999999999);
  const baseAtk = clampInt(stats?.atk ?? 0, 0, 999999999);
  const baseDef = clampInt(stats?.def ?? 0, 0, 999999999);
  const baseSpeed = clampInt(stats?.speed ?? 100, 0, 999999999);

  const hasPremiumCinematicOwned = heroId ? hasHeroPremiumCinematicOwned(heroId) : false;
  const bonus = premiumCinematicOwnershipBonus(hasPremiumCinematicOwned);

  return {
    hp: Math.floor(baseHp * bonus.hpMult),
    atk: Math.floor(baseAtk * bonus.atkMult),
    def: Math.floor(baseDef * bonus.defMult),
    speed: Math.floor(baseSpeed * bonus.speedMult),
    hasPremiumCinematicBonus: hasPremiumCinematicOwned,
  };
}
