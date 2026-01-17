// /app/frontend/app/idle.tsx
// Phase 3.31: Idle Rewards Screen
//
// Sanctuary screen for idle rewards with progress bar and claim.
// No timers/polling - event-driven refresh only.
// Uses canonical receipt for claims.
//
// Rates: Gold 120/hr, Stamina 6/hr, Gems 0/hr
// Cap: 8h default (VIP extensible)
//
// Tone: "Time works in your favor."

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

// Idle status type
interface IdleStatus {
  lastClaimAt: string | null;
  elapsedSeconds: number;
  capSeconds: number;
  capHours: number;
  pendingRewards: {
    gold: number;
    stamina: number;
    gems: number;
  };
  isCapped: boolean;
  isCollecting: boolean;
  rates: {
    gold: number;
    stamina: number;
    gems: number;
  };
}

// API functions
async function getIdleStatus(): Promise<IdleStatus> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/idle/status`, { headers });
  if (!res.ok) throw new Error('Failed to fetch idle status');
  return await res.json();
}

async function claimIdleRewards(): Promise<RewardReceipt> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/idle/claim`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to claim idle rewards');
  return await res.json();
}

// Format time display
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (hours >= 1) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export default function IdleScreen() {
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<IdleStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  
  const loadData = useCallback(async () => {
    try {
      const data = await getIdleStatus();
      setStatus(data);
      
      // Emit telemetry
      track(Events.IDLE_VIEWED, {
        elapsedSeconds: data.elapsedSeconds,
        isCapped: data.isCapped,
      });
      
      track(Events.IDLE_ELAPSED, {
        elapsedSeconds: data.elapsedSeconds,
        pendingGold: data.pendingRewards.gold,
        pendingStamina: data.pendingRewards.stamina,
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
    if (!status || status.pendingRewards.gold === 0) return;
    
    setClaiming(true);
    track(Events.IDLE_CLAIM_SUBMITTED, {});
    
    try {
      const receipt = await claimIdleRewards();
      
      if (isValidReceipt(receipt)) {
        if (receipt.alreadyClaimed) {
          track(Events.IDLE_CLAIM_ALREADY_CLAIMED, {});
          toast.info('Already claimed.');
        } else {
          track(Events.IDLE_CLAIM_SUCCESS, {
            itemCount: receipt.items.length,
            gold: receipt.items.find(i => i.type === 'gold')?.amount || 0,
          });
          toast.success(`Claimed: ${formatReceiptItems(receipt)}`);
          await fetchUser();
        }
      } else {
        toast.success('Claimed!');
      }
      
      triggerBadgeRefresh();
      loadData(); // Refresh status
    } catch (error) {
      toast.error('Not now.');
    } finally {
      setClaiming(false);
    }
  };
  
  // Calculate progress percentage
  const progressPercent = status 
    ? Math.min(100, (status.elapsedSeconds / status.capSeconds) * 100)
    : 0;
  
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
          <Text style={styles.authGateSubtitle}>Time works in your favor.</Text>
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
        <Text style={styles.headerTitle}>Idle Rewards</Text>
        <View style={styles.headerRight} />
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
        {/* Main Card */}
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={32} color={COLORS.gold.primary} />
            <Text style={styles.cardTitle}>Time Away</Text>
            <Text style={styles.cardSubtitle}>
              {status?.isCapped ? 'Collection capped!' : 'Rewards accumulating...'}
            </Text>
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progressPercent}%` },
                  status?.isCapped && styles.progressCapped
                ]} 
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressTime}>
                {formatTime(status?.elapsedSeconds || 0)}
              </Text>
              <Text style={styles.progressCap}>
                / {status?.capHours || 8}h cap
              </Text>
            </View>
          </View>
          
          {/* Pending Rewards */}
          <View style={styles.rewardsSection}>
            <Text style={styles.rewardsSectionTitle}>Pending Rewards</Text>
            
            <View style={styles.rewardRow}>
              <View style={[styles.rewardIcon, { backgroundColor: COLORS.gold.primary + '20' }]}>
                <Ionicons name="logo-usd" size={20} color={COLORS.gold.primary} />
              </View>
              <Text style={styles.rewardLabel}>Gold</Text>
              <Text style={styles.rewardAmount}>
                +{status?.pendingRewards.gold.toLocaleString() || 0}
              </Text>
              <Text style={styles.rewardRate}>({status?.rates.gold || 120}/hr)</Text>
            </View>
            
            <View style={styles.rewardRow}>
              <View style={[styles.rewardIcon, { backgroundColor: COLORS.violet.dark + '30' }]}>
                <Ionicons name="flash" size={20} color={COLORS.violet.light} />
              </View>
              <Text style={styles.rewardLabel}>Stamina</Text>
              <Text style={styles.rewardAmount}>
                +{status?.pendingRewards.stamina || 0}
              </Text>
              <Text style={styles.rewardRate}>({status?.rates.stamina || 6}/hr)</Text>
            </View>
          </View>
          
          {/* Claim Button */}
          <Pressable
            style={({ pressed }) => [
              styles.claimButton,
              (status?.pendingRewards.gold === 0) && styles.claimButtonDisabled,
              pressed && (status?.pendingRewards.gold || 0) > 0 && styles.pressed,
            ]}
            onPress={handleClaim}
            disabled={(status?.pendingRewards.gold === 0) || claiming}
          >
            {claiming ? (
              <ActivityIndicator size="small" color={COLORS.navy.darkest} />
            ) : (
              <Text style={[
                styles.claimButtonText,
                (status?.pendingRewards.gold === 0) && styles.claimButtonTextDisabled,
              ]}>
                {(status?.pendingRewards.gold || 0) > 0 ? 'Claim Rewards' : 'Nothing Yet'}
              </Text>
            )}
          </Pressable>
        </View>
        
        {/* Speed Up Placeholder */}
        <View style={styles.speedUpCard}>
          <View style={styles.speedUpHeader}>
            <Ionicons name="rocket" size={24} color={COLORS.cream.dark} />
            <Text style={styles.speedUpTitle}>Speed Up</Text>
          </View>
          <Text style={styles.speedUpSubtitle}>Coming Soon</Text>
          <Pressable style={styles.speedUpButton} disabled>
            <Text style={styles.speedUpButtonText}>Speed Up (Coming Soon)</Text>
          </Pressable>
        </View>
        
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How Idle Works</Text>
          <Text style={styles.infoText}>
            • Rewards accumulate while you're away{'\n'}
            • Cap resets when you claim{'\n'}
            • Higher VIP levels increase cap time{'\n'}
            • No gems from idle (baseline progression)
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
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: LAYOUT.SCREEN_PADDING,
    paddingBottom: 40,
    gap: 16,
  },
  mainCard: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '20',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 12,
    backgroundColor: COLORS.navy.darkest,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.gold.primary,
    borderRadius: 6,
  },
  progressCapped: {
    backgroundColor: COLORS.violet.light,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressTime: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
  },
  progressCap: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  rewardsSection: {
    marginBottom: 20,
  },
  rewardsSectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.dark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  rewardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.soft,
  },
  rewardAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.primary,
  },
  rewardRate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.cream.dark,
    marginLeft: 4,
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
    color: COLORS.cream.dark,
  },
  speedUpCard: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
    opacity: 0.6,
  },
  speedUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  speedUpTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.dark,
  },
  speedUpSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  speedUpButton: {
    backgroundColor: COLORS.navy.darkest,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  speedUpButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
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
