/**
 * Phase 3.54: Skill Cut-In Overlay
 * 
 * Purpose: Display dramatic skill activation overlays during battle presentation.
 * Uses existing hero portrait or fallback silhouette + gradient + big typography.
 * 
 * No timers/RAF - duration controlled by parent BattlePresentationModal step sequencing.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { track, Events } from '../../lib/telemetry/events';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Element colors
const ELEMENT_COLORS: Record<string, readonly [string, string]> = {
  fire: ['#ff6b35', '#ff2222'] as const,
  water: ['#00b4d8', '#0077b6'] as const,
  earth: ['#8b7355', '#5c4033'] as const,
  wind: ['#90ee90', '#228b22'] as const,
  light: ['#ffd700', '#ff8c00'] as const,
  dark: ['#4b0082', '#1a0033'] as const,
  neutral: ['#708090', '#2f4f4f'] as const,
};

// Rarity accent colors
const RARITY_ACCENTS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#8b5cf6',
  legendary: '#f59e0b',
  mythic: '#ef4444',
};

export type SkillCutInData = {
  title: string;
  subtitle?: string;
  element?: string;
  rarity?: string;
  heroPortrait?: string; // URL to hero portrait, optional
};

type Props = {
  visible: boolean;
  data: SkillCutInData | null;
  onDone: () => void;
  mode?: 'campaign' | 'dungeon' | 'arena';
};

export function SkillCutInOverlay({ visible, data, onDone, mode = 'campaign' }: Props) {
  const opacity = useSharedValue(0);
  const slideX = useSharedValue(-100);
  const scale = useSharedValue(0.8);
  
  useEffect(() => {
    if (visible && data) {
      // Track telemetry
      track(Events.PVE_SKILL_CUTIN_SHOWN, {
        title: data.title,
        element: data.element,
        rarity: data.rarity,
        mode,
      });
      
      // Animate in
      opacity.value = withTiming(1, { duration: 200 });
      slideX.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.2)) });
      scale.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withTiming(1, { duration: 150 })
      );
      
      // Auto-complete after animation (controlled by parent, but provide fallback)
      const timeout = setTimeout(() => {
        animateOut();
      }, 1500); // Fallback timeout, parent should call onDone earlier
      
      return () => clearTimeout(timeout);
    } else {
      // Reset
      opacity.value = 0;
      slideX.value = -100;
      scale.value = 0.8;
    }
  }, [visible, data]);
  
  const animateOut = () => {
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onDone)();
    });
  };
  
  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: slideX.value },
      { scale: scale.value },
    ],
  }));
  
  if (!visible || !data) return null;
  
  const elementColors = ELEMENT_COLORS[data.element?.toLowerCase() || 'neutral'] || ELEMENT_COLORS.neutral;
  const rarityAccent = RARITY_ACCENTS[data.rarity?.toLowerCase() || 'common'] || RARITY_ACCENTS.common;
  
  return (
    <View style={styles.fullOverlay} pointerEvents="none">
      <Animated.View style={[styles.container, containerStyle]}>
        <LinearGradient
          colors={[elementColors[0] + 'E0', elementColors[1] + 'F0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Diagonal stripe accent */}
          <View style={[styles.stripe, { backgroundColor: rarityAccent + '40' }]} />
          
          {/* Content */}
          <View style={styles.content}>
            {/* Hero silhouette/portrait area */}
            <View style={styles.portraitArea}>
              {data.heroPortrait ? (
                <Image
                  source={{ uri: data.heroPortrait }}
                  style={styles.portrait}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.silhouette}>
                  <Text style={styles.silhouetteIcon}>⚔️</Text>
                </View>
              )}
            </View>
            
            {/* Skill name */}
            <View style={styles.textArea}>
              <Text style={styles.title}>{data.title}</Text>
              {data.subtitle && (
                <Text style={styles.subtitle}>{data.subtitle}</Text>
              )}
              
              {/* Element badge */}
              {data.element && (
                <View style={[styles.elementBadge, { backgroundColor: rarityAccent }]}>
                  <Text style={styles.elementText}>
                    {data.element.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Decorative lines */}
          <View style={styles.topLine} />
          <View style={styles.bottomLine} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    width: SCREEN_WIDTH * 0.95,
    maxWidth: 400,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  gradient: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    position: 'relative',
  },
  stripe: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 200,
    transform: [{ rotate: '30deg' }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  portraitArea: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  portrait: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  silhouette: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  silhouetteIcon: {
    fontSize: 36,
  },
  textArea: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  elementBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  elementText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  bottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
