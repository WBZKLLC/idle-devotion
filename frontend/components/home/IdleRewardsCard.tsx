// /app/frontend/components/home/IdleRewardsCard.tsx
// Phase 3.22.6: "The Offering" — the emotional heart of the home screen
//
// This card represents: "What was prepared for you while you were away"
// Not a timer + buttons — an offering waiting to be received.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../ui/tokens';
import { PRESS, haptic } from '../../lib/ui/interaction';
import { IDLE_COPY, getIdleSubtitle } from '../../lib/ui/copy';

type IdleStatus = {
  is_capped?: boolean;
  time_elapsed?: number;
  max_hours?: number;
  gold_pending?: number;
};

type Props = {
  idleStatus: IdleStatus | null;
  vipLevel: number;
  instantCooldown: number;

  isClaimingCollect: boolean;
  isClaimingInstant: boolean;

  formatIdleTime: (elapsedSec: number, maxHours: number) => string;
  formatCooldown: (remainingSec: number) => string;

  onCollect: () => void;
  onInstant: () => void;
  onVipLockedPress: () => void;
};

export function IdleRewardsCard({
  idleStatus,
  vipLevel,
  instantCooldown,
  isClaimingCollect,
  isClaimingInstant,
  formatIdleTime,
  formatCooldown,
  onCollect,
  onInstant,
  onVipLockedPress,
}: Props) {
  const maxHours = idleStatus?.max_hours ?? 8;
  const elapsed = idleStatus?.time_elapsed ?? 0;
  const isCapped = !!idleStatus?.is_capped;
  const goldPending = idleStatus?.gold_pending ?? 0;

  const instantLocked = vipLevel < 1;
  const instantCooling = instantCooldown > 0;

  // Ritual subtitle — rotates subtly on mount
  const subtitle = useMemo(() => getIdleSubtitle(), []);

  // Card gradient — subtle shift when capped (ready to receive)
  const cardColors: readonly [string, string] = isCapped
    ? [COLORS.navy.primary + 'F0', COLORS.navy.dark]
    : [COLORS.navy.dark, COLORS.navy.darkest];

  const collectDisabled = isClaimingCollect || isClaimingInstant;
  const instantDisabled = collectDisabled || instantCooling;

  return (
    <View style={styles.card}>
      <LinearGradient colors={cardColors} style={styles.gradient}>
        {/* Inner highlight for depth */}
        <View style={styles.innerHighlight} />
        
        {/* Header — reframed as devotion, not idle */}
        <View style={styles.header}>
          <View style={styles.iconGlow}>
            <Ionicons name="hourglass-outline" size={20} color={COLORS.gold.light} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{IDLE_COPY.title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {/* Timer Section — dignified, not urgent */}
        <View style={styles.timerBox}>
          <View style={styles.timerRow}>
            <Text style={styles.timerLabel}>{IDLE_COPY.timerLabel}</Text>
            <Text style={styles.capNote}>{IDLE_COPY.maxTimeNote(maxHours)}</Text>
          </View>
          <Text style={[styles.timer, isCapped && styles.timerCapped]}>
            {formatIdleTime(elapsed, maxHours)}
          </Text>
          {isCapped && (
            <View style={styles.cappedBadge}>
              <Text style={styles.cappedText}>READY</Text>
            </View>
          )}
        </View>

        {/* Pending Rewards — the offering */}
        <View style={styles.pendingRow}>
          <View style={styles.pendingIcon}>
            <Ionicons name="star" size={16} color={COLORS.gold.primary} />
          </View>
          <Text style={styles.pendingText}>
            +{goldPending.toLocaleString()} Gold awaiting
          </Text>
        </View>

        {/* Action Buttons — Receive (calm), Demand More (tempting) */}
        <View style={styles.buttonRow}>
          {/* Receive Button — calm, grounded */}
          <Pressable
            style={({ pressed }) => [
              styles.btnReceive,
              pressed && styles.btnPressed,
              collectDisabled && styles.btnDisabled,
            ]}
            onPress={() => {
              haptic('medium');
              onCollect();
            }}
            disabled={collectDisabled}
          >
            {isClaimingCollect ? (
              <ActivityIndicator color={COLORS.navy.dark} size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={COLORS.navy.darkest} />
                <Text style={styles.btnReceiveText}>{IDLE_COPY.collectButton}</Text>
              </>
            )}
          </Pressable>

          {/* Demand More Button — assertion, not payment */}
          <Pressable
            style={({ pressed }) => [
              styles.btnInstant,
              pressed && styles.btnPressed,
              (instantLocked || instantCooling) && styles.btnInstantMuted,
            ]}
            onPress={() => {
              if (instantLocked) {
                haptic('warning');
                return onVipLockedPress();
              }
              haptic('medium');
              onInstant();
            }}
            disabled={instantDisabled}
          >
            {isClaimingInstant ? (
              <ActivityIndicator color={COLORS.cream.pure} size="small" />
            ) : instantLocked ? (
              <>
                <Ionicons name="lock-closed-outline" size={14} color={COLORS.cream.dark} />
                <Text style={styles.btnInstantTextMuted}>VIP 1+</Text>
              </>
            ) : instantCooling ? (
              <>
                <Ionicons name="time-outline" size={14} color={COLORS.cream.dark} />
                <Text style={styles.btnInstantTextMuted}>{formatCooldown(instantCooldown)}</Text>
              </>
            ) : (
              <>
                <Ionicons name="flash" size={16} color={COLORS.cream.pure} />
                <Text style={styles.btnInstantText}>{IDLE_COPY.instantButton}</Text>
              </>
            )}
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  gradient: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md + 2,
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '30', // soft gold border
    overflow: 'hidden',
    position: 'relative',
  },
  // Inner highlight — top edge glow for depth
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.cream.pure,
    opacity: 0.08,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconGlow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gold.dark + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: COLORS.cream.pure,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.cream.dark,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
    fontStyle: 'italic',
  },

  // Timer
  timerBox: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerLabel: {
    color: COLORS.cream.soft,
    fontSize: FONT_SIZE.xs,
    letterSpacing: 0.5,
  },
  capNote: {
    color: COLORS.cream.dark,
    fontSize: FONT_SIZE.xs,
  },
  timer: {
    marginTop: SPACING.xs,
    color: COLORS.cream.pure,
    fontSize: 24,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  timerCapped: {
    color: COLORS.gold.light,
  },
  cappedBadge: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gold.dark + '40',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  cappedText: {
    color: COLORS.gold.light,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.5,
  },

  // Pending
  pendingRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pendingIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gold.dark + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: {
    color: COLORS.cream.soft,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Buttons
  buttonRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  
  // Receive — calm gold, grounded
  btnReceive: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  btnReceiveText: {
    color: COLORS.navy.darkest,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
  },
  
  // Instant — brighter, tempting
  btnInstant: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  btnInstantText: {
    color: COLORS.cream.pure,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.3,
  },
  btnInstantMuted: {
    backgroundColor: COLORS.navy.medium,
  },
  btnInstantTextMuted: {
    color: COLORS.cream.dark,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  
  // States
  btnPressed: {
    transform: [{ scale: PRESS.SCALE }],
    opacity: PRESS.OPACITY,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
