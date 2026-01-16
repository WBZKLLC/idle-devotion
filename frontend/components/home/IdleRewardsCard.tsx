import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../ui/tokens';

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

  const instantLocked = vipLevel < 1;
  const instantCooling = instantCooldown > 0;

  const cardColors: readonly [string, string] = isCapped
    ? [COLORS.gold.primary, COLORS.gold.dark]
    : [COLORS.navy.medium, COLORS.navy.primary];

  const collectDisabled = isClaimingCollect || isClaimingInstant;
  const instantDisabled = collectDisabled || instantCooling;

  const instantColors: readonly [string, string] =
    instantLocked || instantCooling ? ['#4a4a6a', '#3a3a5a'] : ['#8b5cf6', '#6d28d9'];

  return (
    <View style={styles.card}>
      <LinearGradient colors={cardColors} style={styles.gradient}>
        <View style={styles.header}>
          <Ionicons name="time" size={22} color={COLORS.gold.light} />
          <Text style={styles.title}>Idle Rewards</Text>
        </View>

        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>Time Elapsed</Text>
          <Text style={styles.timer}>{formatIdleTime(elapsed, maxHours)}</Text>
          <Text style={styles.capText}>Max: {maxHours}h {isCapped ? '• FULL' : ''}</Text>
        </View>

        <View style={styles.pendingRow}>
          <Ionicons name="star" size={18} color={COLORS.gold.primary} />
          <Text style={styles.pendingText}>
            +{(idleStatus?.gold_pending ?? 0).toLocaleString()} Gold Pending
          </Text>
        </View>

        <View style={styles.buttonRow}>
          {/* Collect */}
          <TouchableOpacity style={[styles.btnWrap, { flex: 1 }]} onPress={onCollect} disabled={collectDisabled}>
            <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark] as const} style={styles.btn}>
              {isClaimingCollect ? (
                <ActivityIndicator color={COLORS.navy.dark} size="small" />
              ) : (
                <>
                  <Ionicons name="download" size={18} color={COLORS.navy.dark} />
                  <Text style={[styles.btnText, { color: COLORS.navy.dark }]}>Collect</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Instant */}
          <TouchableOpacity
            style={[styles.btnWrap, { flex: 1, marginLeft: SPACING.sm, opacity: instantLocked || instantCooling ? 0.6 : 1 }]}
            onPress={() => {
              if (instantLocked) return onVipLockedPress();
              onInstant();
            }}
            disabled={instantDisabled}
          >
            <LinearGradient colors={instantColors} style={styles.btn}>
              {isClaimingInstant ? (
                <ActivityIndicator color={COLORS.cream.pure} size="small" />
              ) : instantLocked ? (
                <>
                  <Ionicons name="lock-closed" size={16} color={COLORS.cream.soft} />
                  <Text style={[styles.btnText, { color: COLORS.cream.soft, fontSize: 11 }]}>VIP 1+</Text>
                </>
              ) : instantCooling ? (
                <>
                  <Ionicons name="time" size={16} color={COLORS.cream.soft} />
                  <Text style={[styles.btnText, { color: COLORS.cream.soft, fontSize: 11 }]}>
                    {formatCooldown(instantCooldown)}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="flash" size={18} color={COLORS.cream.pure} />
                  <Text style={[styles.btnText, { color: COLORS.cream.pure }]}>⚡ Instant</Text>
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
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  gradient: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.navy.light,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: {
    color: COLORS.cream.pure,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  timerBox: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timerLabel: { color: COLORS.cream.soft, fontSize: FONT_SIZE.sm },
  timer: {
    marginTop: SPACING.xs,
    color: COLORS.cream.pure,
    fontSize: 22,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1,
  },
  capText: { marginTop: SPACING.xs, color: COLORS.gold.light, fontSize: FONT_SIZE.xs },
  pendingRow: { marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  pendingText: { color: COLORS.cream.pure, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  buttonRow: { marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center' },
  btnWrap: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  btn: {
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  btnText: { fontWeight: FONT_WEIGHT.bold },
});
