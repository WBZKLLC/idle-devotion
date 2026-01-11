/**
 * Combat Stats - SINGLE SOURCE OF TRUTH
 * 
 * This is the CANONICAL place where hero combat stats are computed for display.
 * All UI screens MUST use this helper for HP/ATK/DEF/SPD display and power calculations.
 * 
 * Applies all bonuses (currently: cinematic ownership).
 * 
 * Later, when server-side verification is implemented, this logic can be
 * mirrored on the backend for actual combat outcomes.
 */

import { cinematicOwnershipBonus, type CombatBonus } from './combatBonuses';
import { hasHeroCinematicOwned } from './cinematicsAccess';

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
  hasCinematicBonus: boolean;
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
    ''
  );
}

/**
 * Compute final combat stats for a hero with all bonuses applied.
 * 
 * THIS IS THE ONLY PLACE WHERE CINEMATIC PERK IS APPLIED.
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
  
  // Check cinematic ownership
  const hasCinematicOwned = heroId ? hasHeroCinematicOwned(heroId) : false;
  const bonus = cinematicOwnershipBonus(hasCinematicOwned);

  // Apply bonuses
  return {
    hp: Math.floor(baseHp * bonus.hpMult),
    atk: Math.floor(baseAtk * bonus.atkMult),
    def: Math.floor(baseDef * bonus.defMult),
    speed: Math.floor(baseSpeed * bonus.speedMult),
    hasCinematicBonus: hasCinematicOwned,
  };
}

/**
 * Compute hero power rating using bonused stats.
 * Uses the standard formula: HP + ATK*3 + DEF*2 + SPD*1.5
 * 
 * @param hero - User's hero instance
 * @param heroData - Hero base data
 * @returns Power rating (integer)
 */
export function computeHeroPower(hero: any, heroData: any): number {
  const stats = computeCombatStats(hero, heroData);
  return Math.floor(stats.hp + stats.atk * 3 + stats.def * 2 + stats.speed * 1.5);
}

/**
 * Compute power from raw stats (for cases where stats are already computed)
 */
export function computePowerFromStats(stats: CombatStats): number {
  return Math.floor(stats.hp + stats.atk * 3 + stats.def * 2 + stats.speed * 1.5);
}
