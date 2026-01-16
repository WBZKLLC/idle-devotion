// /app/frontend/components/home/HomeHeader.tsx
// Phase 3.22.6: "Recognition" Header — not a dashboard, a soft acknowledgment
//
// The header is a threshold, not a report.
// "You didn't arrive — you came back."

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../ui/tokens';
import { getGreeting } from '../../lib/ui/copy';

type Props = {
  username: string;
  cr: number;
};

export function HomeHeader({ username, cr }: Props) {
  const initial = (username?.[0] ?? '?').toUpperCase();
  
  // Greeting rotates subtly on mount — stable during session
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <View style={styles.header}>
      {/* Identity Layer — emotional, primary */}
      <View style={styles.identityRow}>
        {/* Avatar with soft glow */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarGlow} />
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* Greeting + Username — greeting primary, name secondary */}
        <View style={styles.textBlock}>
          <Text style={styles.greetingText}>{greeting}</Text>
          <Text style={styles.usernameText}>{username}</Text>
        </View>
      </View>

      {/* CR Badge — quiet confidence, recessed */}
      <View style={styles.crBadge}>
        <Text style={styles.crLabel}>CR</Text>
        <Text style={styles.crValue}>{cr.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  
  // Identity Layer — quieter, smaller
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  // Avatar — smaller glow, less prominent
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.sm,
  },
  avatarGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold.dark,
    opacity: 0.08, // subtle
    top: -2,
    left: -2,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navy.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '40', // softer
  },
  avatarText: {
    color: COLORS.cream.soft, // quieter
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  
  // Text block — greeting quieter, username smaller
  textBlock: {
    flex: 1,
  },
  greetingText: {
    color: COLORS.cream.dark, // muted
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  usernameText: {
    color: COLORS.cream.soft,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: 1,
  },
  
  // CR Badge — recessed, subordinate
  crBadge: {
    minWidth: 64,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.navy.darkest + 'AA', // transparent
    alignItems: 'center',
  },
  crLabel: {
    color: COLORS.cream.dark + 'AA', // very muted
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: FONT_WEIGHT.medium,
  },
  crValue: {
    color: COLORS.cream.dark, // quiet - power doesn't shout
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: 1,
  },
});
