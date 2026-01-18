/**
 * Phase 3.60 + 4.0: Skill Cut-In Registry
 * 
 * Single source of truth for all skill cut-in configurations.
 * This registry defines which heroes have cut-in animations, their
 * trigger conditions, and display properties.
 * 
 * Cut-ins are purely cosmetic - they don't affect battle outcomes.
 * 
 * Phase 4.0: Added assetUri field for real asset support.
 */

export type SkillCutInConfig = {
  /** Unique identifier for this cut-in */
  id: string;
  
  /** Hero ID this cut-in belongs to */
  heroId: string;
  
  /** Display name shown during cut-in */
  skillName: string;
  
  /** Short flavor text for the skill */
  flavorText?: string;
  
  /** Element type for theming (fire, water, earth, etc.) */
  element?: 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark' | 'neutral';
  
  /** Hero rarity - affects visual effects intensity */
  rarity?: 'R' | 'SR' | 'SSR' | 'UR';
  
  /** Duration of the cut-in animation in ms */
  duration?: number;
  
  /** Whether this is an ultimate/signature skill */
  isUltimate?: boolean;
  
  /** Background gradient colors [start, end] */
  bgColors?: [string, string];
  
  /** Icon to display (from Ionicons) */
  icon?: string;
  
  /** Phase 4.0: Asset URI for cut-in image (optional - falls back to gradient) */
  assetUri?: string;
};

/**
 * Master registry of all skill cut-ins.
 * Keyed by hero ID for O(1) lookup.
 */
export const SKILL_CUTIN_REGISTRY: Record<string, SkillCutInConfig[]> = {
  // Starter Heroes
  hero_knight_001: [
    {
      id: 'knight_slash',
      heroId: 'hero_knight_001',
      skillName: 'Valor Strike',
      flavorText: 'For honor and glory!',
      element: 'light',
      rarity: 'SR',
      duration: 1500,
      isUltimate: false,
      bgColors: ['#eab308', '#f59e0b'],
      icon: 'flash',
    },
    {
      id: 'knight_shield_bash',
      heroId: 'hero_knight_001',
      skillName: 'Shield Bash',
      flavorText: 'Hold the line!',
      element: 'earth',
      rarity: 'SR',
      duration: 1200,
      isUltimate: false,
      bgColors: ['#78716c', '#57534e'],
      icon: 'shield',
    },
  ],
  
  hero_mage_001: [
    {
      id: 'mage_fireball',
      heroId: 'hero_mage_001',
      skillName: 'Inferno Burst',
      flavorText: 'Feel the flames!',
      element: 'fire',
      rarity: 'SSR',
      duration: 1800,
      isUltimate: true,
      bgColors: ['#dc2626', '#f97316'],
      icon: 'flame',
    },
  ],
  
  hero_archer_001: [
    {
      id: 'archer_volley',
      heroId: 'hero_archer_001',
      skillName: 'Arrow Storm',
      flavorText: 'Rain death from above!',
      element: 'wind',
      rarity: 'SR',
      duration: 1400,
      isUltimate: false,
      bgColors: ['#22c55e', '#84cc16'],
      icon: 'cloud',
    },
  ],
  
  hero_healer_001: [
    {
      id: 'healer_blessing',
      heroId: 'hero_healer_001',
      skillName: 'Divine Blessing',
      flavorText: 'May the light protect you!',
      element: 'light',
      rarity: 'SSR',
      duration: 1600,
      isUltimate: true,
      bgColors: ['#fef3c7', '#fbbf24'],
      icon: 'sunny',
    },
  ],
  
  // Legendary Heroes
  hero_dragon_lord: [
    {
      id: 'dragon_breath',
      heroId: 'hero_dragon_lord',
      skillName: 'Dragonfire',
      flavorText: 'Burn in eternal flames!',
      element: 'fire',
      rarity: 'UR',
      duration: 2000,
      isUltimate: true,
      bgColors: ['#7f1d1d', '#dc2626'],
      icon: 'flame',
    },
  ],
  
  hero_shadow_assassin: [
    {
      id: 'shadow_strike',
      heroId: 'hero_shadow_assassin',
      skillName: 'Shadow Dance',
      flavorText: 'Death comes silently...',
      element: 'dark',
      rarity: 'UR',
      duration: 1600,
      isUltimate: true,
      bgColors: ['#1f2937', '#111827'],
      icon: 'moon',
    },
  ],
};

/**
 * Get all cut-ins for a specific hero.
 * Returns empty array if hero has no cut-ins.
 */
export function getHeroCutIns(heroId: string): SkillCutInConfig[] {
  return SKILL_CUTIN_REGISTRY[heroId] ?? [];
}

/**
 * Get a specific cut-in by ID.
 */
export function getCutInById(cutInId: string): SkillCutInConfig | null {
  for (const heroId of Object.keys(SKILL_CUTIN_REGISTRY)) {
    const found = SKILL_CUTIN_REGISTRY[heroId].find(c => c.id === cutInId);
    if (found) return found;
  }
  return null;
}

/**
 * Get a random cut-in from a hero's available cut-ins.
 * Used for battle presentation when specific cut-in isn't determined.
 * 
 * Deterministic if seed is provided (for replay consistency).
 */
export function getRandomCutIn(
  heroId: string,
  seed?: number
): SkillCutInConfig | null {
  const cutIns = getHeroCutIns(heroId);
  if (cutIns.length === 0) return null;
  
  const index = seed !== undefined 
    ? seed % cutIns.length 
    : Math.floor(Math.random() * cutIns.length);
  
  return cutIns[index];
}

/**
 * Generate cut-ins for a battle presentation.
 * Returns 0-2 cut-ins based on battle conditions.
 * 
 * @param heroIds - Hero IDs in the player's team
 * @param victory - Whether the battle was won
 * @param seed - Optional seed for determinism
 */
export function generateBattleCutIns(
  heroIds: string[],
  victory: boolean,
  seed?: number
): SkillCutInConfig[] {
  const cutIns: SkillCutInConfig[] = [];
  const maxCutIns = victory ? 2 : 1;
  
  // Find heroes with available cut-ins
  const eligibleHeroes = heroIds.filter(id => getHeroCutIns(id).length > 0);
  
  if (eligibleHeroes.length === 0) return cutIns;
  
  // Deterministically select cut-ins if seed provided
  const seedOffset = seed ?? Date.now();
  
  for (let i = 0; i < maxCutIns && i < eligibleHeroes.length; i++) {
    const heroIndex = (seedOffset + i) % eligibleHeroes.length;
    const heroId = eligibleHeroes[heroIndex];
    const heroCutIns = getHeroCutIns(heroId);
    
    const cutInIndex = (seedOffset + i) % heroCutIns.length;
    cutIns.push(heroCutIns[cutInIndex]);
  }
  
  return cutIns;
}

/**
 * Default fallback cut-in for heroes without registered cut-ins.
 * Used to ensure all battles can show at least basic cut-in.
 */
export const DEFAULT_CUTIN: SkillCutInConfig = {
  id: 'default_attack',
  heroId: 'unknown',
  skillName: 'Special Attack',
  flavorText: 'Take this!',
  element: 'neutral',
  rarity: 'R',
  duration: 1200,
  isUltimate: false,
  bgColors: ['#4b5563', '#374151'],
  icon: 'flash',
};

/**
 * Get element color for theming.
 */
export function getElementColor(element: SkillCutInConfig['element']): string {
  const colors: Record<NonNullable<SkillCutInConfig['element']>, string> = {
    fire: '#dc2626',
    water: '#3b82f6',
    earth: '#78716c',
    wind: '#22c55e',
    light: '#fbbf24',
    dark: '#6b21a8',
    neutral: '#6b7280',
  };
  return colors[element ?? 'neutral'];
}
