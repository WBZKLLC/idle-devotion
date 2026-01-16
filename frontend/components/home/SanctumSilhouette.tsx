// /app/frontend/components/home/SanctumSilhouette.tsx
// Phase 3.22.6.D: Character Silhouette Parallax
// Phase 3.22.7: Restraint Pass — presence, not display
// Phase 3.22.10.B: Parallax Polish — eased motion, no robot slide
//
// A very faint silhouette layer behind home content:
// - Opacity: 0.06 max (felt, not seen)
// - Moves only with scroll (no independent animation)
// - Uses easing interpolation (not linear)
// - Tighter clamp on small screens
// - Respects Reduce Motion setting
//
// "They're there. They don't move unless you do."

import React from 'react';
import { StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../../theme/colors';
import { SILHOUETTE } from '../ui/tokens';

type Props = {
  /** Scroll position shared value from parent ScrollView */
  scrollY: SharedValue<number>;
  /** Whether to disable parallax (respects Reduce Motion) */
  reduceMotion?: boolean;
};

/**
 * Custom easing function for scroll interpolation
 * Creates smooth, organic motion instead of linear "robot slide"
 * Uses ease-out cubic for natural deceleration
 */
function easeOutCubic(t: number): number {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Apply easing to scroll value for smooth parallax
 */
function easedScrollValue(scrollY: number, maxScroll: number): number {
  'worklet';
  const progress = Math.max(0, Math.min(1, scrollY / maxScroll));
  return easeOutCubic(progress) * maxScroll;
}

/**
 * SanctumSilhouette — ambient depth layer
 * 
 * Creates a subtle visual depth behind home content.
 * Moves slightly with scroll to create parallax effect.
 * Phase 3.22.10.B: Polished with easing, tighter clamp on small screens.
 */
export function SanctumSilhouette({ scrollY, reduceMotion = false }: Props) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  
  // Phase 3.22.10.B: Tighter clamp on small screens (< 700px height)
  const isSmallScreen = screenHeight < 700;
  const maxTranslate = isSmallScreen ? -5 : SILHOUETTE.maxTranslateY;
  const scaleRange = isSmallScreen 
    ? [1, 1.008] as const  // Tighter scale on small screens
    : SILHOUETTE.scaleRange;
  
  // Parallax animation style — scroll only, with easing
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {}; // Static when reduced motion is enabled
    }
    
    const maxScrollRange = screenHeight * 0.5;
    
    // Apply easing to scroll value for organic motion
    const easedScroll = easedScrollValue(scrollY.value, maxScrollRange);
    
    // TranslateY: 0 → maxTranslate (eased, not linear)
    const translateY = interpolate(
      easedScroll,
      [0, maxScrollRange],
      [0, maxTranslate],
      Extrapolation.CLAMP
    );
    
    // Scale: 1.00 → 1.015 (eased, not linear)
    const scale = interpolate(
      easedScroll,
      [0, maxScrollRange],
      scaleRange,
      Extrapolation.CLAMP
    );
    
    return {
      transform: [
        { translateY },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      {/* Gradient silhouette layer */}
      <LinearGradient
        colors={[
          COLORS.navy.darkest + '00', // transparent top
          COLORS.gold.dark + '08',     // very faint gold glow
          COLORS.navy.dark + '12',     // subtle navy
          COLORS.navy.darkest + '00', // transparent bottom
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      />
      
      {/* Central orb/glow effect */}
      <Animated.View style={styles.orb} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  gradient: {
    flex: 1,
    opacity: SILHOUETTE.maxOpacity, // Phase 3.22.7: Restrained to 0.06
  },
  orb: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    width: 200,
    height: 200,
    marginLeft: -100,
    borderRadius: 100,
    backgroundColor: COLORS.gold.dark,
    opacity: 0.03, // Phase 3.22.7: Reduced from 0.04
  },
});
