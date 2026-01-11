/**
 * Power Calculation - SINGLE SOURCE OF TRUTH
 * 
 * All power calculations should use this helper to ensure consistency.
 * The formula is: HP + ATK*3 + DEF*2
 * 
 * If the formula needs to change, change it here only.
 */

import type { CombatStats } from './combatStats';

/**
 * Standard power formula: HP + ATK*3 + DEF*2
 * Used by most screens (heroes list, hero detail, progression, etc.)
 */
export function computePower(stats: CombatStats): number {
  return Math.floor(stats.hp + stats.atk * 3 + stats.def * 2);
}

/**
 * Alternative power formula: HP + ATK*2 + DEF
 * Used by team.tsx for team power calculation
 */
export function computeTeamPower(stats: CombatStats): number {
  return Math.floor(stats.hp + stats.atk * 2 + stats.def);
}

/**
 * Power with multipliers (level, star, awakening)
 * Use this for progression/preview screens
 */
export function computePowerWithMultipliers(
  stats: CombatStats,
  levelMult: number = 1,
  starMult: number = 1,
  awakenMult: number = 1
): number {
  const basePower = computePower(stats);
  return Math.floor(basePower * levelMult * starMult * awakenMult);
}
