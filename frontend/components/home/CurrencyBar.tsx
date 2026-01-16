import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../ui/tokens';

type CurrencyItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: number;
};

type Props = {
  gems: number;
  gold: number;
  coins: number;
  divineEssence: number;
};

export function CurrencyBar({ gems, gold, coins, divineEssence }: Props) {
  const items: CurrencyItem[] = [
    { key: 'gems', icon: 'diamond', color: '#9b4dca', value: gems },
    { key: 'gold', icon: 'logo-bitcoin', color: COLORS.gold.primary, value: gold },
    { key: 'coins', icon: 'cash', color: COLORS.gold.light, value: coins },
    { key: 'divine', icon: 'star', color: '#f59e0b', value: divineEssence },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {items.map((it) => (
        <View key={it.key} style={styles.pill}>
          <Ionicons name={it.icon} size={14} color={it.color} />
          <Text style={styles.text}>{(it.value || 0).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: SPACING.xs },
  content: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.navy.dark,
    borderWidth: 1,
    borderColor: COLORS.navy.light,
  },
  text: {
    color: COLORS.cream.pure,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
