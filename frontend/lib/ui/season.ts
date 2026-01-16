// /app/frontend/lib/ui/season.ts
// Phase 3.22.6.D: Seasonal Color Temperature Shift
//
// A tiny temperature bias applied to the home palette:
// - Winter: cooler/navy a bit deeper
// - Spring: slightly cleaner highlights
// - Summer: warmer gold
// - Fall: richer amber, less violet
//
// This is NOT a theme swap — it's a 5-8% shift.
// Computed once on app start, not per-render.

type Season = 'winter' | 'spring' | 'summer' | 'fall';

type TemperatureBias = {
  /** Gold warmth multiplier (1.0 = no change) */
  goldWarmth: number;
  /** Navy coolness shift (positive = cooler) */
  navyCool: number;
  /** Violet saturation multiplier */
  violetSaturation: number;
  /** Highlight brightness */
  highlightBrightness: number;
};

/**
 * Determine current season from local time
 */
function getCurrentSeason(): Season {
  const month = new Date().getMonth(); // 0-11
  
  // Northern hemisphere seasons
  if (month >= 2 && month <= 4) return 'spring';   // Mar-May
  if (month >= 5 && month <= 7) return 'summer';   // Jun-Aug
  if (month >= 8 && month <= 10) return 'fall';    // Sep-Nov
  return 'winter';                                  // Dec-Feb
}

/**
 * Get temperature bias for current season
 * All values are subtle — 5-8% shifts max
 */
function getSeasonBias(season: Season): TemperatureBias {
  switch (season) {
    case 'winter':
      return {
        goldWarmth: 0.95,      // slightly cooler gold
        navyCool: 0.04,        // deeper navy
        violetSaturation: 1.02, // slightly more violet
        highlightBrightness: 0.96,
      };
    case 'spring':
      return {
        goldWarmth: 1.0,       // neutral
        navyCool: 0.0,         // neutral
        violetSaturation: 0.98, // cleaner, less violet
        highlightBrightness: 1.04, // slightly brighter
      };
    case 'summer':
      return {
        goldWarmth: 1.06,      // warmer gold
        navyCool: -0.02,       // slightly warmer navy
        violetSaturation: 0.96, // less violet
        highlightBrightness: 1.02,
      };
    case 'fall':
      return {
        goldWarmth: 1.04,      // richer amber
        navyCool: 0.02,        // slightly cooler
        violetSaturation: 0.94, // less violet, more amber
        highlightBrightness: 0.98,
      };
  }
}

// Cached values (computed once)
let cachedSeason: Season | null = null;
let cachedBias: TemperatureBias | null = null;

/**
 * Get current season (cached)
 */
export function getSeason(): Season {
  if (!cachedSeason) {
    cachedSeason = getCurrentSeason();
  }
  return cachedSeason;
}

/**
 * Get temperature bias (cached)
 */
export function getTemperatureBias(): TemperatureBias {
  if (!cachedBias) {
    cachedBias = getSeasonBias(getSeason());
  }
  return cachedBias;
}

/**
 * Apply seasonal warmth to a hex color
 * Shifts the color temperature slightly based on season
 */
export function applySeasonalWarmth(hexColor: string): string {
  const bias = getTemperatureBias();
  
  // Parse hex to RGB
  const hex = hexColor.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Apply warmth (shift red/blue balance slightly)
  if (bias.goldWarmth !== 1.0) {
    r = Math.min(255, Math.round(r * bias.goldWarmth));
    b = Math.min(255, Math.round(b / bias.goldWarmth));
  }
  
  // Apply navy coolness (deepen blues)
  if (bias.navyCool !== 0) {
    b = Math.min(255, Math.round(b * (1 + bias.navyCool)));
  }
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get seasonal gold color
 */
export function getSeasonalGold(baseGold: string): string {
  return applySeasonalWarmth(baseGold);
}

/**
 * Get seasonal navy color
 */
export function getSeasonalNavy(baseNavy: string): string {
  const bias = getTemperatureBias();
  const hex = baseNavy.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Deepen navy based on coolness
  if (bias.navyCool > 0) {
    r = Math.max(0, Math.round(r * (1 - bias.navyCool * 0.5)));
    g = Math.max(0, Math.round(g * (1 - bias.navyCool * 0.3)));
    b = Math.min(255, Math.round(b * (1 + bias.navyCool * 0.2)));
  }
  
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Export season name for display/debug
 */
export function getSeasonName(): string {
  return getSeason().charAt(0).toUpperCase() + getSeason().slice(1);
}
