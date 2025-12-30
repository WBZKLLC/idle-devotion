import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Image, ImageSourcePropType } from 'react-native';

interface JigglePhysicsConfig {
  // Per-region configuration
  chest?: {
    enabled: boolean;
    stiffness: number;      // 100-180 recommended
    damping: number;        // 12-22 recommended
    maxOffset: number;      // 0.04-0.08 meters (scaled to pixels)
    gravityInfluence: number; // 0.3-0.6
  };
  abdomen?: {
    enabled: boolean;
    stiffness: number;
    damping: number;
    maxOffset: number;
    gravityInfluence: number;
  };
  groin?: {
    enabled: boolean;
    stiffness: number;      // 160-300 (stiffer, smaller motion)
    damping: number;
    maxOffset: number;      // 0.02-0.05 (smaller)
    gravityInfluence: number;
  };
  thighs?: {
    enabled: boolean;
    stiffness: number;      // 80-160
    damping: number;
    maxOffset: number;
    gravityInfluence: number;
  };
}

interface JiggleCharacterProps {
  source: ImageSourcePropType;
  width: number;
  height: number;
  config?: JigglePhysicsConfig;
  animationSpeed?: 'idle' | 'walk' | 'action';
  style?: any;
}

// Default mobile-optimized configuration
const DEFAULT_CONFIG: JigglePhysicsConfig = {
  chest: {
    enabled: true,
    stiffness: 140,
    damping: 18,
    maxOffset: 4, // pixels
    gravityInfluence: 0.5,
  },
  abdomen: {
    enabled: true,
    stiffness: 160,
    damping: 20,
    maxOffset: 3,
    gravityInfluence: 0.4,
  },
  groin: {
    enabled: true,
    stiffness: 200,
    damping: 22,
    maxOffset: 2,
    gravityInfluence: 0.3,
  },
  thighs: {
    enabled: true,
    stiffness: 120,
    damping: 16,
    maxOffset: 3,
    gravityInfluence: 0.4,
  },
};

// Animation timing based on speed
const getAnimationTiming = (speed: string) => {
  switch (speed) {
    case 'walk': return { duration: 600, delay: 0 };
    case 'action': return { duration: 300, delay: 0 };
    default: return { duration: 2000, delay: 500 }; // idle - subtle breathing
  }
};

export const JiggleCharacter: React.FC<JiggleCharacterProps> = ({
  source,
  width,
  height,
  config = DEFAULT_CONFIG,
  animationSpeed = 'idle',
  style,
}) => {
  // Animation values for each body region
  const chestAnim = useRef(new Animated.Value(0)).current;
  const abdomenAnim = useRef(new Animated.Value(0)).current;
  const groinAnim = useRef(new Animated.Value(0)).current;
  const thighsAnim = useRef(new Animated.Value(0)).current;
  
  // Secondary motion (subtle side-to-side)
  const swayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timing = getAnimationTiming(animationSpeed);
    
    // Create spring-based jiggle animation
    const createJiggleAnimation = (
      animValue: Animated.Value,
      regionConfig: typeof DEFAULT_CONFIG.chest,
      phaseOffset: number = 0
    ) => {
      if (!regionConfig?.enabled) return Animated.delay(0);
      
      const maxOffset = regionConfig.maxOffset;
      const stiffnessFactor = 1 - (regionConfig.stiffness - 100) / 200; // Normalize stiffness
      const duration = timing.duration * (1 + stiffnessFactor * 0.3);
      
      return Animated.loop(
        Animated.sequence([
          Animated.delay(phaseOffset),
          Animated.timing(animValue, {
            toValue: maxOffset * regionConfig.gravityInfluence,
            duration: duration * 0.5,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: -maxOffset * 0.3,
            duration: duration * 0.3,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration * 0.2,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Create subtle sway animation
    const swayAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(swayAnim, {
          toValue: 1,
          duration: timing.duration * 1.5,
          useNativeDriver: true,
        }),
        Animated.timing(swayAnim, {
          toValue: -1,
          duration: timing.duration * 1.5,
          useNativeDriver: true,
        }),
      ])
    );

    // Start all animations with phase offsets for natural motion
    const animations = Animated.parallel([
      createJiggleAnimation(chestAnim, config.chest, 0),
      createJiggleAnimation(abdomenAnim, config.abdomen, 100),
      createJiggleAnimation(groinAnim, config.groin, 200),
      createJiggleAnimation(thighsAnim, config.thighs, 150),
      swayAnimation,
    ]);

    animations.start();

    return () => {
      animations.stop();
    };
  }, [animationSpeed, config]);

  // Calculate transform based on animations
  const chestTransform = chestAnim.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: [0.98, 1, 1.02],
  });

  const abdomenTransform = abdomenAnim.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: [0.99, 1, 1.01],
  });

  const swayTransform = swayAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-1, 0, 1],
  });

  return (
    <View style={[styles.container, { width, height }, style]}>
      {/* Main character image with subtle overall motion */}
      <Animated.View
        style={[
          styles.characterContainer,
          {
            transform: [
              { translateX: swayTransform },
              { scaleY: chestTransform },
            ],
          },
        ]}
      >
        <Image
          source={source}
          style={[styles.characterImage, { width, height }]}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Overlay regions for localized effects (optional enhancement) */}
      {/* These would be separate image layers in a production game */}
    </View>
  );
};

// Preset configurations for different character types
export const JIGGLE_PRESETS = {
  // Muscular male - subtle chest/pec motion
  muscular: {
    chest: { enabled: true, stiffness: 160, damping: 20, maxOffset: 3, gravityInfluence: 0.4 },
    abdomen: { enabled: true, stiffness: 180, damping: 22, maxOffset: 2, gravityInfluence: 0.3 },
    groin: { enabled: true, stiffness: 220, damping: 24, maxOffset: 1.5, gravityInfluence: 0.2 },
    thighs: { enabled: true, stiffness: 140, damping: 18, maxOffset: 2.5, gravityInfluence: 0.35 },
  } as JigglePhysicsConfig,
  
  // Lean/athletic - very subtle motion
  athletic: {
    chest: { enabled: true, stiffness: 180, damping: 22, maxOffset: 2, gravityInfluence: 0.3 },
    abdomen: { enabled: true, stiffness: 200, damping: 24, maxOffset: 1.5, gravityInfluence: 0.2 },
    groin: { enabled: true, stiffness: 240, damping: 26, maxOffset: 1, gravityInfluence: 0.15 },
    thighs: { enabled: true, stiffness: 160, damping: 20, maxOffset: 2, gravityInfluence: 0.25 },
  } as JigglePhysicsConfig,
  
  // Larger/heavier build - more pronounced motion
  heavy: {
    chest: { enabled: true, stiffness: 120, damping: 16, maxOffset: 5, gravityInfluence: 0.6 },
    abdomen: { enabled: true, stiffness: 140, damping: 18, maxOffset: 4, gravityInfluence: 0.5 },
    groin: { enabled: true, stiffness: 180, damping: 20, maxOffset: 2.5, gravityInfluence: 0.35 },
    thighs: { enabled: true, stiffness: 100, damping: 14, maxOffset: 4, gravityInfluence: 0.5 },
  } as JigglePhysicsConfig,
  
  // Minimal/disabled for less fanservice
  minimal: {
    chest: { enabled: true, stiffness: 200, damping: 25, maxOffset: 1.5, gravityInfluence: 0.2 },
    abdomen: { enabled: false, stiffness: 200, damping: 25, maxOffset: 1, gravityInfluence: 0.1 },
    groin: { enabled: false, stiffness: 250, damping: 28, maxOffset: 0.5, gravityInfluence: 0.1 },
    thighs: { enabled: false, stiffness: 180, damping: 22, maxOffset: 1, gravityInfluence: 0.15 },
  } as JigglePhysicsConfig,
};

// Simple breathing animation for static poses
export const BreathingCharacter: React.FC<{
  source: ImageSourcePropType;
  width: number;
  height: number;
  intensity?: 'subtle' | 'normal' | 'heavy';
  style?: any;
}> = ({ source, width, height, intensity = 'normal', style }) => {
  const breathAnim = useRef(new Animated.Value(0)).current;

  const intensityConfig = {
    subtle: { scale: 0.005, duration: 3000 },
    normal: { scale: 0.01, duration: 2500 },
    heavy: { scale: 0.015, duration: 2000 },
  };

  const config = intensityConfig[intensity];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: config.duration,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: config.duration,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [intensity]);

  const scaleY = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1 + config.scale],
  });

  const translateY = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -height * config.scale * 0.5],
  });

  return (
    <Animated.View
      style={[
        { width, height },
        style,
        {
          transform: [
            { scaleY },
            { translateY },
          ],
        },
      ]}
    >
      <Image
        source={source}
        style={{ width, height }}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  characterContainer: {
    flex: 1,
  },
  characterImage: {
    flex: 1,
  },
});

export default JiggleCharacter;
