// /app/frontend/components/home/HomeHeader.tsx
// Phase 3.22.1: Extracted home screen header component

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS } from '../ui/tokens';

interface HomeHeaderProps {
  username: string;
  cr: number;
}

export function HomeHeader({ username, cr }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.userInfo}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  welcomeText: {
    fontSize: 12,
    color: COLORS.cream.dark,
  },
  usernameText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.cream.pure,
  },
  crBadge: {
    backgroundColor: COLORS.navy.medium,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold.dark,
    alignItems: 'center',
  },
  crLabel: {
    fontSize: 10,
    color: COLORS.gold.light,
    fontWeight: '500',
  },
  crValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gold.primary,
  },
});

export default HomeHeader;
