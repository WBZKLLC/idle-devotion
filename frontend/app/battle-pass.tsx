import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { useHasEntitlement } from '../lib/entitlements/gating';
import { ENTITLEMENT_KEYS } from '../lib/entitlements/types';
import { goToPaywall } from '../lib/entitlements/navigation';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

/**
 * Battle Pass Screen
 * 
 * NOTE: has_premium_ui (from VIP level) is for PREVIEW purposes only.
 * Actual premium claims are gated by PREMIUM entitlement on the server.
 * 
 * UI State vs Entitlement Truth:
 * - has_premium_ui: VIP level >= 5 (client-side preview)
 * - hasPremiumEntitlement: Server-authoritative PREMIUM entitlement
 * 
 * The server enforces the real entitlement check on claim requests.
 * Client UI is best-effort and may show "premium" even without real entitlement.
 */

// NOTE: Battle Pass currently uses mock data - no API calls needed yet

interface PassReward {
  tier: number;
  free_reward: { type: string; amount: number };
  premium_reward: { type: string; amount: number };
  claimed_free: boolean;
  claimed_premium: boolean;
}

const PASS_REWARDS: PassReward[] = Array.from({ length: 50 }, (_, i) => ({
  tier: i + 1,
  free_reward: { type: i % 5 === 0 ? 'gems' : i % 3 === 0 ? 'gold' : 'coins', amount: (i + 1) * (i % 5 === 0 ? 50 : 1000) },
  premium_reward: { type: i % 10 === 0 ? 'hero_ticket' : i % 5 === 0 ? 'crystals' : 'gems', amount: i % 10 === 0 ? 1 : (i + 1) * 100 },
  claimed_free: false,
  claimed_premium: false,
}));

export default function BattlePassScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [passData, setPassData] = useState<any>(null);
  const [rewards, setRewards] = useState<PassReward[]>(PASS_REWARDS);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (hydrated && user) {
      loadPassData();
    }
  }, [hydrated, user?.username]);

  const loadPassData = async () => {
    setLoading(true);
    try {
      // Simulate loading pass data - in production, fetch from API
      await new Promise(r => setTimeout(r, 500));
      setPassData({
        season: 1,
        season_name: 'Divine Awakening',
        current_tier: Math.min(50, Math.floor((user?.level || 1) * 1.5)),
        current_xp: 750,
        xp_per_tier: 1000,
        has_premium: user?.vip_level >= 5,
        days_remaining: 28,
        total_tiers: 50,
      });
    } catch (error) {
      console.error('Error loading pass:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (tier: number, isPremium: boolean) => {
    if (!passData) return;
    if (tier > passData.current_tier) {
      Alert.alert('Locked', `Reach tier ${tier} to claim this reward`);
      return;
    }
    
    // For premium claims, show informational message and route to paywall if needed
    // Note: Server enforces actual PREMIUM entitlement check
    if (isPremium && !passData.has_premium) {
      Alert.alert(
        'Premium Pass Required', 
        'Upgrade to Premium Pass to claim premium rewards.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Premium', onPress: () => router.push('/paid-features') },
        ]
      );
      return;
    }

    const reward = rewards.find(r => r.tier === tier);
    if (!reward) return;
    
    if (isPremium && reward.claimed_premium) return;
    if (!isPremium && reward.claimed_free) return;

    // Update local state
    setRewards(prev => prev.map(r => 
      r.tier === tier 
        ? { ...r, [isPremium ? 'claimed_premium' : 'claimed_free']: true }
        : r
    ));

    const rewardData = isPremium ? reward.premium_reward : reward.free_reward;
    Alert.alert('Claimed!', `+${rewardData.amount} ${rewardData.type.replace('_', ' ')}`);
  };

  const claimAll = () => {
    if (!passData) return;
    let claimed = 0;
    
    rewards.forEach(reward => {
      if (reward.tier <= passData.current_tier) {
        if (!reward.claimed_free) claimed++;
        if (passData.has_premium && !reward.claimed_premium) claimed++;
      }
    });

    if (claimed === 0) {
      Alert.alert('Nothing to Claim', 'All available rewards have been claimed');
      return;
    }

    setRewards(prev => prev.map(r => 
      r.tier <= passData.current_tier
        ? { ...r, claimed_free: true, claimed_premium: passData.has_premium ? true : r.claimed_premium }
        : r
    ));

    Alert.alert('Success!', `Claimed ${claimed} rewards!`);
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'gems': return '💎';
      case 'gold': return '⭐';
      case 'coins': return '🪙';
      case 'crystals': return '🔮';
      case 'hero_ticket': return '🎫';
      default: return '🎁';
    }
  };

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={['#1e1b4b', '#312e81', '#0a1628']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading Battle Pass...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={['#1e1b4b', '#312e81']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1e1b4b', '#312e81', '#0a1628']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🏆 Battle Pass</Text>
            <Text style={styles.seasonName}>Season {passData?.season}: {passData?.season_name}</Text>
          </View>
          <View style={styles.daysLeft}>
            <Text style={styles.daysText}>{passData?.days_remaining}d</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.tierDisplay}>
            <Text style={styles.tierLabel}>TIER</Text>
            <Text style={styles.tierValue}>{passData?.current_tier}</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarOuter}>
              <LinearGradient
                colors={['#8b5cf6', '#a78bfa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBarFill,
                  { width: `${((passData?.current_xp || 0) / (passData?.xp_per_tier || 1000)) * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {passData?.current_xp} / {passData?.xp_per_tier} XP
            </Text>
          </View>
        </View>

        {/* Premium Upgrade Banner */}
        {!passData?.has_premium && (
          <TouchableOpacity style={styles.upgradeBanner} onPress={() => setShowUpgradeModal(true)}>
            <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.upgradeGradient}>
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.upgradeText}>Upgrade to Premium Pass</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Claim All Button */}
        <TouchableOpacity style={styles.claimAllButton} onPress={claimAll}>
          <Text style={styles.claimAllText}>Claim All Available</Text>
        </TouchableOpacity>

        {/* Rewards Track */}
        <ScrollView horizontal style={styles.rewardsTrack} showsHorizontalScrollIndicator={false}>
          {rewards.map((reward) => (
            <View key={reward.tier} style={styles.rewardColumn}>
              <Text style={[
                styles.tierNumber,
                reward.tier <= (passData?.current_tier || 0) && styles.tierNumberUnlocked
              ]}>
                {reward.tier}
              </Text>
              
              {/* Premium Reward */}
              <TouchableOpacity
                style={[
                  styles.rewardBox,
                  styles.premiumBox,
                  !passData?.has_premium && styles.rewardLocked,
                  reward.claimed_premium && styles.rewardClaimed,
                ]}
                onPress={() => claimReward(reward.tier, true)}
                disabled={reward.claimed_premium}
              >
                {!passData?.has_premium && (
                  <View style={styles.lockIcon}>
                    <Ionicons name="lock-closed" size={12} color="#fff" />
                  </View>
                )}
                <Text style={styles.rewardIcon}>{getRewardIcon(reward.premium_reward.type)}</Text>
                <Text style={styles.rewardAmount}>{reward.premium_reward.amount}</Text>
                {reward.claimed_premium && <Text style={styles.claimedMark}>✓</Text>}
              </TouchableOpacity>

              {/* Progress Line */}
              <View style={[
                styles.progressLine,
                reward.tier <= (passData?.current_tier || 0) && styles.progressLineActive
              ]} />

              {/* Free Reward */}
              <TouchableOpacity
                style={[
                  styles.rewardBox,
                  styles.freeBox,
                  reward.tier > (passData?.current_tier || 0) && styles.rewardLocked,
                  reward.claimed_free && styles.rewardClaimed,
                ]}
                onPress={() => claimReward(reward.tier, false)}
                disabled={reward.claimed_free}
              >
                <Text style={styles.rewardIcon}>{getRewardIcon(reward.free_reward.type)}</Text>
                <Text style={styles.rewardAmount}>{reward.free_reward.amount}</Text>
                {reward.claimed_free && <Text style={styles.claimedMark}>✓</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.legendText}>Premium Track</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.navy.light }]} />
            <Text style={styles.legendText}>Free Track</Text>
          </View>
        </View>

        {/* Upgrade Modal */}
        <Modal visible={showUpgradeModal} transparent animationType="fade" onRequestClose={() => setShowUpgradeModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.upgradeModal}>
              <LinearGradient colors={['#1e1b4b', '#312e81']} style={styles.upgradeModalGradient}>
                <Text style={styles.upgradeModalTitle}>⭐ Premium Battle Pass</Text>
                <Text style={styles.upgradeModalDesc}>
                  Unlock the premium track and get exclusive rewards!
                </Text>
                
                <View style={styles.upgradeFeatures}>
                  <Text style={styles.upgradeFeature}>✓ 2x Rewards per Tier</Text>
                  <Text style={styles.upgradeFeature}>✓ Exclusive Premium Track</Text>
                  <Text style={styles.upgradeFeature}>✓ Bonus XP Gain (+20%)</Text>
                  <Text style={styles.upgradeFeature}>✓ Special Cosmetics</Text>
                </View>

                <TouchableOpacity style={styles.purchaseButton}>
                  <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.purchaseGradient}>
                    <Text style={styles.purchaseText}>$9.99</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeModalButton} onPress={() => setShowUpgradeModal(false)}>
                  <Text style={styles.closeModalText}>Maybe Later</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#8b5cf6', marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  loginBtn: { marginTop: 16, backgroundColor: '#8b5cf6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: '#fff', fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#8b5cf630' },
  backButton: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  seasonName: { fontSize: 12, color: '#a78bfa', marginTop: 2 },
  daysLeft: { backgroundColor: '#8b5cf640', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  daysText: { color: '#a78bfa', fontWeight: 'bold', fontSize: 12 },

  progressSection: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  tierDisplay: { alignItems: 'center', backgroundColor: '#8b5cf6', width: 60, paddingVertical: 8, borderRadius: 12 },
  tierLabel: { fontSize: 10, color: '#ffffffaa' },
  tierValue: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  progressBarContainer: { flex: 1 },
  progressBarOuter: { height: 16, backgroundColor: '#1e1b4b', borderRadius: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 8 },
  progressText: { fontSize: 11, color: COLORS.cream.dark, textAlign: 'right', marginTop: 4 },

  upgradeBanner: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  upgradeGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  upgradeText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  claimAllButton: { marginHorizontal: 16, backgroundColor: '#8b5cf6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  claimAllText: { color: '#fff', fontWeight: 'bold' },

  rewardsTrack: { flex: 1, paddingHorizontal: 16 },
  rewardColumn: { width: 70, alignItems: 'center', marginRight: 8 },
  tierNumber: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.dark, marginBottom: 8 },
  tierNumberUnlocked: { color: '#a78bfa' },
  
  rewardBox: { width: 60, height: 60, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  premiumBox: { backgroundColor: '#8b5cf640', borderWidth: 1, borderColor: '#8b5cf6' },
  freeBox: { backgroundColor: '#374151', borderWidth: 1, borderColor: '#4b5563' },
  rewardLocked: { opacity: 0.4 },
  rewardClaimed: { opacity: 0.6, backgroundColor: '#16653440' },
  lockIcon: { position: 'absolute', top: 4, right: 4, backgroundColor: '#00000060', borderRadius: 8, padding: 2 },
  rewardIcon: { fontSize: 20 },
  rewardAmount: { fontSize: 10, color: COLORS.cream.pure, fontWeight: '600', marginTop: 2 },
  claimedMark: { position: 'absolute', top: 4, left: 4, color: '#22c55e', fontSize: 12, fontWeight: 'bold' },
  
  progressLine: { width: 4, height: 16, backgroundColor: '#374151', borderRadius: 2 },
  progressLineActive: { backgroundColor: '#8b5cf6' },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#ffffff10' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: COLORS.cream.dark },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  upgradeModal: { width: '100%', maxWidth: 340, borderRadius: 20, overflow: 'hidden' },
  upgradeModalGradient: { padding: 24, alignItems: 'center' },
  upgradeModalTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 12 },
  upgradeModalDesc: { fontSize: 14, color: COLORS.cream.soft, textAlign: 'center', marginBottom: 20 },
  upgradeFeatures: { marginBottom: 24 },
  upgradeFeature: { fontSize: 14, color: COLORS.cream.pure, marginBottom: 8 },
  purchaseButton: { borderRadius: 12, overflow: 'hidden', width: '100%' },
  purchaseGradient: { paddingVertical: 16, alignItems: 'center' },
  purchaseText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  closeModalButton: { marginTop: 16 },
  closeModalText: { color: COLORS.cream.dark, fontSize: 14 },
});