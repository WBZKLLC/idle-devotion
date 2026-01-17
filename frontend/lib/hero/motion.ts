// /app/frontend/lib/hero/motion.ts
// Phase 3.25: Hero Stage Motion v1
//
// Tier-gated "alive" feeling for heroes.
// Uses ONLY Reanimated worklets - NO timers, setInterval, or RAF.
//
// Motion Tiers:
// - Tier 0-1: Static (no motion)
// - Tier 2-3: Micro breathing/sway (very subtle)
// - Tier 4-5: Richer breathing + camera intimacy offset
//
// "Motion that makes heroes feel present, not distracting."

import { useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';

// =============================================================================
// MOTION TIER DEFINITIONS
// =============================================================================

export type MotionTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface MotionTierConfig {
  /** Enable breathing animation */
  breathing: boolean;
  /** Breathing scale amplitude (0 = none) */
  breathingAmplitude: number;
  /** Breathing cycle duration in ms */
  breathingDuration: number;
  
  /** Enable sway animation */
  sway: boolean;
  /** Sway translate amplitude in pixels */
  swayAmplitude: number;
  /** Sway cycle duration in ms */
  swayDuration: number;
  
  /** Enable subtle rotation */
  rotation: boolean;
  /** Rotation amplitude in degrees */
  rotationAmplitude: number;
  
  /** Camera intimacy offset (for tier 4-5) */
  cameraIntimacyOffset: {
    scale: number;
    translateY: number;
  };
}

/**
 * Motion tier configurations (locked)
 * Tier 0-1: Static
 * Tier 2-3: Subtle breathing + minimal sway
 * Tier 4-5: Richer breathing + sway + camera offset
 */
export const MOTION_TIERS: Record<MotionTier, MotionTierConfig> = {
  // Tier 0: No motion (default/locked)
  0: {
    breathing: false,
    breathingAmplitude: 0,
    breathingDuration: 0,
    sway: false,
    swayAmplitude: 0,
    swayDuration: 0,
    rotation: false,
    rotationAmplitude: 0,
    cameraIntimacyOffset: { scale: 0, translateY: 0 },
  },
  
  // Tier 1: Still no motion (early unlock)
  1: {
    breathing: false,
    breathingAmplitude: 0,
    breathingDuration: 0,
    sway: false,
    swayAmplitude: 0,
    swayDuration: 0,
    rotation: false,
    rotationAmplitude: 0,
    cameraIntimacyOffset: { scale: 0, translateY: 0 },
  },
  
  // Tier 2: Micro breathing (very subtle)
  2: {
    breathing: true,
    breathingAmplitude: 0.008, // 0.8% scale
    breathingDuration: 3500,   // 3.5s cycle
    sway: false,
    swayAmplitude: 0,
    swayDuration: 0,
    rotation: false,
    rotationAmplitude: 0,
    cameraIntimacyOffset: { scale: 0, translateY: 0 },
  },
  
  // Tier 3: Breathing + micro sway
  3: {
    breathing: true,
    breathingAmplitude: 0.012, // 1.2% scale
    breathingDuration: 3200,   // 3.2s cycle
    sway: true,
    swayAmplitude: 2,          // 2px sway
    swayDuration: 5000,        // 5s cycle
    rotation: false,
    rotationAmplitude: 0,
    cameraIntimacyOffset: { scale: 0, translateY: 0 },
  },
  
  // Tier 4: Richer breathing + sway + subtle camera
  4: {
    breathing: true,
    breathingAmplitude: 0.015, // 1.5% scale
    breathingDuration: 3000,   // 3s cycle
    sway: true,
    swayAmplitude: 3,          // 3px sway
    swayDuration: 4500,        // 4.5s cycle
    rotation: true,
    rotationAmplitude: 0.3,    // 0.3 degrees
    cameraIntimacyOffset: { scale: 0.02, translateY: 6 },
  },
  
  // Tier 5: Full presence (still tasteful)
  5: {
    breathing: true,
    breathingAmplitude: 0.018, // 1.8% scale
    breathingDuration: 2800,   // 2.8s cycle
    sway: true,
    swayAmplitude: 4,          // 4px sway
    swayDuration: 4000,        // 4s cycle
    rotation: true,
    rotationAmplitude: 0.5,    // 0.5 degrees
    cameraIntimacyOffset: { scale: 0.04, translateY: 10 },
  },
};

// =============================================================================
// MOTION TIER RESOLUTION
// =============================================================================

/**
 * Resolve motion tier from affinity level
 * Higher affinity = more motion
 */
export function resolveMotionTier(affinityLevel: number = 0): MotionTier {
  if (affinityLevel >= 5) return 5;
  if (affinityLevel >= 4) return 4;
  if (affinityLevel >= 3) return 3;
  if (affinityLevel >= 2) return 2;
  if (affinityLevel >= 1) return 1;
  return 0;
}

/**
 * Get motion config for a given tier
 */
export function getMotionConfig(tier: MotionTier): MotionTierConfig {
  return MOTION_TIERS[tier];
}

/**
 * Derive full hero stage config from affinity level
 * Combines camera + motion settings
 */
export function deriveHeroStageConfig(affinityLevel: number = 0) {
  const motionTier = resolveMotionTier(affinityLevel);
  const motionConfig = getMotionConfig(motionTier);
  
  return {
    motionTier,
    motionConfig,
    cameraMode: motionTier >= 4 ? 'intimate' as const : 'standard' as const,
    affinityLevel,
  };
}

// =============================================================================
// REANIMATED MOTION HOOK (NO TIMERS)
// =============================================================================

/**
 * Hook that provides animated styles for hero idle motion.
 * Uses ONLY Reanimated worklets - no timers, setInterval, or RAF.
 *
 * @param affinityLevel - Hero's affinity level (determines motion tier)
 * @param reduceMotion - Whether to disable motion for accessibility
 */
export function useHeroIdleMotion(affinityLevel: number = 0, reduceMotion: boolean = false) {
  const motionTier = resolveMotionTier(affinityLevel);
  const config = getMotionConfig(motionTier);
  
  // Shared values for animations
  const breathingProgress = useSharedValue(0);
  const swayProgress = useSharedValue(0);
  const rotationProgress = useSharedValue(0);
  
  // Start/restart animations when config changes
  useEffect(() => {
    if (reduceMotion) {
      // Reset to static
      breathingProgress.value = 0;
      swayProgress.value = 0;
      rotationProgress.value = 0;
      return;
    }
    
    // Breathing animation (if enabled)
    if (config.breathing && config.breathingDuration > 0) {
      breathingProgress.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: config.breathingDuration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: config.breathingDuration / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1, // Infinite repeat
        false // Don't reverse
      );
    } else {
      breathingProgress.value = 0;
    }
    
    // Sway animation (if enabled, with offset to avoid sync with breathing)
    if (config.sway && config.swayDuration > 0) {
      swayProgress.value = withDelay(
        300, // Slight offset from breathing
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: config.swayDuration / 2,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(-1, {
              duration: config.swayDuration / 2,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        )
      );
    } else {
      swayProgress.value = 0;
    }
    
    // Rotation animation (if enabled)
    if (config.rotation && config.rotationAmplitude > 0) {
      rotationProgress.value = withDelay(
        600, // Different offset
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: config.swayDuration * 0.8,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(-1, {
              duration: config.swayDuration * 0.8,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        )
      );
    } else {
      rotationProgress.value = 0;
    }
  }, [config, reduceMotion]);
  
  // Animated style for hero container
  const animatedStyle = useAnimatedStyle(() => {
    const breathingScale = config.breathing
      ? 1 + breathingProgress.value * config.breathingAmplitude
      : 1;
    
    const swayX = config.sway
      ? swayProgress.value * config.swayAmplitude
      : 0;
    
    const rotation = config.rotation
      ? `${rotationProgress.value * config.rotationAmplitude}deg`
      : '0deg';
    
    // Camera intimacy offset (additive to base camera)
    const intimacyScale = 1 + config.cameraIntimacyOffset.scale;
    const intimacyY = config.cameraIntimacyOffset.translateY;
    
    return {
      transform: [
        { scale: breathingScale * intimacyScale },
        { translateX: swayX },
        { translateY: intimacyY },
        { rotate: rotation },
      ],
    };
  }, [config]);
  
  return {
    animatedStyle,
    motionTier,
    config,
    isAnimating: !reduceMotion && motionTier >= 2,
  };
}

// =============================================================================
// SELENE SPEC INTEGRATION
// =============================================================================

/**
 * Selene-specific motion notes
 * Used when heroDataId === 'char_selene_ssr'
 */
export const SELENE_MOTION_SPEC = {
  heroDataId: 'char_selene_ssr',
  notes: [
    'Selene is the signature hero - motion should feel premium',
    'Breathing should feel natural, not mechanical',
    'Sway suggests confidence, not nervousness',
    'Camera intimacy at tier 4+ should frame face/eyes',
    'Never explicit - always tasteful and store-safe',
  ],
  safeZones: {
    // Areas where UI should not overlap
    faceRegion: { top: '10%', height: '25%' },
    bodyCenter: { top: '35%', height: '40%' },
  },
  // Selene gets slightly enhanced motion at same tier
  motionMultiplier: 1.1,
};

/**
 * Check if a hero is Selene (for special handling)
 */
export function isSeleneHero(heroDataId: string | undefined): boolean {
  return heroDataId === 'char_selene_ssr' || heroDataId === 'selene';
}

/**
 * Get motion config with Selene adjustments if applicable
 */
export function getSeleneAdjustedConfig(
  heroDataId: string | undefined,
  baseConfig: MotionTierConfig
): MotionTierConfig {
  if (!isSeleneHero(heroDataId)) return baseConfig;
  
  const mult = SELENE_MOTION_SPEC.motionMultiplier;
  
  return {
    ...baseConfig,
    breathingAmplitude: baseConfig.breathingAmplitude * mult,
    swayAmplitude: baseConfig.swayAmplitude * mult,
    rotationAmplitude: baseConfig.rotationAmplitude * mult,
  };
}
