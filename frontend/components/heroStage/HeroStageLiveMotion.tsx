/**
 * Phase E3: Hero Stage Live2D-like Motion Component
 * 
 * Creates "alive" feel using:
 * - Layered parallax (background, midground, foreground)
 * - Subtle breathing/idle motion via Reanimated
 * - Blink simulation via opacity layers
 * 
 * NO Math.random, NO setInterval/RAF polling.
 * Respects Reduce Motion preference.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  ImageSourcePropType,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { track, Events } from '../../lib/telemetry/events';

export interface HeroStageLiveMotionProps {
  /** Whether reduce motion is enabled */
  reduceMotion: boolean;
  /** Motion intensity 0-1 (default 0.5) */
  intensity?: number;
  /** Hero portrait image source */
  heroSource?: ImageSourcePropType;
  /** Background layer source */
  backgroundSource?: ImageSourcePropType;
  /** Midground layer source (optional) */
  midgroundSource?: ImageSourcePropType;
  /** Foreground layer source (optional) */
  foregroundSource?: ImageSourcePropType;
  /** Children to render on top */
  children?: React.ReactNode;
}

// Default placeholder images
const DEFAULT_BG = require('../../assets/backgrounds/sanctum_environment_01.jpg');

export function HeroStageLiveMotion({
  reduceMotion,
  intensity = 0.5,
  heroSource,
  backgroundSource = DEFAULT_BG,
  midgroundSource,
  foregroundSource,
  children,
}: HeroStageLiveMotionProps) {
  const { width, height } = useWindowDimensions();
  const hasTrackedMount = useRef(false);
  
  // Animation shared values
  const breathingScale = useSharedValue(1);
  const breathingTranslateY = useSharedValue(0);
  const blinkOpacity = useSharedValue(1);
  const parallaxX = useSharedValue(0);
  const parallaxY = useSharedValue(0);
  
  // Clamp intensity
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  
  // Maximum motion values (scaled by intensity)
  const maxScale = 1 + (0.01 * clampedIntensity); // 1.0 -> 1.01
  const maxTranslateY = 2 * clampedIntensity; // 0 -> 2px
  const maxParallax = 8 * clampedIntensity; // 0 -> 8px
  
  // Telemetry: fire once on mount
  useEffect(() => {
    if (hasTrackedMount.current) return;
    hasTrackedMount.current = true;
    
    track(Events.HERO_STAGE_VIEWED, { reduceMotion, intensity: clampedIntensity });
    
    if (reduceMotion) {
      track(Events.HERO_STAGE_MOTION_DISABLED, {});
    } else {
      track(Events.HERO_STAGE_MOTION_ENABLED, { intensity: clampedIntensity });
    }
  }, [reduceMotion, clampedIntensity]);
  
  // Start animations (only if not reduce motion)
  useEffect(() => {
    if (reduceMotion) {
      // Reset to static values
      breathingScale.value = 1;
      breathingTranslateY.value = 0;
      blinkOpacity.value = 1;
      parallaxX.value = 0;
      parallaxY.value = 0;
      return;
    }
    
    // Breathing animation: slow scale 1.0 -> 1.01 -> 1.0 over 4s
    breathingScale.value = withRepeat(
      withSequence(
        withTiming(maxScale, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1, // infinite
      false // don't reverse
    );
    
    // Subtle Y translation: 0 -> -maxY -> 0 -> +maxY -> 0 over 6s
    breathingTranslateY.value = withRepeat(
      withSequence(
        withTiming(-maxTranslateY, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(maxTranslateY, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    
    // Blink simulation: subtle opacity dip every 5s
    blinkOpacity.value = withRepeat(
      withSequence(
        withDelay(
          4000,
          withSequence(
            withTiming(0.92, { duration: 100 }),
            withTiming(1, { duration: 150 })
          )
        )
      ),
      -1,
      false
    );
    
    // Subtle parallax drift (very slow)
    parallaxX.value = withRepeat(
      withSequence(
        withTiming(maxParallax, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-maxParallax, { duration: 8000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    
    parallaxY.value = withRepeat(
      withSequence(
        withTiming(maxParallax / 2, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-maxParallax / 2, { duration: 10000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    
    // Cleanup
    return () => {
      cancelAnimation(breathingScale);
      cancelAnimation(breathingTranslateY);
      cancelAnimation(blinkOpacity);
      cancelAnimation(parallaxX);
      cancelAnimation(parallaxY);
    };
  }, [reduceMotion, maxScale, maxTranslateY, maxParallax]);
  
  // Animated styles
  const backgroundStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: parallaxX.value * 0.3 },
      { translateY: parallaxY.value * 0.3 },
    ],
  }));
  
  const midgroundStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: parallaxX.value * 0.6 },
      { translateY: parallaxY.value * 0.6 },
    ],
  }));
  
  const foregroundStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: parallaxX.value },
      { translateY: parallaxY.value },
    ],
  }));
  
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: breathingScale.value },
      { translateY: breathingTranslateY.value },
    ],
    opacity: blinkOpacity.value,
  }));
  
  return (
    <View style={styles.container}>
      {/* Background layer (slowest parallax) */}
      <Animated.View style={[styles.layer, styles.backgroundLayer, backgroundStyle]}>
        <Image
          source={backgroundSource}
          style={styles.layerImage}
          resizeMode="cover"
        />
      </Animated.View>
      
      {/* Midground layer (optional) */}
      {midgroundSource && (
        <Animated.View style={[styles.layer, styles.midgroundLayer, midgroundStyle]}>
          <Image
            source={midgroundSource}
            style={styles.layerImage}
            resizeMode="cover"
          />
        </Animated.View>
      )}
      
      {/* Hero portrait layer (breathing + blink) */}
      {heroSource && (
        <Animated.View style={[styles.layer, styles.heroLayer, heroStyle]}>
          <Image
            source={heroSource}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </Animated.View>
      )}
      
      {/* Foreground layer (fastest parallax, optional) */}
      {foregroundSource && (
        <Animated.View style={[styles.layer, styles.foregroundLayer, foregroundStyle]}>
          <Image
            source={foregroundSource}
            style={styles.layerImage}
            resizeMode="cover"
          />
        </Animated.View>
      )}
      
      {/* Children (UI elements) */}
      {children && (
        <View style={styles.childrenContainer}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundLayer: {
    zIndex: 1,
  },
  midgroundLayer: {
    zIndex: 2,
  },
  heroLayer: {
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foregroundLayer: {
    zIndex: 4,
  },
  layerImage: {
    width: '110%',
    height: '110%',
    marginLeft: '-5%',
    marginTop: '-5%',
  },
  heroImage: {
    width: '90%',
    height: '90%',
  },
  childrenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});

export default HeroStageLiveMotion;
