// /app/frontend/components/home/SanctumSilhouette.tsx
// Phase 3.22.6.D: Character Silhouette Parallax
// Phase 3.22.7: Restraint Pass — presence, not display
//
// A very faint silhouette layer behind home content:
// - Opacity: 0.06 max (felt, not seen)
// - Moves only with scroll (no independent animation)
// - Respects Reduce Motion setting
//
// "They're there. They don't move unless you do."

import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
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
 * SanctumSilhouette — ambient depth layer
 * 
 * Creates a subtle visual depth behind home content.
 * Moves slightly with scroll to create parallax effect.
 */
export function SanctumSilhouette({ scrollY, reduceMotion = false }: Props) {
  const { height: screenHeight } = useWindowDimensions();
  
  // Parallax animation style — scroll only, no independent animation
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {}; // Static when reduced motion is enabled
    }
    
    // TranslateY: 0 → -8px max (restrained from -12px)
    const translateY = interpolate(
      scrollY.value,
      [0, screenHeight * 0.5],
      [0, SILHOUETTE.maxTranslateY],
      Extrapolation.CLAMP
    );
    
    // Scale: 1.00 → 1.015 (restrained from 1.02)
    const scale = interpolate(
      scrollY.value,
      [0, screenHeight * 0.5],
      SILHOUETTE.scaleRange,
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
