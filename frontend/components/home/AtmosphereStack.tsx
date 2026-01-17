// /app/frontend/components/home/AtmosphereStack.tsx
// Phase 3.23.8: Atmosphere Stack for Sanctuary Depth
//
// Five layers that create mountaintop sanctuary feel:
// 1. Vignette (corners) - frame, not crush
// 2. Top haze (HUD veil) - mist, not curtain
// 3. Drifting fog band (slow horizontal drift) - in the air
// 4. Bottom mist shelf (above tab bar) - support dock
// 5. Focal lift (gold glow near dock)
//
// All layers are pointerEvents="none" - pure overlay.
// Respects Reduce Motion accessibility setting.
//
// "Depth is created with overlays, not extra UI."

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, AccessibilityInfo, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../../theme/colors';

type AtmosphereStackProps = {
  topHaze?: boolean;
  vignette?: boolean;
  bottomMist?: boolean;
  driftingFog?: boolean;
};

// Fog band configuration
const FOG_CONFIG = {
  height: 200,           // Height of fog band (was 140)
  topPosition: '35%',    // Position from top
  duration: 22000,       // 22 seconds for full drift cycle
  translateRange: 80,    // Pixels to translate left/right
  opacity: 0.045,        // Very low opacity
};

export function AtmosphereStack({
  topHaze = true,
  vignette = true,
  bottomMist = true,
  driftingFog = true,
}: AtmosphereStackProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const fogTranslateX = useRef(new Animated.Value(0)).current;
  
  // Check for reduce motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => subscription.remove();
  }, []);
  
  // Drifting fog animation
  useEffect(() => {
    if (!driftingFog || reduceMotion) {
      fogTranslateX.setValue(0);
      return;
    }
    
    // Create looping animation: left -> right -> left
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(fogTranslateX, {
          toValue: FOG_CONFIG.translateRange,
          duration: FOG_CONFIG.duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(fogTranslateX, {
          toValue: -FOG_CONFIG.translateRange,
          duration: FOG_CONFIG.duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    
    animation.start();
    
    return () => animation.stop();
  }, [driftingFog, reduceMotion, fogTranslateX]);
  
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Layer 1 (zIndex 0): Vignette corners - frame, not crush */}
      {vignette && (
        <>
          <LinearGradient
            colors={['rgba(8,12,20,0.26)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteTopLeft}
          />
          <LinearGradient
            colors={['rgba(8,12,20,0.26)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteTopRight}
          />
          <LinearGradient
            colors={['rgba(8,12,20,0.18)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteBottomLeft}
          />
          <LinearGradient
            colors={['rgba(8,12,20,0.18)', 'transparent']}
            start={{ x: 1, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteBottomRight}
          />
        </>
      )}
      
      {/* Layer 2 (zIndex 1): Top haze - mist, not curtain */}
      {topHaze && (
        <LinearGradient
          colors={[
            'rgba(12,16,28,0.38)',
            'rgba(12,16,28,0.22)',
            'rgba(12,16,28,0.08)',
            'transparent',
          ]}
          locations={[0, 0.25, 0.55, 1]}
          style={styles.topHaze}
        />
      )}
      
      {/* Layer 3 (zIndex 2): Drifting fog band - in the air, above haze */}
      {driftingFog && (
        <Animated.View
          style={[
            styles.driftingFog,
            {
              transform: [{ translateX: fogTranslateX }],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'transparent',
              `rgba(255,255,255,${FOG_CONFIG.opacity * 0.5})`,
              `rgba(255,255,255,${FOG_CONFIG.opacity})`,
              `rgba(255,255,255,${FOG_CONFIG.opacity * 0.5})`,
              'transparent',
            ]}
            locations={[0, 0.15, 0.5, 0.85, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.driftingFogGradient}
          />
        </Animated.View>
      )}
      
      {/* Layer 4 (zIndex 3): Bottom mist shelf - support dock, not sit on it */}
      {bottomMist && (
        <LinearGradient
          colors={[
            'transparent',
            'rgba(12,16,28,0.04)',
            'rgba(12,16,28,0.14)',
            'rgba(12,16,28,0.28)',
          ]}
          locations={[0, 0.4, 0.7, 1]}
          style={styles.bottomMist}
        />
      )}
      
      {/* Layer 5 (zIndex 4): Focal lift - warm gold glow near dock */}
      <LinearGradient
        colors={[
          'transparent',
          'transparent',
          `${COLORS.gold.primary}04`,
          `${COLORS.gold.primary}09`,
          'transparent',
        ]}
        locations={[0, 0.55, 0.72, 0.88, 1]}
        style={styles.focalLift}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Vignette corners - reduced coverage for framing
  vignetteTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '34%',
    zIndex: 0,
  },
  vignetteTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '34%',
    zIndex: 0,
  },
  vignetteBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '50%',
    height: '28%',
    zIndex: 0,
  },
  vignetteBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: '28%',
    zIndex: 0,
  },
  
  // Top haze (HUD veil) - taller for natural fade
  topHaze: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 210,
    zIndex: 1,
  },
  
  // Drifting fog band - above haze, in the air
  driftingFog: {
    position: 'absolute',
    top: FOG_CONFIG.topPosition as any,
    left: -100,
    right: -100,
    height: FOG_CONFIG.height,
    zIndex: 2,
  },
  driftingFogGradient: {
    flex: 1,
  },
  
  // Bottom mist shelf - wider for environment feel
  bottomMist: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 170,
    zIndex: 3,
  },
  
  // Focal lift (gold glow near dock)
  focalLift: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    zIndex: 4,
  },
});

export default AtmosphereStack;
