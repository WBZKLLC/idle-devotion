// /app/frontend/components/home/HomeSideRail.tsx
// Phase 3.22.7.D: Side Rail Actions
// Phase 3.22.13: Rail composition locked — "Idle Angels-style"
//
// A vertical stack of hot actions on the right side of the screen.
// Icons only, no labels. Daily muscle memory.
// Doors + 6 pinned items = 7 total (max before scroll).
//
// "The rail is reflex. DoorsSheet is the library."

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import COLORS from '../../theme/colors';
import { RAIL, HOME_OVERLAY } from '../ui/tokens';
import { PRESS, haptic } from '../../lib/ui/interaction';

type RailItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  onPress?: () => void;
  badge?: number;
  color?: string;
};

type Props = {
  items?: RailItem[];
  onDoorsPress: () => void;
  /** Called on any interaction to cancel pending desire accents */
  onAnyInteraction?: () => void;
};

/**
 * Default rail items — "Idle Angels-style" composition
 * Order: Mail, Friends, Quest, Events, Summon, Shop
 * Doors button is rendered separately at top
 */
const defaultItems: RailItem[] = [
  { key: 'mail', icon: 'mail-outline', route: '/rewards' },
  { key: 'friends', icon: 'people-outline', route: '/friends' },
  { key: 'quest', icon: 'map-outline', route: '/journey' },
  { key: 'events', icon: 'calendar-outline', route: '/events' },
  { key: 'summon', icon: 'gift-outline', route: '/summon-hub' },
  { key: 'shop', icon: 'storefront-outline', route: '/store' },
];

/**
 * HomeSideRail — Peripheral hot actions
 * 
 * Icons only. No labels. Max 7 visible (Doors + 6 items).
 * Scrollable with subtle fade if overflow.
 */
export function HomeSideRail({ items = defaultItems, onDoorsPress, onAnyInteraction }: Props) {
  const router = useRouter();
  
  const handleItemPress = (item: RailItem) => {
    onAnyInteraction?.();
    haptic('light');
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };
  
  const handleDoorsPress = () => {
    onAnyInteraction?.();
    haptic('light');
    onDoorsPress();
  };
  
  return (
    <View style={styles.container}>
      {/* Doors button at top (opens full menu) */}
      <Pressable
        style={({ pressed }) => [
          styles.item,
          styles.doorsItem,
          pressed && styles.itemPressed,
        ]}
        onPress={handleDoorsPress}
      >
        <Ionicons name="grid-outline" size={18} color={COLORS.gold.light} />
      </Pressable>
      
      {/* Scrollable rail items (no bounce, subtle fade if overflow) */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.item,
              pressed && styles.itemPressed,
            ]}
            onPress={() => handleItemPress(item)}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={item.color ?? COLORS.cream.soft}
            />
            {item.badge && item.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
      
      {/* Bottom fade indicator (subtle, only visible if scrollable) */}
      <LinearGradient
        colors={['transparent', COLORS.navy.darkest + '60']}
        style={styles.bottomFade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: HOME_OVERLAY.sideInset,
    top: '22%',
    bottom: '28%', // Room for dock + tab bar
    zIndex: 5,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    marginTop: HOME_OVERLAY.railGap,
  },
  scrollContent: {
    gap: HOME_OVERLAY.railGap,
    paddingBottom: 8,
  },
  item: {
    width: RAIL.itemSize,
    height: RAIL.itemSize,
    borderRadius: RAIL.radius,
    backgroundColor: COLORS.navy.darkest + Math.round(RAIL.bgAlpha * 255).toString(16).padStart(2, '0'),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '08',
    // Subtle shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      },
    }),
  },
  itemPressed: {
    transform: [{ scale: PRESS.SCALE }],
    opacity: 0.8,
  },
  doorsItem: {
    borderColor: COLORS.gold.dark + '25',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    borderRadius: RAIL.radius,
  },
});
