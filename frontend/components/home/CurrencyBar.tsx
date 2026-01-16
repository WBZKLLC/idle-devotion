import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, INVITATION } from '../ui/tokens';

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

/**
 * CurrencyBar — Phase 3.22.11: Chapter 1 "Return"
 * 
 * Quiet, grounded, never competing with the ritual.
 * Information, not invitation.
 */
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
          <Ionicons name={it.icon} size={13} color={it.color} style={styles.icon} />
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
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.navy.darkest + '80', // Phase 3.22.11: More transparent
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '08', // Phase 3.22.11: Almost invisible border
    // Phase 3.22.11: Chapter 1 — quiet, not competing
    opacity: INVITATION.secondary,
  },
  icon: {
    opacity: 0.85, // Phase 3.22.11: Slightly muted
  },
  text: {
    color: COLORS.cream.pure,
    fontSize: FONT_SIZE.sm - 1, // Phase 3.22.11: Slightly smaller
    fontWeight: FONT_WEIGHT.medium,
    opacity: 0.9,
    letterSpacing: 0.2,
  },
});
