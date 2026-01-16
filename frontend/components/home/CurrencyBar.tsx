// /app/frontend/components/home/CurrencyBar.tsx
// Phase 3.22.1: Extracted currency bar component

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS } from '../ui/tokens';

interface CurrencyBarProps {
  gems: number;
  gold: number;
  coins: number;
  divineEssence: number;
}

const CURRENCIES = [
  { key: 'gems', icon: 'diamond' as const, color: '#9b4dca', label: 'Gems' },
  { key: 'gold', icon: 'logo-bitcoin' as const, color: COLORS.gold.primary, label: 'Gold' },
  { key: 'coins', icon: 'cash' as const, color: COLORS.gold.light, label: 'Coins' },
  { key: 'essence', icon: 'star' as const, color: '#f59e0b', label: 'Essence' },
] as const;

export function CurrencyBar({ gems, gold, coins, divineEssence }: CurrencyBarProps) {
  const values = { gems, gold, coins, essence: divineEssence };
  
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {CURRENCIES.map((currency) => (
        <View key={currency.key} style={styles.item}>
          <Ionicons name={currency.icon} size={14} color={currency.color} />
          <Text style={styles.text}>
            {(values[currency.key] || 0).toLocaleString()}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: SPACING.sm,
  },
  content: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium + '80',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  text: {
    fontSize: 12,
    color: COLORS.cream.soft,
    fontWeight: '500',
  },
});

export default CurrencyBar;
