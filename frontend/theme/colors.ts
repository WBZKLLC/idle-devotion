// /app/frontend/theme/colors.ts
// Phase 3.23.6: Chromatic Authority Pass
// 
// Shift from "cool navy" toward "warm ink + gold authority"
// More Idle Angels feel: warm, rich, possessive
// Sanctuary restraint: gold in 1-2 focal points per screen

export const COLORS = {
  // Primary - Warm Ink shades (shifted from blue-navy toward warm violet-ink)
  // Before: #0a1628 (cool blue-navy)
  // After: Warmer ink with subtle violet undertone
  navy: {
    darkest: '#0c1420',      // Warmed: less blue, more ink
    dark: '#10192b',         // Warmed: subtle violet warmth
    primary: '#1c2536',      // Warmed: ink-blue with violet hint
    medium: '#2a3542',       // Warmed: muted ink
    light: '#3e546e',        // Warmed: less saturated blue
  },
  
  // Accent - Richer Gold shades (more amber warmth, less brass)
  // Increased presence as ambient glow, not lines
  gold: {
    darkest: '#7a6545',      // Richer amber shadow
    dark: '#a67c15',         // Deeper gold
    primary: '#c9a227',      // Core gold (unchanged - anchor point)
    medium: '#d4b442',       // Warmer medium
    light: '#e8c85c',        // Warmer light
    pale: '#f5e8c8',         // Warmer pale (ivory tint)
    muted: '#8d7a4d',        // Richer muted
    glow: '#c9a22720',       // Gold glow (20% opacity) - for ambient backgrounds
    glowStrong: '#c9a22740', // Stronger glow (40% opacity)
  },
  
  // Neutral - Ivory Cream shades (warmer for "closer" feeling)
  // Before: Pure white, clinical
  // After: Ivory warmth, intimate
  cream: {
    pure: '#fffef9',         // Slightly warm white (was #ffffff)
    light: '#fcfaf5',        // Ivory light
    soft: '#f8f4ec',         // Warmer soft
    warm: '#f2ebe0',         // Richer warm
    dark: '#e5ddd0',         // Warmer dark
  },
  
  // Status Colors (unchanged - functional)
  success: '#4a7c59',
  error: '#8b4049',
  warning: '#b8860b',
  
  // Phase 3.22.1: Additional accent colors (warmed violet for ink harmony)
  violet: {
    dark: '#2a1b42',         // Warmer violet dark
    primary: '#5a3d7a',      // Warmer violet primary
    light: '#8a6ba8',        // Warmer violet light
    glow: '#a88bda',         // Warmer glow
  },
  
  celestial: {
    deep: '#0e0a18',         // Warmer deep
    mid: '#1a1328',          // Warmer mid
    accent: '#3a2d52',       // Warmer accent
  },
  
  // Rarity Colors (unchanged - game-specific)
  rarity: {
    SR: '#8b9dc3',
    SSR: '#d4af37',
    'SSR+': '#b8860b',
    UR: '#6b5b95',
    'UR+': '#9b4dca',
  },
  
  // Text Colors (warmed for ivory harmony)
  text: {
    primary: '#1c2536',      // Match navy.primary (ink)
    secondary: '#5a6878',    // Warmer gray
    light: '#889098',        // Warmer light gray
    inverse: '#fffef9',      // Match cream.pure (ivory)
    gold: '#c9a227',         // Core gold (unchanged)
  },
  
  // Background gradients (warmed for ink + gold authority)
  gradients: {
    primary: ['#10192b', '#1c2536'],        // Warm ink
    card: ['#1c2536', '#2a3542'],           // Warm card
    gold: ['#c9a227', '#a67c15'],           // Richer gold
    goldLight: ['#e8c85c', '#d4b442'],      // Warmer gold light
    divine: ['#c9a227', '#9b4dca'],         // Unchanged
    premium: ['#6b5b95', '#1c2536'],        // Warmed
    common: ['#3e546e', '#1c2536'],         // Warmed
    success: ['#4a7c59', '#3d5a40'],        // Unchanged
    // Phase 3.23.6: New ambient gradients for gold glow effect
    goldAmbient: ['#c9a22700', '#c9a22720', '#c9a22700'],
    inkDeep: ['#0c1420', '#10192b'],
  },
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    shadowColor: '#c9a227',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  // Phase 3.23.6: Gold glow shadow for focal anchors
  goldGlow: {
    shadowColor: '#c9a227',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
};

export default COLORS;
