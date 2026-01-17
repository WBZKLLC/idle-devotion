// /app/frontend/components/home/DivineOverlays.tsx
// Phase 3.23.8: Depth & Authority Pass
//
// Premium overlay effects that create depth without adding clutter.
// Makes the home screen feel like a scene, not a UI.
//
// "Depth is created with overlays, not extra UI."

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../../theme/colors';

type Props = {
  topHaze?: boolean;     // Haze gradient at top for HUD
  vignette?: boolean;    // Darken corners
  focalLift?: boolean;   // Warm lift near dock area
  grain?: boolean;       // Subtle film grain
};

/**
 * DivineOverlays — Creates cinematic depth on sanctuary scenes
 * 
 * Layer order (bottom to top):
 * 1. Vignette (darkens corners)
 * 2. Focal lift (warm glow near dock)
 * 3. Top haze (HUD sits in mist)
 * 4. Grain (film texture)
 */
export function DivineOverlays({ 
  topHaze = true, 
  vignette = true, 
  focalLift = true,
  grain = true,
}: Props) {
  return (
    <>
      {/* Vignette — darkens corners for depth */}
      {vignette && (
        <View style={styles.vignette} pointerEvents="none">
          {/* Top corners */}
          <LinearGradient
            colors={['rgba(8,10,18,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteCornerTL}
          />
          <LinearGradient
            colors={['rgba(8,10,18,0.6)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteCornerTR}
          />
          {/* Bottom corners */}
          <LinearGradient
            colors={['rgba(8,10,18,0.5)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteCornerBL}
          />
          <LinearGradient
            colors={['rgba(8,10,18,0.5)', 'transparent']}
            start={{ x: 1, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={styles.vignetteCornerBR}
          />
        </View>
      )}
      
      {/* Focal Lift — warm glow near dock area (candlelight) */}
      {focalLift && (
        <LinearGradient
          colors={['transparent', 'transparent', `${COLORS.gold.primary}08`, `${COLORS.gold.primary}12`, 'transparent']}
          locations={[0, 0.5, 0.7, 0.85, 1]}
          style={styles.focalLift}
          pointerEvents="none"
        />
      )}
      
      {/* Top Haze — HUD sits in atmospheric mist */}
      {topHaze && (
        <LinearGradient
          colors={[
            'rgba(12,16,28,0.75)',   // Warm ink at top
            'rgba(12,16,28,0.45)',
            'rgba(12,16,28,0.15)',
            'transparent',
          ]}
          locations={[0, 0.3, 0.6, 1]}
          style={styles.topHaze}
          pointerEvents="none"
        />
      )}
      
      {/* Grain — very subtle film texture */}
      {grain && (
        <View style={styles.grain} pointerEvents="none" />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  vignetteCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '40%',
  },
  vignetteCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '40%',
  },
  vignetteCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '50%',
    height: '35%',
  },
  vignetteCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: '35%',
  },
  
  focalLift: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    zIndex: 2,
  },
  
  topHaze: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 3,
  },
  
  grain: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: 'rgba(255,255,255,0.012)',
    ...Platform.select({
      web: {
        // Subtle noise texture on web
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.04\'/%3E%3C/svg%3E")',
      },
    }),
  },
});

export default DivineOverlays;
