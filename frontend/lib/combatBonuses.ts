/**
 * Combat Bonuses
 * 
 * Defines all combat stat modifiers from various sources.
 * Currently: Cinematic ownership bonus.
 * Future: Equipment bonuses, buff bonuses, etc.
 */

export type CombatBonus = {
  hpMult: number;
  atkMult: number;
  defMult: number;
  speedMult: number;
};

/**
 * Default bonus (no modification)
 */
export const NO_BONUS: CombatBonus = {
  hpMult: 1.0,
  atkMult: 1.0,
  defMult: 1.0,
  speedMult: 1.0,
};

/**
 * Cinematic ownership bonus.
 * Owning a hero's cinematic grants:
 * - +10% HP
 * - +5% ATK
 * 
 * @param isOwned - Whether the user owns this hero's cinematic
 * @returns CombatBonus multipliers
 */
export function cinematicOwnershipBonus(isOwned: boolean): CombatBonus {
  if (!isOwned) return NO_BONUS;
  
  return {
    hpMult: 1.10,   // +10% HP
    atkMult: 1.05,  // +5% ATK
    defMult: 1.0,
    speedMult: 1.0,
  };
}

/**
 * Combine multiple bonuses (multiplicative)
 */
export function combineBonuses(...bonuses: CombatBonus[]): CombatBonus {
  return bonuses.reduce(
    (acc, b) => ({
      hpMult: acc.hpMult * b.hpMult,
      atkMult: acc.atkMult * b.atkMult,
      defMult: acc.defMult * b.defMult,
      speedMult: acc.speedMult * b.speedMult,
    }),
    NO_BONUS
  );
}
