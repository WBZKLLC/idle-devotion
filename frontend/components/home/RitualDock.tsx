// /app/frontend/components/home/RitualDock.tsx
// Phase 3.22.7.A: The Ritual Dock — one calm focal point
//
// A compact, always-visible representation of the idle ritual.
// Lives at bottom-center, above the tab bar.
// Tapping expands to the full IdleRewardsCard in a sheet.
//
// "The sanctuary has one altar. Everything else is periphery."

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import COLORS from '../../theme/colors';
import { DOCK, LAYOUT, INVITATION } from '../ui/tokens';
import { PRESS, haptic } from '../../lib/ui/interaction';
import { IDLE_COPY } from '../../lib/ui/copy';

type IdleStatus = {
  gold_pending?: number;
  time_elapsed?: number;
  max_hours?: number;
};

type Props = {
  idleStatus: IdleStatus | null;
  formatIdleTime: (elapsedSec: number, maxHours: number) => string;
  onPress: () => void;
  onReceive: () => void;
  /** Called on any interaction to cancel pending desire accents */
  onAnyInteraction?: () => void;
};

/**
 * RitualDock — The one calm focal point
 * 
 * Compact representation of the idle ritual.
 * Shows: title, time, gold, one CTA (Receive only).
 * Tapping opens the full ritual sheet.
 * "Take More" lives in the expanded sheet, not here.
 */
export function RitualDock({ idleStatus, formatIdleTime, onPress, onReceive, onAnyInteraction }: Props) {
  // Subtle breathing animation (very restrained)
  const breatheValue = useSharedValue(0);
  
  React.useEffect(() => {
    breatheValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      false
    );
  }, []);
  
  const breatheStyle = useAnimatedStyle(() => ({
    opacity: 0.92 + breatheValue.value * 0.08, // 0.92 → 1.0
    transform: [{ scale: 1 + breatheValue.value * 0.003 }], // 1.0 → 1.003
  }));
  
  const goldPending = idleStatus?.gold_pending ?? 0;
  const timeElapsed = idleStatus?.time_elapsed ?? 0;
  const maxHours = idleStatus?.max_hours ?? 168;
  const formattedTime = formatIdleTime(timeElapsed, maxHours);
  
  return (
    <Animated.View style={[styles.container, breatheStyle]}>
      <Pressable
        style={({ pressed }) => [
          styles.dock,
          pressed && styles.dockPressed,
        ]}
        onPress={onPress}
      >
        <LinearGradient
          colors={['#1a2744', '#0f1a2e', '#0a1220']}
          style={styles.gradient}
        >
          {/* Top highlight (glass edge) */}
          <View style={styles.topHighlight} />
          
          {/* Content row */}
          <View style={styles.content}>
            {/* Left: Title + Time */}
            <View style={styles.left}>
              <Text style={styles.title}>{IDLE_COPY.title}</Text>
              <Text style={styles.time}>{formattedTime}</Text>
            </View>
            
            {/* Center: Gold pending */}
            <View style={styles.center}>
              <Ionicons name="star" size={14} color={COLORS.gold.primary} />
              <Text style={styles.gold}>+{goldPending.toLocaleString()}</Text>
            </View>
            
            {/* Right: Receive CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
              ]}
              onPressIn={onAnyInteraction}
              onPress={(e) => {
                e.stopPropagation();
                haptic('medium');
                onReceive();
              }}
            >
              <Ionicons name="download-outline" size={16} color={COLORS.navy.darkest} />
              <Text style={styles.ctaText}>Receive</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: LAYOUT.TAB_BAR_HEIGHT + DOCK.bottomOffset,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  dock: {
    width: `${DOCK.widthPct * 100}%` as any,
    minHeight: DOCK.minHeight,
    borderRadius: DOCK.radius,
    overflow: 'hidden',
    // Phase 3.23.8: Richer material - relic base, not card
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: `0 0 32px ${COLORS.gold.primary}35, 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`,
      },
    }),
  },
  dockPressed: {
    transform: [{ scale: PRESS.SCALE }],
    opacity: 0.95,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Phase 3.23.8: Richer border - gold authority edge
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '35',
    borderRadius: DOCK.radius,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: COLORS.cream.pure,
    opacity: 0.15,
    borderRadius: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.cream.soft,
    letterSpacing: 0.4,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  time: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream.pure,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    opacity: INVITATION.secondary,
  },
  gold: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gold.light,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.cream.soft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.navy.darkest,
    letterSpacing: 0.3,
  },
});
