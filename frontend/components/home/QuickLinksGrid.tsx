// /app/frontend/components/home/QuickLinksGrid.tsx
// Phase 3.22.1: Extracted quick links grid component

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { BG_NAVY, ACCENT_GOLD } from '../../lib/ui/gradients';
import { SPACING, RADIUS } from '../ui/tokens';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface QuickLink {
  route: string;
  icon: IoniconsName;
  label: string;
  variant?: 'gold' | 'navy';
}

const QUICK_LINKS: QuickLink[] = [
  { route: '/hero-manager', icon: 'people', label: 'Teams', variant: 'gold' },
  { route: '/heroes', icon: 'star', label: 'Heroes' },
  { route: '/login-rewards', icon: 'calendar', label: 'Rewards' },
  { route: '/summon-hub', icon: 'flash', label: 'Summon' },
  { route: '/store', icon: 'cart', label: 'Store' },
  { route: '/campaign', icon: 'map', label: 'Campaign' },
];

export function QuickLinksGrid() {
  const router = useRouter();

  return (
    <View style={styles.grid}>
      {QUICK_LINKS.map((link) => (
        <TouchableOpacity
          key={link.route}
          style={styles.tile}
          onPress={() => router.push(link.route as any)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={link.variant === 'gold' ? ACCENT_GOLD : BG_NAVY}
            style={styles.tileGradient}
          >
            <Ionicons
              name={link.icon}
              size={22}
              color={link.variant === 'gold' ? COLORS.navy.darkest : COLORS.gold.light}
            />
            <Text
              style={[
                styles.tileText,
                link.variant === 'gold' && { color: COLORS.navy.darkest },
              ]}
            >
              {link.label}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  tile: {
    width: '31%',
    aspectRatio: 1.2,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  tileGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
  },
  tileText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gold.light,
  },
});

export default QuickLinksGrid;
