// /app/frontend/components/home/IdleRewardsCard.tsx
// Phase 3.22.1: Extracted idle rewards card component

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { BG_NAVY, ACCENT_GOLD } from '../../lib/ui/gradients';
import { SPACING, RADIUS } from '../ui/tokens';

interface IdleRewardsCardProps {
  timerDisplay: string;
  maxHours: number;
  goldPending: number;
  isCapped: boolean;
  isClaimingCollect: boolean;
  isClaimingInstant: boolean;
  instantCooldown: number;
  vipLevel: number;
  onCollect: () => void;
  onInstant: () => void;
  formatCooldown: (seconds: number) => string;
}

export function IdleRewardsCard({
  timerDisplay,
  maxHours,
  goldPending,
  isCapped,
  isClaimingCollect,
  isClaimingInstant,
  instantCooldown,
  vipLevel,
  onCollect,
  onInstant,
  formatCooldown,
}: IdleRewardsCardProps) {
  const isDisabled = isClaimingCollect || isClaimingInstant;
  const canInstant = vipLevel >= 1 && instantCooldown <= 0;
  
  // Determine instant button gradient
  const instantGradient: readonly [string, string] = 
    vipLevel < 1 || instantCooldown > 0
      ? ['#4a4a6a', '#3a3a5a'] as const
      : ['#8b5cf6', '#6d28d9'] as const;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={isCapped ? ACCENT_GOLD : BG_NAVY}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Ionicons name="time" size={24} color={COLORS.gold.light} />
          <Text style={styles.title}>Idle Rewards</Text>
        </View>
        
        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>Time Elapsed</Text>
          <Text style={styles.timer}>{timerDisplay}</Text>
          <Text style={styles.capText}>
            Max: {maxHours}h {isCapped ? '• FULL' : ''}
          </Text>
        </View>
        
        <View style={styles.pendingRow}>
          <Ionicons name="star" size={18} color={COLORS.gold.primary} />
          <Text style={styles.pendingText}>+{goldPending.toLocaleString()} Gold Pending</Text>
        </View>
        
        <View style={styles.buttonRow}>
          {/* Collect Button */}
          <TouchableOpacity
            style={[styles.button, { flex: 1 }]}
            onPress={onCollect}
            disabled={isDisabled}
          >
            <LinearGradient colors={ACCENT_GOLD} style={styles.buttonGradient}>
              {isClaimingCollect ? (
                <ActivityIndicator color={COLORS.navy.dark} size="small" />
              ) : (
                <>
                  <Ionicons name="download" size={18} color={COLORS.navy.dark} />
                  <Text style={[styles.buttonText, { color: COLORS.navy.dark }]}>Collect</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Instant Button */}
          <TouchableOpacity
            style={[
              styles.button,
              { flex: 1, marginLeft: 8, opacity: canInstant ? 1 : 0.6 },
            ]}
            onPress={onInstant}
            disabled={isDisabled || instantCooldown > 0}
          >
            <LinearGradient colors={instantGradient} style={styles.buttonGradient}>
              {isClaimingInstant ? (
                <ActivityIndicator color={COLORS.cream.pure} size="small" />
              ) : vipLevel < 1 ? (
                <>
                  <Ionicons name="lock-closed" size={16} color={COLORS.cream.soft} />
                  <Text style={[styles.buttonText, styles.smallText]}>VIP 1+</Text>
                </>
              ) : instantCooldown > 0 ? (
                <>
                  <Ionicons name="time" size={16} color={COLORS.cream.soft} />
                  <Text style={[styles.buttonText, styles.smallText]}>
                    {formatCooldown(instantCooldown)}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="flash" size={18} color={COLORS.cream.pure} />
                  <Text style={styles.buttonText}>⚡ Instant</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  gradient: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gold.light,
  },
  timerBox: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  timerLabel: {
    fontSize: 11,
    color: COLORS.cream.dark,
  },
  timer: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.cream.pure,
    fontVariant: ['tabular-nums'],
  },
  capText: {
    fontSize: 11,
    color: COLORS.cream.dark,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    gap: 4,
  },
  pendingText: {
    fontSize: 14,
    color: COLORS.gold.light,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  button: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.cream.pure,
  },
  smallText: {
    fontSize: 11,
    color: COLORS.cream.soft,
  },
});

export default IdleRewardsCard;
