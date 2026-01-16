import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../ui/tokens';

type Props = {
  username: string;
  cr: number;
};

export function HomeHeader({ username, cr }: Props) {
  const initial = (username?.[0] ?? '?').toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.userInfo}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.usernameText}>{username}</Text>
        </View>
      </View>

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
    paddingBottom: SPACING.sm,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: COLORS.navy.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gold.dark,
  },
  avatarText: {
    color: COLORS.gold.light,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  welcomeText: {
    color: COLORS.cream.soft,
    fontSize: FONT_SIZE.sm,
  },
  usernameText: {
    color: COLORS.cream.pure,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
  },
  crBadge: {
    minWidth: 72,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.navy.medium,
    borderWidth: 1,
    borderColor: COLORS.navy.light,
    alignItems: 'center',
  },
  crLabel: {
    color: COLORS.cream.soft,
    fontSize: FONT_SIZE.xs,
    letterSpacing: 1,
  },
  crValue: {
    color: COLORS.gold.light,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
});
