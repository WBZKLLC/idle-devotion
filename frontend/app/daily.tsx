// /app/frontend/app/daily.tsx
// Phase 3.32: Daily Login Rewards Screen
//
// Sanctuary screen for 7-day login calendar loop.
// Uses canonical receipt for claims. Idempotent.
// No timers/polling - event-driven refresh only.
//
// Tone: "Your daily blessing awaits."

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';
import { haptic, PRESS } from '../lib/ui/interaction';
import { useGameStore, useHydration } from '../stores/gameStore';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { toast } from '../components/ui/Toast';
import { track, Events } from '../lib/telemetry/events';
import { RewardReceipt, isValidReceipt, formatReceiptItems } from '../lib/types/receipt';
import { triggerBadgeRefresh } from '../lib/ui/badges';
import { loadAuthToken } from '../lib/authStorage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// Auth header helper
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await loadAuthToken();
  if (!token) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Daily status type
interface DayReward {
  type: string;
  amount: number;
}

interface CalendarDay {
  day: number;
  rewards: DayReward[];
  isCurrent: boolean;
  isClaimable: boolean;
  isClaimed: boolean;
}

interface DailyStatus {
  currentDay: number;
  claimedToday: boolean;
  nextResetAt: string;
  streak: number;
  calendar: CalendarDay[];
}

// API functions
async function getDailyStatus(): Promise<DailyStatus> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/daily/status`, { headers });
  if (!res.ok) throw new Error('Failed to fetch daily status');
  return await res.json();
}

async function claimDailyReward(): Promise<RewardReceipt> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/daily/claim`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to claim daily reward');
  return await res.json();
}

// Format reward text
function formatRewards(rewards: DayReward[]): string {
  return rewards.map(r => `${r.amount} ${r.type}`).join(' + ');
}

export default function DailyScreen() {
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  
  const loadData = useCallback(async () => {
    try {
      const data = await getDailyStatus();
      setStatus(data);
      
      // Emit telemetry
      track(Events.DAILY_VIEWED, {
        currentDay: data.currentDay,
        claimedToday: data.claimedToday,
        streak: data.streak,
      });
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    if (hydrated && user) {
      loadData();
    } else if (hydrated && !user) {
      setLoading(false);
    }
  }, [hydrated, user, loadData]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);
  
  const handleClaim = async () => {
    if (!status || status.claimedToday) return;
    
    setClaiming(true);
    track(Events.DAILY_CLAIM_SUBMITTED, { currentDay: status.currentDay });
    
    try {
      const receipt = await claimDailyReward();
      
      if (isValidReceipt(receipt)) {
        if (receipt.alreadyClaimed) {
          track(Events.DAILY_CLAIM_ALREADY_CLAIMED, {});
          toast.info('Already claimed today.');
        } else {
          track(Events.DAILY_CLAIM_SUCCESS, {
            currentDay: status.currentDay,
            itemCount: receipt.items.length,
          });
          toast.success(`Day ${status.currentDay} claimed: ${formatReceiptItems(receipt)}`);
          await fetchUser();
        }
      } else {
        toast.success('Claimed!');
      }
      
      triggerBadgeRefresh();
      loadData(); // Refresh status
    } catch (error) {
      track(Events.DAILY_CLAIM_ERROR, { error: String(error) });
      toast.error('Not now.');
    } finally {
      setClaiming(false);
    }
  };
  
  // Loading state
  if (!hydrated || (loading && user)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Auth gate
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.authGate}>
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.authGateTitle}>Sign in required</Text>
          <Text style={styles.authGateSubtitle}>Your daily blessing awaits.</Text>
          <View style={styles.authGateButton}>
            <PrimaryButton 
              title="Go to Login" 
              onPress={() => router.push('/')} 
              variant="gold" 
              size="md" 
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => { haptic('light'); router.back(); }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
        </Pressable>
        <Text style={styles.headerTitle}>Daily Login</Text>
        <View style={styles.headerRight}>
          {status?.streak && status.streak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={14} color={COLORS.gold.primary} />
              <Text style={styles.streakBadgeText}>{status.streak}</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold.primary}
          />
        }
      >
        {/* Current Day Card */}
        {status && (
          <View style={styles.currentDayCard}>
            <View style={styles.currentDayHeader}>
              <Ionicons name="calendar" size={32} color={COLORS.gold.primary} />
              <Text style={styles.currentDayTitle}>Day {status.currentDay}</Text>
              <Text style={styles.currentDaySubtitle}>
                {status.claimedToday ? 'Claimed!' : 'Ready to claim'}
              </Text>
            </View>
            
            {/* Today's Rewards */}
            {status.calendar.find(d => d.isCurrent) && (
              <View style={styles.rewardsPreview}>
                {status.calendar.find(d => d.isCurrent)?.rewards.map((reward, i) => (
                  <View key={i} style={styles.rewardTag}>
                    <Ionicons 
                      name={reward.type === 'gold' ? 'logo-usd' : reward.type === 'gems' ? 'diamond' : 'flash'}
                      size={14}
                      color={COLORS.gold.primary}
                    />
                    <Text style={styles.rewardTagText}>{reward.amount} {reward.type}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Claim Button */}
            <Pressable
              style={({ pressed }) => [
                styles.claimButton,
                status.claimedToday && styles.claimButtonDisabled,
                pressed && !status.claimedToday && styles.pressed,
              ]}
              onPress={handleClaim}
              disabled={status.claimedToday || claiming}
            >
              {claiming ? (
                <ActivityIndicator size="small" color={COLORS.navy.darkest} />
              ) : (
                <Text style={[
                  styles.claimButtonText,
                  status.claimedToday && styles.claimButtonTextDisabled,
                ]}>
                  {status.claimedToday ? 'Claimed Today ✓' : 'Claim Reward'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
        
        {/* Calendar Grid */}
        {status && (
          <View style={styles.calendarSection}>
            <Text style={styles.calendarTitle}>7-Day Calendar</Text>
            <View style={styles.calendarGrid}>
              {status.calendar.map((day) => (
                <View 
                  key={day.day}
                  style={[
                    styles.calendarDay,
                    day.isCurrent && styles.calendarDayCurrent,
                    day.isClaimed && styles.calendarDayClaimed,
                  ]}
                >
                  <Text style={[
                    styles.calendarDayNumber,
                    day.isCurrent && styles.calendarDayNumberCurrent,
                  ]}>
                    {day.day}
                  </Text>
                  <View style={styles.calendarDayRewards}>
                    {day.rewards.slice(0, 2).map((r, i) => (
                      <Ionicons 
                        key={i}
                        name={r.type === 'gold' ? 'logo-usd' : r.type === 'gems' ? 'diamond' : 'flash'}
                        size={12}
                        color={day.isClaimed ? COLORS.cream.dark : COLORS.gold.primary}
                      />
                    ))}
                  </View>
                  {day.isClaimed && (
                    <Ionicons 
                      name="checkmark-circle" 
                      size={16} 
                      color={COLORS.cream.dark}
                      style={styles.calendarDayCheck}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            • Claim once per day{'\n'}
            • Rewards cycle every 7 days{'\n'}
            • Day 7 is the bonus day{'\n'}
            • Resets at midnight UTC
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
  },
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    gap: 12,
  },
  authGateTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginTop: 8,
  },
  authGateSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  authGateButton: {
    marginTop: 16,
    width: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '08',
  },
  backButton: {
    padding: 4,
    borderRadius: RADIUS.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    letterSpacing: 0.5,
  },
  headerRight: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '40',
  },
  streakBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.primary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: LAYOUT.SCREEN_PADDING,
    paddingBottom: 40,
    gap: 16,
  },
  currentDayCard: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '30',
  },
  currentDayHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  currentDayTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gold.primary,
    marginTop: 8,
  },
  currentDaySubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  rewardsPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  rewardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '30',
  },
  rewardTagText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gold.light,
  },
  claimButton: {
    backgroundColor: COLORS.gold.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  claimButtonDisabled: {
    backgroundColor: COLORS.navy.darkest,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '15',
  },
  claimButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.navy.darkest,
  },
  claimButtonTextDisabled: {
    color: COLORS.cream.soft,
  },
  calendarSection: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  calendarTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.dark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  calendarDay: {
    width: '13%',
    aspectRatio: 1,
    backgroundColor: COLORS.navy.darkest,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
    position: 'relative',
  },
  calendarDayCurrent: {
    borderColor: COLORS.gold.primary,
    borderWidth: 2,
  },
  calendarDayClaimed: {
    opacity: 0.5,
  },
  calendarDayNumber: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.soft,
  },
  calendarDayNumberCurrent: {
    color: COLORS.gold.primary,
  },
  calendarDayRewards: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  calendarDayCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  infoSection: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  infoTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.soft,
    marginBottom: 8,
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    lineHeight: 20,
  },
  pressed: {
    opacity: PRESS.OPACITY,
    transform: [{ scale: PRESS.SCALE }],
  },
});
