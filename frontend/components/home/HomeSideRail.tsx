// /app/frontend/components/home/HomeSideRail.tsx
// Phase 3.23.8: Collapsible Side Rail
//
// Collapsed by default - only Doors icon visible.
// Tap Doors to expand, tap outside or tap Doors again to collapse.
// Auto-collapse after 5s of no interaction.
//
// "The rail is a tool you summon, not furniture."

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, Platform, Text, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { HOME_OVERLAY, RAIL } from '../ui/tokens';
import { haptic } from '../../lib/ui/interaction';

// Press feedback constants
const PRESS = {
  OPACITY: 0.85,
  SCALE: 0.97,
};

type RailKey = 'doors' | 'mail' | 'friends' | 'quest' | 'events' | 'summon' | 'shop';

export type HomeSideRailBadges = Partial<Record<RailKey, number | boolean>>;

export type HomeSideRailProps = {
  onAnyInteraction?: () => void;

  onPressDoors: () => void;
  onPressMail: () => void;
  onPressFriends: () => void;
  onPressQuest: () => void;
  onPressEvents: () => void;
  onPressSummon: () => void;
  onPressShop: () => void;

  badges?: HomeSideRailBadges;
};

const EXPAND_DURATION = 240;
const COLLAPSE_DURATION = 200;
const AUTO_COLLAPSE_DELAY = 5000; // 5 seconds

function Badge({ value }: { value: number | boolean }) {
  const label =
    typeof value === 'number' ? (value > 9 ? '9+' : String(value)) : '';

  return (
    <View style={styles.badge}>
      {typeof value === 'number' ? <Text style={styles.badgeText}>{label}</Text> : null}
    </View>
  );
}

export function HomeSideRail(props: HomeSideRailProps) {
  const [expanded, setExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Animation value: 0 = collapsed, 1 = expanded
  const expandProgress = useSharedValue(0);
  
  // Check for reduce motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => subscription.remove();
  }, []);
  
  // Clear auto-collapse timer on unmount
  useEffect(() => {
    return () => {
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
      }
    };
  }, []);
  
  // Reset auto-collapse timer on interaction
  const resetAutoCollapse = useCallback(() => {
    if (autoCollapseTimer.current) {
      clearTimeout(autoCollapseTimer.current);
    }
    if (expanded) {
      autoCollapseTimer.current = setTimeout(() => {
        setExpanded(false);
        expandProgress.value = reduceMotion 
          ? 0 
          : withTiming(0, { duration: COLLAPSE_DURATION, easing: Easing.in(Easing.ease) });
      }, AUTO_COLLAPSE_DELAY);
    }
  }, [expanded, reduceMotion, expandProgress]);
  
  // Start/reset auto-collapse when expanded changes
  useEffect(() => {
    if (expanded) {
      resetAutoCollapse();
    } else {
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
        autoCollapseTimer.current = null;
      }
    }
  }, [expanded, resetAutoCollapse]);
  
  const toggleExpand = useCallback(() => {
    haptic('light');
    props.onAnyInteraction?.();
    
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    if (reduceMotion) {
      expandProgress.value = newExpanded ? 1 : 0;
    } else {
      expandProgress.value = withTiming(
        newExpanded ? 1 : 0,
        {
          duration: newExpanded ? EXPAND_DURATION : COLLAPSE_DURATION,
          easing: newExpanded ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
        }
      );
    }
  }, [expanded, reduceMotion, expandProgress, props]);
  
  const handleItemPress = useCallback((action: () => void) => {
    haptic('light');
    props.onAnyInteraction?.();
    resetAutoCollapse();
    action();
  }, [props, resetAutoCollapse]);
  
  // Items for expanded rail (excluding Doors)
  const expandedItems = useMemo(
    () => [
      { key: 'mail' as const, icon: 'mail' as const, onPress: props.onPressMail },
      { key: 'friends' as const, icon: 'people' as const, onPress: props.onPressFriends },
      { key: 'quest' as const, icon: 'map' as const, onPress: props.onPressQuest },
      { key: 'events' as const, icon: 'calendar' as const, onPress: props.onPressEvents },
      { key: 'summon' as const, icon: 'gift' as const, onPress: props.onPressSummon },
      { key: 'shop' as const, icon: 'storefront' as const, onPress: props.onPressShop },
    ],
    [props],
  );
  
  // Animated styles for expanded content
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: expandProgress.value,
    transform: [
      { translateX: (1 - expandProgress.value) * 20 },
      { scale: 0.9 + expandProgress.value * 0.1 },
    ],
    maxHeight: expandProgress.value * 400, // Content-based height
  }));
  
  // Animated style for housing
  const housingStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + expandProgress.value * 0.55,
  }));
  
  // Check for any badges
  const hasAnyBadge = props.badges && Object.values(props.badges).some(v => v);
  
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.railContainer}>
        {/* Housing background */}
        <Animated.View style={[styles.railBack, housingStyle]} />
        
        {/* Doors button (always visible) */}
        <Pressable
          style={({ pressed }) => [
            styles.doorsButton,
            pressed && styles.itemPressed,
          ]}
          onPress={toggleExpand}
          hitSlop={12}
        >
          <Ionicons
            name="grid"
            size={RAIL.ICON_SIZE}
            color={COLORS.gold.primary}
          />
          {/* Show dot indicator if there are badges and rail is collapsed */}
          {!expanded && hasAnyBadge && (
            <View style={styles.collapsedIndicator} />
          )}
        </Pressable>
        
        {/* Expanded items */}
        <Animated.View style={[styles.expandedContent, expandedStyle]} pointerEvents={expanded ? 'auto' : 'none'}>
          {expandedItems.map((it) => {
            const badgeValue = props.badges?.[it.key];
            const showBadge = badgeValue !== undefined && badgeValue !== false && badgeValue !== 0;
            
            return (
              <Pressable
                key={it.key}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.itemPressed,
                ]}
                onPress={() => handleItemPress(it.onPress)}
                hitSlop={8}
              >
                <Ionicons
                  name={it.icon}
                  size={RAIL.ICON_SIZE}
                  color={COLORS.cream.pure}
                  style={{ opacity: 0.92 }}
                />
                {showBadge ? <Badge value={badgeValue!} /> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: HOME_OVERLAY.SIDE_INSET,
    top: HOME_OVERLAY.TOP_INSET,
    zIndex: 5,
  },
  railContainer: {
    alignItems: 'center',
  },
  railBack: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    right: -6,
    left: -6,
    borderRadius: RAIL.RADIUS + 4,
    // Phase 3.23.8: Glass/ink panel housing
    backgroundColor: COLORS.navy.dark + 'E8',
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '08',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: -2, height: 8 },
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '-2px 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  doorsButton: {
    width: RAIL.WIDTH,
    height: RAIL.WIDTH,
    borderRadius: RAIL.RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold.primary,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  item: {
    width: RAIL.WIDTH,
    height: RAIL.WIDTH,
    borderRadius: RAIL.RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPressed: {
    opacity: PRESS.OPACITY,
    transform: [{ scale: PRESS.SCALE }],
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
});

export default HomeSideRail;
