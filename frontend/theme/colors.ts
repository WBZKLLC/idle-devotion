// Regal Luxurious Color Theme
// Navy Blue, Muted Gold, Cream White

export const COLORS = {
  // Primary - Navy Blue shades
  navy: {
    darkest: '#0a1628',
    dark: '#0d1b2a',
    primary: '#1b263b',
    medium: '#283845',
    light: '#3d5a80',
  },
  
  // Accent - Muted Gold shades
  gold: {
    darkest: '#8b7355',
    dark: '#b8860b',
    primary: '#c9a227',
    medium: '#d4af37',
    light: '#e6c666',
    pale: '#f5e6c4',
    muted: '#9a8a5a',  // Phase 3.20.4: Added muted gold variant
  },
  
  // Neutral - Cream/White shades
  cream: {
    pure: '#ffffff',
    light: '#fefefe',
    soft: '#f8f6f0',
    warm: '#f5f0e6',
    dark: '#e8e0d0',
  },
  
  // Status Colors
  success: '#4a7c59',
  error: '#8b4049',
  warning: '#b8860b',
  
  // Rarity Colors
  rarity: {
    SR: '#8b9dc3',      // Soft blue-gray
    SSR: '#d4af37',     // Gold
    'SSR+': '#b8860b',  // Dark gold
    UR: '#6b5b95',      // Royal purple
    'UR+': '#9b4dca',   // Bright purple
  },
  
  // Text Colors
  text: {
    primary: '#1b263b',
    secondary: '#5c6b7a',
    light: '#8a9aaa',
    inverse: '#ffffff',
    gold: '#c9a227',
  },
  
  // Background gradients (for LinearGradient)
  gradients: {
    primary: ['#0d1b2a', '#1b263b'],
    card: ['#1b263b', '#283845'],
    gold: ['#c9a227', '#b8860b'],
    goldLight: ['#e6c666', '#d4af37'],
    divine: ['#c9a227', '#9b4dca'],
    premium: ['#6b5b95', '#1b263b'],
    common: ['#3d5a80', '#1b263b'],
    success: ['#4a7c59', '#3d5a40'],
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
};

export default COLORS;
