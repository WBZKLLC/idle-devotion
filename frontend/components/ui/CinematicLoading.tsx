// /app/frontend/components/ui/CinematicLoading.tsx
// Phase 3.19.7: Idle Angels-style cinematic loading screen

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { LAYOUT } from './AppHeader';
// Single source of truth for login hero
import { LOGIN_HERO_URI } from '../../lib/assets/loginHero';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  /** Hero image source - defaults to login hero */
  heroSource?: ImageSourcePropType;
  /** Main title text */
  title?: string;
  /** Subtitle/loading text */
  subtitle?: string;
  /** If you have real progress (0..1), pass it. If undefined, shows indeterminate. */
  progress?: number;
  /** Optional tip text at bottom */
  tip?: string;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function CinematicLoading({
  heroSource,
  title = 'Idle Devotion',
  subtitle = 'Loading…',
  progress,
  tip = 'Tip: duplicates become shards for star promotion.',
}: Props) {
  const zoom = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  // Resolve hero source - use login hero by default
  const resolvedSource = heroSource || { uri: LOGIN_HERO_SOURCE };

  useEffect(() => {
    // Ken Burns effect - slow zoom + pan
    const kenBurns = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(zoom, {
            toValue: 1.06,
            duration: 3600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(panX, {
            toValue: 10,
            duration: 3600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(zoom, {
            toValue: 1.0,
            duration: 3600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(panX, {
            toValue: -10,
            duration: 3600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Soft glow pulse
    const glowPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    kenBurns.start();
    glowPulse.start();

    return () => {
      kenBurns.stop();
      glowPulse.stop();
    };
  }, [glow, panX, zoom]);

  const isDeterminate = typeof progress === 'number' && isFinite(progress);

  const determinateWidth = useMemo(() => {
    if (!isDeterminate) return '35%';
    const clamped = Math.max(0, Math.min(1, progress!));
    return `${Math.round(clamped * 100)}%`;
  }, [isDeterminate, progress]);

  // Indeterminate bar animation (subtle sweep)
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isDeterminate) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isDeterminate, sweep]);

  const sweepTranslate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-70, 70],
  });

  return (
    <View style={styles.root}>
      {/* Background hero with Ken Burns */}
      <Animated.Image
        source={resolvedSource}
        style={[
          styles.hero,
          {
            transform: [{ scale: zoom }, { translateX: panX }],
          },
        ]}
        resizeMode="cover"
      />

      {/* Dark overlay */}
      <LinearGradient
        colors={['rgba(3,8,18,0.85)', 'rgba(3,8,18,0.55)', 'rgba(3,8,18,0.85)']}
        style={styles.overlay}
      />

      {/* Vignette */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.55)']}
        style={styles.vignette}
      />

      {/* Soft glow accent */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.08] }) }],
          },
        ]}
      />

      {/* Center title */}
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* Bottom loading row */}
      <View style={styles.bottom}>
        <View style={styles.bottomRow}>
          <Ionicons name="sparkles" size={16} color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Preparing your realm</Text>
          {isDeterminate && (
            <Text style={styles.percentText}>
              {Math.round(Math.max(0, Math.min(1, progress!)) * 100)}%
            </Text>
          )}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: determinateWidth }]} />
          {!isDeterminate && (
            <Animated.View
              style={[
                styles.progressSweep,
                {
                  transform: [{ translateX: sweepTranslate }],
                },
              ]}
            />
          )}
        </View>

        {tip && <Text style={styles.hintText}>{tip}</Text>}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    position: 'absolute',
    left: '18%',
    top: '22%',
    width: '64%',
    height: '44%',
    borderRadius: 999,
    backgroundColor: 'rgba(155,120,255,0.25)',
  },
  center: {
    flex: 1,
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    justifyContent: 'center',
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
  },
  bottom: {
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingBottom: 32,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  percentText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,215,120,0.75)',
    borderRadius: 999,
  },
  progressSweep: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 60,
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default CinematicLoading;
