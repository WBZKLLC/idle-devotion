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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  
  // Identity Layer
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  // Avatar with subtle glow behind
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatarGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gold.dark,
    opacity: 0.15,
    top: -4,
    left: -4,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.navy.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '60', // softer border
  },
  avatarText: {
    color: COLORS.gold.light,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  
  // Text block — greeting dominant, username secondary
  textBlock: {
    flex: 1,
  },
  greetingText: {
    color: COLORS.cream.soft,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.3,
  },
  usernameText: {
    color: COLORS.cream.pure,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: 2,
  },
  
  // CR Badge — recessed, quiet confidence
  crBadge: {
    minWidth: 72,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm + 2,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.navy.dark + 'CC', // slightly transparent
    alignItems: 'center',
  },
  crLabel: {
    color: COLORS.cream.dark, // more muted
    fontSize: FONT_SIZE.xs,
    letterSpacing: 1.5,
    fontWeight: FONT_WEIGHT.medium,
  },
  crValue: {
    color: COLORS.cream.soft, // softer than gold — power doesn't shout
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: 1,
  },
});
