// /app/frontend/components/home/AtmosphereStack.tsx
// Phase 3.23.8: Atmosphere Stack for Sanctuary Depth
//
// Four layers that create mountaintop sanctuary feel:
// 1. Top haze (HUD veil)
// 2. Vignette (corners)
// 3. Bottom mist shelf (above tab bar)
// 4. Drifting fog band (slow horizontal drift)
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
  height: 140,           // Height of fog band
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
      {/* Layer 1: Vignette corners (darken edges for depth) */}
      {vignette && (
        <>
          <LinearGradient
            colors={['rgba(8,12,20,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteTopLeft}
          />
          <LinearGradient
            colors={['rgba(8,12,20,0.55)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteTopRight}
          />
          <LinearGradient
            colors={['rgba(8,12,20,0.45)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteBottomLeft}
          />
          <LinearGradient
            colors={['rgba(8,12,20,0.45)', 'transparent']}
            start={{ x: 1, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteBottomRight}
          />
        </>
      )}
      
      {/* Layer 2: Top haze (HUD veil - makes HUD float in mist) */}
      {topHaze && (
        <LinearGradient
          colors={[
            'rgba(12,16,28,0.72)',
            'rgba(12,16,28,0.45)',
            'rgba(12,16,28,0.15)',
            'transparent',
          ]}
          locations={[0, 0.25, 0.55, 1]}
          style={styles.topHaze}
        />
      )}
      
      {/* Layer 3: Bottom mist shelf (above tab bar) */}
      {bottomMist && (
        <LinearGradient
          colors={[
            'transparent',
            'rgba(12,16,28,0.06)',
            'rgba(12,16,28,0.22)',
            'rgba(12,16,28,0.50)',
          ]}
          locations={[0, 0.4, 0.7, 1]}
          style={styles.bottomMist}
        />
      )}
      
      {/* Layer 4: Drifting fog band (slow horizontal drift) */}
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
              `rgba(255,255,255,${FOG_CONFIG.opacity * 0.6})`,
              `rgba(255,255,255,${FOG_CONFIG.opacity})`,
              `rgba(255,255,255,${FOG_CONFIG.opacity * 0.6})`,
              'transparent',
            ]}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.driftingFogGradient}
          />
        </Animated.View>
      )}
      
      {/* Layer 5: Focal lift (warm gold glow near dock) */}
      <LinearGradient
        colors={[
          'transparent',
          'transparent',
          `${COLORS.gold.primary}05`,
          `${COLORS.gold.primary}0A`,
          'transparent',
        ]}
        locations={[0, 0.55, 0.72, 0.88, 1]}
        style={styles.focalLift}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Vignette corners
  vignetteTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '40%',
  },
  vignetteTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '40%',
  },
  vignetteBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '50%',
    height: '35%',
  },
  vignetteBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: '35%',
  },
  
  // Top haze (HUD veil)
  topHaze: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 1,
  },
  
  // Bottom mist shelf
  bottomMist: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 1,
  },
  
  // Drifting fog band
  driftingFog: {
    position: 'absolute',
    top: FOG_CONFIG.topPosition as any,
    left: -100, // Extend beyond screen for smooth drift
    right: -100,
    height: FOG_CONFIG.height,
    zIndex: 0,
  },
  driftingFogGradient: {
    flex: 1,
  },
  
  // Focal lift (gold glow near dock)
  focalLift: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    zIndex: 2,
  },
});

export default AtmosphereStack;
