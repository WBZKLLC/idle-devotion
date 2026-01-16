/**
 * lib/ui/interaction.ts
 * 
 * Phase 3.22.4: Shared interaction constants for micro-interactions
 * Provides consistent pressed feedback across all interactive elements
 */

import { Platform } from 'react-native';

// Pressed state transforms
export const PRESS = {
  /** Scale factor when pressed (subtle shrink) */
  SCALE: 0.98,
  /** Opacity when pressed */
  OPACITY: 0.92,
  /** Active opacity for TouchableOpacity components */
  ACTIVE_OPACITY: 0.85,
} as const;

// Animation durations (ms)
export const DURATION = {
  /** Quick micro-interaction */
  MICRO: 100,
  /** Standard transition */
  STANDARD: 200,
  /** Slower, more deliberate */
  SLOW: 300,
} as const;

/**
 * Haptic feedback wrapper (no-op on web)
 * Safe to call anywhere - gracefully degrades
 */
export async function haptic(style: 'light' | 'medium' | 'heavy' | 'selection' = 'light'): Promise<void> {
  if (Platform.OS === 'web') return;
  
  try {
    // Dynamic import to avoid bundling on web
    const Haptics = await import('expo-haptics');
    
    switch (style) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
    }
  } catch {
    // Silently fail if haptics unavailable
  }
}

/**
 * Generate pressed style for Pressable components
 * Usage: style={({ pressed }) => [styles.base, pressedStyle(pressed)]}
 */
export function pressedStyle(pressed: boolean) {
  return pressed ? {
    transform: [{ scale: PRESS.SCALE }],
    opacity: PRESS.OPACITY,
  } : undefined;
}

/**
 * Combine base styles with pressed state
 * Usage: style={({ pressed }) => getPressedStyles(styles.tile, pressed)}
 */
export function getPressedStyles(baseStyle: any, pressed: boolean) {
  if (!pressed) return baseStyle;
  return [
    baseStyle,
    {
      transform: [{ scale: PRESS.SCALE }],
      opacity: PRESS.OPACITY,
    },
  ];
}
