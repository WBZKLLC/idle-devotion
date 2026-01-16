// /app/frontend/components/home/HomeSideRail.tsx
// Phase 3.22.12.R1: Side Rail (Mail + Friends)
//
// Decoupled: rail only emits intent (callbacks). Home decides navigation.
// Icons only, 7 actions, scrollable, no-bounce, subtle bottom fade.
//
// "The rail is reflex. DoorsSheet is the library."

import React, { useMemo } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { HOME_OVERLAY, RAIL } from '../ui/tokens';

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

function Badge({ value }: { value: number | boolean }) {
  const label =
    typeof value === 'number' ? (value > 99 ? '99+' : String(value)) : '';

  return (
    <View style={styles.badge}>
      {typeof value === 'number' ? <Text style={styles.badgeText}>{label}</Text> : null}
    </View>
  );
}

export function HomeSideRail(props: HomeSideRailProps) {
  const items = useMemo(
    () => [
      { key: 'doors' as const, icon: 'grid' as const, onPress: props.onPressDoors, accent: true },
      { key: 'mail' as const, icon: 'mail' as const, onPress: props.onPressMail },
      { key: 'friends' as const, icon: 'people' as const, onPress: props.onPressFriends },
      { key: 'quest' as const, icon: 'map' as const, onPress: props.onPressQuest },
      { key: 'events' as const, icon: 'calendar' as const, onPress: props.onPressEvents },
      { key: 'summon' as const, icon: 'gift' as const, onPress: props.onPressSummon },
      { key: 'shop' as const, icon: 'storefront' as const, onPress: props.onPressShop },
    ],
    [props],
  );

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {/* Rail background */}
      <View style={styles.railBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {items.map((it) => {
          const badgeValue = props.badges?.[it.key];
          const showBadge = badgeValue === true || (typeof badgeValue === 'number' && badgeValue > 0);

          return (
            <Pressable
              key={it.key}
              onPress={() => {
                props.onAnyInteraction?.();
                it.onPress();
              }}
              onPressIn={props.onAnyInteraction}
              style={({ pressed }) => [
                styles.item,
                it.accent ? styles.itemAccent : null,
                pressed ? styles.itemPressed : null,
              ]}
              hitSlop={10}
            >
              <Ionicons
                name={it.icon}
                size={RAIL.ICON_SIZE}
                color={it.accent ? COLORS.gold.primary : COLORS.cream.pure}
                style={{ opacity: it.accent ? 1 : 0.92 }}
              />
              {showBadge ? <Badge value={badgeValue!} /> : null}
            </Pressable>
          );
        })}

        {/* bottom spacer */}
        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Subtle bottom fade */}
      <LinearGradient
        colors={['transparent', COLORS.navy.darkest + '60']}
        style={styles.fadeBottom}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: HOME_OVERLAY.SIDE_INSET,
    top: HOME_OVERLAY.TOP_INSET,
    bottom: HOME_OVERLAY.BOTTOM_CLEARANCE,
    width: RAIL.WIDTH,
    alignItems: 'flex-end',
    zIndex: 5,
  },
  railBack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: RAIL.WIDTH,
    borderRadius: RAIL.RADIUS,
    backgroundColor: COLORS.navy.dark + RAIL.BG_ALPHA_HEX,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
      },
    }),
  },
  scroll: {
    width: RAIL.WIDTH,
    borderRadius: RAIL.RADIUS,
  },
  scrollContent: {
    paddingTop: RAIL.PAD_Y,
    paddingBottom: RAIL.PAD_Y,
    alignItems: 'center',
    gap: RAIL.GAP,
  },
  item: {
    width: RAIL.ITEM_SIZE,
    height: RAIL.ITEM_SIZE,
    borderRadius: RAIL.ITEM_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy.dark + '14',
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  itemAccent: {
    backgroundColor: COLORS.navy.dark + '1C',
    borderColor: COLORS.gold.dark + '22',
  },
  itemPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.navy.dark,
    letterSpacing: 0.2,
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 18,
    borderBottomLeftRadius: RAIL.RADIUS,
    borderBottomRightRadius: RAIL.RADIUS,
  },
});
