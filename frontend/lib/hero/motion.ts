// /app/frontend/lib/hero/motion.ts
// Phase 3.25: Hero Stage Motion v1
//
// Tier-gated "alive" feeling for heroes.
// Uses ONLY Reanimated worklets - NO timers, setInterval, or RAF.
//
// LOCKED VALUES - Single source of truth for motion parameters.
// "Motion that makes heroes feel present, not distracting."

import { useEffect, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

// =============================================================================
// MOTION TIER DEFINITIONS (LOCKED VALUES - DO NOT DUPLICATE)
// =============================================================================

export type MotionTier = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Motion parameters per tier (SINGLE SOURCE OF TRUTH)
 * 
 * | Tier | breathingScale | swayX | swayY | bobY | rotateZ |
 * |------|----------------|-------|-------|------|---------|
 * | 0    | 0              | 0     | 0     | 0    | 0       |
 * | 1    | 0              | 0     | 0     | 0    | 0       |
 * | 2    | 0.006          | 0     | 0     | 0.8  | 0       |
 * | 3    | 0.010          | 1.2   | 0.6   | 1.4  | 0.002   |
 * | 4    | 0.013          | 1.8   | 1.0   | 2.0  | 0.003   |
 * | 5    | 0.016          | 2.4   | 1.4   | 2.6  | 0.004   |
 */
export interface MotionParams {
  /** Scale delta for breathing (e.g., 0.010 = +1.0%) */
  breathingScale: number;
  /** Horizontal sway in px */
  swayX: number;
  /** Vertical sway in px */
  swayY: number;
  /** Vertical bob in px */
  bobY: number;
  /** Rotation in radians */
  rotateZ: number;
}

export const MOTION_PARAMS: Record<MotionTier, MotionParams> = {
  0: { breathingScale: 0, swayX: 0, swayY: 0, bobY: 0, rotateZ: 0 },
  1: { breathingScale: 0, swayX: 0, swayY: 0, bobY: 0, rotateZ: 0 },
  2: { breathingScale: 0.006, swayX: 0, swayY: 0, bobY: 0.8, rotateZ: 0 },
  3: { breathingScale: 0.010, swayX: 1.2, swayY: 0.6, bobY: 1.4, rotateZ: 0.002 },
  4: { breathingScale: 0.013, swayX: 1.8, swayY: 1.0, bobY: 2.0, rotateZ: 0.003 },
  5: { breathingScale: 0.016, swayX: 2.4, swayY: 1.4, bobY: 2.6, rotateZ: 0.004 },
};

// Animation timing (ms)
const BREATHING_DURATION = 3200;
const SWAY_DURATION = 4800;
const BOB_DURATION = 3600;

// =============================================================================
// HERO DATA ID RESOLUTION (ALIAS-AWARE)
// =============================================================================

/**
 * Extract heroDataId from hero data object
 */
export function getHeroDataId(heroData: any): string | undefined {
  if (!heroData) return undefined;
  // Try common field names
  return heroData.id || heroData.heroDataId || heroData.hero_data_id || heroData.dataId;
}

/**
 * Alias map for hero motion specs
 * Maps various ID formats to canonical heroDataId
 */
const HERO_ID_ALIASES: Record<string, string> = {
  'selene': 'char_selene_ssr',
  'selene_ssr': 'char_selene_ssr',
  'char_selene': 'char_selene_ssr',
};

/**
 * Resolve heroDataId with alias support
 */
export function resolveHeroDataId(rawId: string | undefined): string | undefined {
  if (!rawId) return undefined;
  return HERO_ID_ALIASES[rawId.toLowerCase()] || rawId;
}

// =============================================================================
// MOTION SPEC REGISTRY
// =============================================================================

export interface HeroMotionSpec {
  heroDataId: string;
  /** Multiplier for motion intensity (default 1.0) */
  intensityMultiplier: number;
  /** Design notes for this hero's motion */
  notes: string[];
  /** Safe zones where UI should not overlap */
  safeZones: {
    face?: { top: string; height: string };
    body?: { top: string; height: string };
  };
}

/**
 * Motion specs per hero (for special handling)
 */
const HERO_MOTION_SPECS: Record<string, HeroMotionSpec> = {
  'char_selene_ssr': {
    heroDataId: 'char_selene_ssr',
    intensityMultiplier: 1.1, // Selene gets premium feel
    notes: [
      'Selene is the signature hero - motion should feel premium',
      'Breathing should feel natural, not mechanical',
      'Sway suggests confidence, not nervousness',
      'Camera intimacy at tier 4+ should frame face/eyes',
      'Never explicit - always tasteful and store-safe',
    ],
    safeZones: {
      face: { top: '10%', height: '25%' },
      body: { top: '35%', height: '40%' },
    },
  },
};

/**
 * Get motion spec for a hero (alias-aware)
 */
export function getHeroMotionSpecByHeroDataId(heroDataId: string | undefined): HeroMotionSpec | undefined {
  if (!heroDataId) return undefined;
  const resolvedId = resolveHeroDataId(heroDataId);
  return resolvedId ? HERO_MOTION_SPECS[resolvedId] : undefined;
}

// =============================================================================
// MOTION TIER RESOLUTION
// =============================================================================

/**
 * Affinity thresholds for each tier (SINGLE SOURCE OF TRUTH)
 * UI should read from this table, not hardcode thresholds
 */
export const TIER_THRESHOLDS: Record<MotionTier, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

/**
 * Human-readable tier info for UI display
 */
export interface TierInfo {
  tier: MotionTier;
  affinityRequired: number;
  cameraLabel: string;
  motionLabel: string;
  parallaxLabel: string;
  unlockSummary: string;
}

/**
 * Get tier display info for UI (SINGLE SOURCE OF TRUTH)
 */
export function getTierInfo(tier: MotionTier): TierInfo {
  const info: Record<MotionTier, TierInfo> = {
    0: {
      tier: 0,
      affinityRequired: 0,
      cameraLabel: 'Distant',
      motionLabel: 'None',
      parallaxLabel: 'None',
      unlockSummary: 'Base presentation',
    },
    1: {
      tier: 1,
      affinityRequired: 1,
      cameraLabel: 'Distant',
      motionLabel: 'None',
      parallaxLabel: 'None',
      unlockSummary: 'Recognition begins',
    },
    2: {
      tier: 2,
      affinityRequired: 2,
      cameraLabel: 'Standard',
      motionLabel: 'Breath',
      parallaxLabel: 'Shelf I',
      unlockSummary: 'Breath animation unlocked',
    },
    3: {
      tier: 3,
      affinityRequired: 3,
      cameraLabel: 'Standard',
      motionLabel: 'Breath + Micro-sway',
      parallaxLabel: 'Shelf I + Veil',
      unlockSummary: 'Micro-sway added',
    },
    4: {
      tier: 4,
      affinityRequired: 4,
      cameraLabel: 'Intimate',
      motionLabel: 'Breath + Sway + Bob',
      parallaxLabel: 'Shelf II + Halo',
      unlockSummary: 'Intimate framing unlocked',
    },
    5: {
      tier: 5,
      affinityRequired: 5,
      cameraLabel: 'Intimate',
      motionLabel: 'Full presence',
      parallaxLabel: 'Shelf II + Halo + Rim',
      unlockSummary: 'Full presence achieved',
    },
  };
  return info[tier];
}

/**
 * Get full tier table for UI display (ladder panel)
 */
export function getTierTable(): TierInfo[] {
  return [0, 1, 2, 3, 4, 5].map(t => getTierInfo(t as MotionTier));
}

/**
 * Resolve motion tier from affinity level
 * Higher affinity = more motion
 */
export function resolveMotionTier(affinityLevel: number = 0): MotionTier {
  if (affinityLevel >= TIER_THRESHOLDS[5]) return 5;
  if (affinityLevel >= TIER_THRESHOLDS[4]) return 4;
  if (affinityLevel >= TIER_THRESHOLDS[3]) return 3;
  if (affinityLevel >= TIER_THRESHOLDS[2]) return 2;
  if (affinityLevel >= TIER_THRESHOLDS[1]) return 1;
  return 0;
}

/**
 * Get next tier info (for "Next unlock at..." UI)
 */
export function getNextTierInfo(currentTier: MotionTier): TierInfo | null {
  if (currentTier >= 5) return null;
  return getTierInfo((currentTier + 1) as MotionTier);
}

/**
 * Get motion params for a given tier
 */
export function getMotionParams(tier: MotionTier): MotionParams {
  return MOTION_PARAMS[tier];
}

// =============================================================================
// STAGE CONFIG DERIVATION
// =============================================================================

export type CameraMode = 'standard' | 'intimate';

export interface HeroStageConfig {
  heroDataId: string | undefined;
  motionSpecId: string | undefined;
  tier: MotionTier;
  cameraMode: CameraMode;
  motionParams: MotionParams;
  intensityMultiplier: number;
  safeZones: HeroMotionSpec['safeZones'];
  reduceMotion: boolean;
}

/**
 * Derive full hero stage config from hero data and affinity
 */
export function deriveHeroStageConfig(opts: {
  heroData: any;
  affinityLevel: number;
  reduceMotion?: boolean;
}): HeroStageConfig {
  const { heroData, affinityLevel, reduceMotion = false } = opts;
  
  const heroDataId = getHeroDataId(heroData);
  const resolvedId = resolveHeroDataId(heroDataId);
  const motionSpec = getHeroMotionSpecByHeroDataId(resolvedId);
  
  const tier = resolveMotionTier(affinityLevel);
  const cameraMode: CameraMode = tier >= 4 ? 'intimate' : 'standard';
  const motionParams = getMotionParams(tier);
  
  return {
    heroDataId: resolvedId,
    motionSpecId: motionSpec?.heroDataId,
    tier,
    cameraMode,
    motionParams,
    intensityMultiplier: motionSpec?.intensityMultiplier ?? 1.0,
    safeZones: motionSpec?.safeZones ?? {},
    reduceMotion,
  };
}

// =============================================================================
// REANIMATED MOTION HOOK (NO TIMERS - WORKLETS ONLY)
// =============================================================================

/**
 * Hook that provides animated styles for hero idle motion.
 * Uses ONLY Reanimated worklets - NO timers, setInterval, or RAF.
 *
 * @param stageConfig - Config from deriveHeroStageConfig
 */
export function useHeroIdleMotion(stageConfig: HeroStageConfig) {
  const { tier, motionParams, intensityMultiplier, reduceMotion } = stageConfig;
  
  // Shared values for animations (all driven by Reanimated)
  const breathingProgress = useSharedValue(0);
  const swayProgress = useSharedValue(0);
  const bobProgress = useSharedValue(0);
  
  // Apply intensity multiplier to params
  const scaledParams = useMemo(() => ({
    breathingScale: motionParams.breathingScale * intensityMultiplier,
    swayX: motionParams.swayX * intensityMultiplier,
    swayY: motionParams.swayY * intensityMultiplier,
    bobY: motionParams.bobY * intensityMultiplier,
    rotateZ: motionParams.rotateZ * intensityMultiplier,
  }), [motionParams, intensityMultiplier]);
  
  const hasMotion = tier >= 2 && !reduceMotion;
  
  // Start/stop animations based on config
  useEffect(() => {
    if (!hasMotion) {
      // Reset to identity
      breathingProgress.value = 0;
      swayProgress.value = 0;
      bobProgress.value = 0;
      return;
    }
    
    // Breathing animation (scale oscillation)
    if (scaledParams.breathingScale > 0) {
      breathingProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: BREATHING_DURATION / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: BREATHING_DURATION / 2, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    }
    
    // Sway animation (X/Y oscillation with slight offset)
    if (scaledParams.swayX > 0 || scaledParams.swayY > 0) {
      swayProgress.value = withDelay(
        200,
        withRepeat(
          withSequence(
            withTiming(1, { duration: SWAY_DURATION / 2, easing: Easing.inOut(Easing.sin) }),
            withTiming(-1, { duration: SWAY_DURATION / 2, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        )
      );
    }
    
    // Bob animation (Y oscillation, different timing)
    if (scaledParams.bobY > 0) {
      bobProgress.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(1, { duration: BOB_DURATION / 2, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: BOB_DURATION / 2, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        )
      );
    }
  }, [hasMotion, scaledParams]);
  
  // Animated style (UI thread only via worklet)
  const animatedStyle = useAnimatedStyle(() => {
    if (!hasMotion) {
      return { transform: [] };
    }
    
    const scale = 1 + breathingProgress.value * scaledParams.breathingScale;
    const translateX = swayProgress.value * scaledParams.swayX;
    const translateY = (swayProgress.value * scaledParams.swayY) + (bobProgress.value * scaledParams.bobY);
    const rotate = `${swayProgress.value * scaledParams.rotateZ}rad`;
    
    return {
      transform: [
        { scale },
        { translateX },
        { translateY },
        { rotate },
      ],
    };
  }, [hasMotion, scaledParams]);
  
  return {
    animatedStyle,
    tier,
    isAnimating: hasMotion,
  };
}

/**
 * Get motion transform style without hook (for static usage)
 * Returns identity transform if reduce motion or tier < 2
 */
export function getHeroIdleMotionStyle(
  tier: MotionTier,
  reduceMotion: boolean,
  intensityMultiplier: number = 1.0
): { transform: any[] } {
  if (reduceMotion || tier < 2) {
    return { transform: [] };
  }
  // For static usage, return identity - actual animation via hook
  return { transform: [] };
}

// =============================================================================
// DEV LOGGING
// =============================================================================

/**
 * Log hero stage config (DEV only, call once on mount)
 */
export function logHeroStageConfig(config: HeroStageConfig): void {
  if (__DEV__) {
    console.log('[HeroStage] Config:', {
      heroDataId: config.heroDataId,
      motionSpecId: config.motionSpecId,
      tier: config.tier,
      cameraMode: config.cameraMode,
      reduceMotion: config.reduceMotion,
      safeZones: config.safeZones,
    });
  }
}
