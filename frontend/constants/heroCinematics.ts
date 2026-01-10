/**
 * Hero 5+ Star Cinematic Video Mappings
 * 
 * This file provides a single source of truth for hero cinematic videos.
 * Videos are ONLY shown when a hero reaches 5+ star (final ascension tier).
 * 
 * IMPORTANT:
 * - All heroIds MUST match existing hero IDs exactly
 * - Use static require() for video assets, NOT URLs
 * - If a video is missing, the lookup returns undefined (safe fallback)
 */

// Type definition for hero cinematic mapping
export type HeroId = 
  | 'azrael_the_fallen'
  | 'marcus_the_shield'
  | 'kane_the_berserker'
  | 'soren_the_flame'
  | 'lysander_the_frost'
  | 'theron_the_storm'
  | 'kai_the_tempest'
  | 'robin_the_hunter'
  | 'darius_the_void'
  | 'leon_the_paladin'
  | 'lucian_the_divine'
  | 'morgana_the_shadow'
  | 'artemis_the_swift'
  | 'orion_the_mystic'
  | 'phoenix_the_reborn'
  | 'gale_the_windwalker'
  | 'seraphiel_the_radiant'
  | 'malachi_the_destroyer'
  | 'selene_the_moonbow'
  | 'raphael_the_eternal'
  | 'michael_the_archangel'
  | 'apollyon_the_fallen';

/**
 * Video asset mappings for 5+ star hero cinematics
 * 
 * NOTE: Videos must be placed in /assets/videos/hero_5plus/ folder
 * Format: {hero_id}_5plus.mp4
 * 
 * PLACEHOLDER: Currently using require() with placeholder paths.
 * Replace with actual video files when available.
 */

// Video availability flag - set to true when actual videos are added
export const VIDEOS_AVAILABLE = false;

// Placeholder video source (can be a static image or loading animation)
// This is returned when VIDEOS_AVAILABLE is false
export const PLACEHOLDER_VIDEO = null;

/**
 * Get the cinematic video source for a hero at 5+ star
 * @param heroId - The hero's unique identifier (must match exactly)
 * @returns Video require source or undefined if not available
 */
export function getHeroCinematicVideo(heroId: string): any | undefined {
  if (!VIDEOS_AVAILABLE) {
    if (__DEV__) {
      console.log(`[HeroCinematics] Videos not yet available. Hero: ${heroId}`);
    }
    return undefined;
  }
  
  return HERO_5PLUS_CINEMATICS[heroId as HeroId];
}

/**
 * Check if a hero has a cinematic video available
 * @param heroId - The hero's unique identifier
 * @returns boolean indicating if video exists
 */
export function hasCinematicVideo(heroId: string): boolean {
  if (!VIDEOS_AVAILABLE) return false;
  return heroId in HERO_5PLUS_CINEMATICS;
}

/**
 * Hero cinematic video mappings
 * 
 * When videos are added, uncomment the require statements and set VIDEOS_AVAILABLE = true
 */
export const HERO_5PLUS_CINEMATICS: Partial<Record<HeroId, any>> = {
  // Uncomment these when video files are added to /assets/videos/hero_5plus/
  // azrael_the_fallen: require('../assets/videos/hero_5plus/azrael_the_fallen_5plus.mp4'),
  // marcus_the_shield: require('../assets/videos/hero_5plus/marcus_the_shield_5plus.mp4'),
  // kane_the_berserker: require('../assets/videos/hero_5plus/kane_the_berserker_5plus.mp4'),
  // soren_the_flame: require('../assets/videos/hero_5plus/soren_the_flame_5plus.mp4'),
  // lysander_the_frost: require('../assets/videos/hero_5plus/lysander_the_frost_5plus.mp4'),
  // theron_the_storm: require('../assets/videos/hero_5plus/theron_the_storm_5plus.mp4'),
  // kai_the_tempest: require('../assets/videos/hero_5plus/kai_the_tempest_5plus.mp4'),
  // robin_the_hunter: require('../assets/videos/hero_5plus/robin_the_hunter_5plus.mp4'),
  // darius_the_void: require('../assets/videos/hero_5plus/darius_the_void_5plus.mp4'),
  // leon_the_paladin: require('../assets/videos/hero_5plus/leon_the_paladin_5plus.mp4'),
  // lucian_the_divine: require('../assets/videos/hero_5plus/lucian_the_divine_5plus.mp4'),
  // morgana_the_shadow: require('../assets/videos/hero_5plus/morgana_the_shadow_5plus.mp4'),
  // artemis_the_swift: require('../assets/videos/hero_5plus/artemis_the_swift_5plus.mp4'),
  // orion_the_mystic: require('../assets/videos/hero_5plus/orion_the_mystic_5plus.mp4'),
  // phoenix_the_reborn: require('../assets/videos/hero_5plus/phoenix_the_reborn_5plus.mp4'),
  // gale_the_windwalker: require('../assets/videos/hero_5plus/gale_the_windwalker_5plus.mp4'),
  // seraphiel_the_radiant: require('../assets/videos/hero_5plus/seraphiel_the_radiant_5plus.mp4'),
  // malachi_the_destroyer: require('../assets/videos/hero_5plus/malachi_the_destroyer_5plus.mp4'),
  // selene_the_moonbow: require('../assets/videos/hero_5plus/selene_the_moonbow_5plus.mp4'),
  // raphael_the_eternal: require('../assets/videos/hero_5plus/raphael_the_eternal_5plus.mp4'),
  // michael_the_archangel: require('../assets/videos/hero_5plus/michael_the_archangel_5plus.mp4'),
  // apollyon_the_fallen: require('../assets/videos/hero_5plus/apollyon_the_fallen_5plus.mp4'),
};

/**
 * List of all hero IDs for validation
 */
export const ALL_HERO_IDS: HeroId[] = [
  'azrael_the_fallen',
  'marcus_the_shield',
  'kane_the_berserker',
  'soren_the_flame',
  'lysander_the_frost',
  'theron_the_storm',
  'kai_the_tempest',
  'robin_the_hunter',
  'darius_the_void',
  'leon_the_paladin',
  'lucian_the_divine',
  'morgana_the_shadow',
  'artemis_the_swift',
  'orion_the_mystic',
  'phoenix_the_reborn',
  'gale_the_windwalker',
  'seraphiel_the_radiant',
  'malachi_the_destroyer',
  'selene_the_moonbow',
  'raphael_the_eternal',
  'michael_the_archangel',
  'apollyon_the_fallen',
];

/**
 * Convert hero name to hero ID format
 * Example: "Azrael the Fallen" -> "azrael_the_fallen"
 */
export function heroNameToId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}
