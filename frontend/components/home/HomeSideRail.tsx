// /app/frontend/components/home/HomeSideRail.tsx
// Phase 3.22.7.D: Side Rail Actions
//
// A vertical stack of hot actions on the right side of the screen.
// Peripheral, tastefully packaged, always accessible.
//
// Each item:
// - Small hit target (still 44+)
// - Translucent backing
// - Subtle pressed feedback
// - Minimal labels (icon-first)

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import COLORS from '../../theme/colors';
import { RAIL, HOME_OVERLAY, INVITATION } from '../ui/tokens';
import { PRESS, haptic } from '../../lib/ui/interaction';

type RailItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  onPress?: () => void;
  badge?: number;
  color?: string;
};

type Props = {
  items?: RailItem[];
  onDoorsPress: () => void;
};

/**
 * Default rail items for the sanctuary home
 */
const defaultItems: RailItem[] = [
  { key: 'quest', icon: 'map-outline', label: 'Quest', route: '/journey' },
  { key: 'events', icon: 'calendar-outline', label: 'Events', route: '/events' },
  { key: 'summon', icon: 'gift-outline', label: 'Summon', route: '/summon-hub' },
  { key: 'shop', icon: 'storefront-outline', label: 'Shop', route: '/store' },
];

/**
 * HomeSideRail — Peripheral hot actions
 * 
 * Positioned on the right side, always visible.
 * Tapping an item navigates or triggers action.
 */
export function HomeSideRail({ items = defaultItems, onDoorsPress }: Props) {
  const router = useRouter();
  
  const handleItemPress = (item: RailItem) => {
    haptic('light');
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Rail items */}
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
      
      {/* Doors button (opens full menu) */}
      <Pressable
        style={({ pressed }) => [
          styles.item,
          styles.doorsItem,
          pressed && styles.itemPressed,
        ]}
        onPress={() => {
          haptic('light');
          onDoorsPress();
        }}
      >
        <Ionicons name="grid-outline" size={18} color={COLORS.gold.light} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: HOME_OVERLAY.sideInset,
    top: '30%', // Vertically centered-ish
    gap: HOME_OVERLAY.railGap,
    zIndex: 5,
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
    marginTop: 6,
    borderColor: COLORS.gold.dark + '20',
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
});
