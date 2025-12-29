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
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

export default function BattlePassScreen() {
  const { user, fetchUser } = useGameStore();
  const [passData, setPassData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (user) {
      loadBattlePass();
    }
  }, [user]);

  const loadBattlePass = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/battle-pass/${user?.username}`
      );
      const data = await response.json();
      setPassData(data);
    } catch (error) {
      console.error('Failed to load battle pass:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const claimReward = async (track: string, level: number) => {
    setIsClaiming(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/battle-pass/${user?.username}/claim/${track}/${level}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          'Reward Claimed!',
          `+${result.reward_amount.toLocaleString()} ${getRewardName(result.reward_type)}`
        );
        loadBattlePass();
        fetchUser();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to claim');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to claim reward');
    } finally {
      setIsClaiming(false);
    }
  };

  const purchasePass = async (tier: string) => {
    Alert.alert(
      'Purchase Battle Pass',
      `Purchase ${tier === 'premium_plus' ? 'Premium+ Pass' : 'Premium Pass'} for $${tier === 'premium_plus' ? '19.99' : '9.99'}?\n\n(Simulated - no real payment)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/battle-pass/${user?.username}/purchase?tier=${tier}`,
                { method: 'POST' }
              );
              
              if (response.ok) {
                Alert.alert('Success!', 'Battle Pass purchased! Enjoy your premium rewards!');
                loadBattlePass();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'Purchase failed');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to purchase');
            }
          }
        }
      ]
    );
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'crystals': return 'diamond';
      case 'coins': return 'cash';
      case 'gold': return 'star';
      case 'divine_essence': return 'sparkles';
      default: return 'gift';
    }
  };

  const getRewardColor = (type: string) => {
    switch (type) {
      case 'crystals': return COLORS.rarity['UR+'];
      case 'coins': return COLORS.gold.light;
      case 'gold': return COLORS.gold.primary;
      case 'divine_essence': return COLORS.rarity.UR;
      default: return COLORS.cream.soft;
    }
  };

  const getRewardName = (type: string) => {
    switch (type) {
      case 'crystals': return 'Crystals';
      case 'coins': return 'Coins';
      case 'gold': return 'Gold';
      case 'divine_essence': return 'Divine Essence';
      default: return type;
    }
  };

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Battle Pass</Text>
          <Text style={styles.season}>Season {passData?.season || 1}</Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.gold.primary} style={styles.loader} />
          ) : (
            <>
              {/* Level Progress */}
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.levelCard}
              >
                <View style={styles.levelHeader}>
                  <Text style={styles.levelLabel}>Level</Text>
                  <Text style={styles.levelValue}>{passData?.level || 1}</Text>
                </View>
                <View style={styles.xpBar}>
                  <View 
                    style={[
                      styles.xpFill, 
                      { width: `${((passData?.xp_in_level || 0) / (passData?.xp_to_next_level || 1000)) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.xpText}>
                  {passData?.xp_in_level || 0} / {passData?.xp_to_next_level || 1000} XP
                </Text>
              </LinearGradient>
              
              {/* Premium Status / Purchase */}
              {!passData?.is_premium ? (
                <View style={styles.purchaseSection}>
                  <Text style={styles.purchaseTitle}>Unlock Premium Rewards!</Text>
                  <View style={styles.purchaseButtons}>
                    <TouchableOpacity
                      style={styles.purchaseButton}
                      onPress={() => purchasePass('premium')}
                    >
                      <LinearGradient
                        colors={[COLORS.rarity.SSR, COLORS.rarity.UR]}
                        style={styles.purchaseGradient}
                      >
                        <Text style={styles.purchaseButtonTitle}>Premium</Text>
                        <Text style={styles.purchaseButtonPrice}>$9.99</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.purchaseButton}
                      onPress={() => purchasePass('premium_plus')}
                    >
                      <LinearGradient
                        colors={[COLORS.gold.primary, COLORS.rarity['UR+']]}
                        style={styles.purchaseGradient}
                      >
                        <Text style={styles.purchaseButtonTitle}>Premium+</Text>
                        <Text style={styles.purchaseButtonSubtitle}>+10 Levels</Text>
                        <Text style={styles.purchaseButtonPrice}>$19.99</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.premiumText}>Premium Active</Text>
                </View>
              )}
              
              {/* Rewards Track */}
              <View style={styles.rewardsSection}>
                <View style={styles.trackHeader}>
                  <Text style={styles.trackTitle}>Free Track</Text>
                  <Text style={styles.trackTitle}>Premium Track</Text>
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.rewardsTrack}>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(level => {
                      const freeReward = passData?.free_rewards?.find((r: any) => r.level === level);
                      const premiumReward = passData?.premium_rewards?.find((r: any) => r.level === level);
                      const isCurrentLevel = level === passData?.level;
                      
                      return (
                        <View key={level} style={styles.rewardColumn}>
                          {/* Level indicator */}
                          <View style={[
                            styles.levelIndicator,
                            isCurrentLevel && styles.levelIndicatorCurrent,
                            level <= (passData?.level || 1) && styles.levelIndicatorPast
                          ]}>
                            <Text style={styles.levelIndicatorText}>{level}</Text>
                          </View>
                          
                          {/* Free reward */}
                          {freeReward ? (
                            <TouchableOpacity
                              style={[
                                styles.rewardCard,
                                freeReward.claimed && styles.rewardClaimed,
                                freeReward.available && styles.rewardAvailable,
                              ]}
                              onPress={() => freeReward.available ? claimReward('free', level) : null}
                              disabled={!freeReward.available || isClaiming}
                            >
                              <Ionicons 
                                name={getRewardIcon(freeReward.reward_type) as any} 
                                size={20} 
                                color={getRewardColor(freeReward.reward_type)} 
                              />
                              <Text style={styles.rewardAmount}>{freeReward.reward_amount}</Text>
                              {freeReward.claimed && (
                                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} style={styles.claimedIcon} />
                              )}
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.emptyReward} />
                          )}
                          
                          {/* Premium reward */}
                          {premiumReward ? (
                            <TouchableOpacity
                              style={[
                                styles.rewardCard,
                                styles.premiumRewardCard,
                                premiumReward.claimed && styles.rewardClaimed,
                                premiumReward.available && styles.rewardAvailable,
                                premiumReward.locked && !passData?.is_premium && styles.rewardLocked,
                              ]}
                              onPress={() => premiumReward.available ? claimReward('premium', level) : null}
                              disabled={!premiumReward.available || isClaiming}
                            >
                              <Ionicons 
                                name={getRewardIcon(premiumReward.reward_type) as any} 
                                size={20} 
                                color={getRewardColor(premiumReward.reward_type)} 
                              />
                              <Text style={styles.rewardAmount}>{premiumReward.reward_amount}</Text>
                              {premiumReward.claimed && (
                                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} style={styles.claimedIcon} />
                              )}
                              {!passData?.is_premium && (
                                <Ionicons name="lock-closed" size={14} color={COLORS.navy.light} style={styles.lockIcon} />
                              )}
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.emptyReward} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  season: { fontSize: 14, color: COLORS.gold.primary, textAlign: 'center', marginBottom: 16 },
  loader: { marginTop: 40 },
  levelCard: { borderRadius: 16, padding: 20, marginBottom: 20 },
  levelHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  levelLabel: { fontSize: 14, color: COLORS.navy.dark, marginRight: 8 },
  levelValue: { fontSize: 36, fontWeight: 'bold', color: COLORS.navy.darkest },
  xpBar: { height: 8, backgroundColor: COLORS.navy.darkest + '40', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  xpFill: { height: '100%', backgroundColor: COLORS.navy.darkest, borderRadius: 4 },
  xpText: { fontSize: 12, color: COLORS.navy.dark, textAlign: 'center' },
  purchaseSection: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  purchaseTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 16 },
  purchaseButtons: { flexDirection: 'row', gap: 12 },
  purchaseButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  purchaseGradient: { padding: 16, alignItems: 'center' },
  purchaseButtonTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  purchaseButtonSubtitle: { fontSize: 12, color: COLORS.cream.soft },
  purchaseButtonPrice: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold.primary + '20', padding: 12, borderRadius: 12, marginBottom: 20, gap: 8 },
  premiumText: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold.primary },
  rewardsSection: { marginTop: 8 },
  trackHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 30 },
  trackTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.soft },
  rewardsTrack: { flexDirection: 'row' },
  rewardColumn: { width: 70, alignItems: 'center', marginRight: 8 },
  levelIndicator: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.navy.medium, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  levelIndicatorCurrent: { backgroundColor: COLORS.gold.primary, transform: [{ scale: 1.2 }] },
  levelIndicatorPast: { backgroundColor: COLORS.success },
  levelIndicatorText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  rewardCard: { width: 60, height: 60, backgroundColor: COLORS.navy.medium, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: COLORS.navy.light },
  premiumRewardCard: { backgroundColor: COLORS.gold.dark + '30', borderColor: COLORS.gold.dark },
  rewardClaimed: { opacity: 0.5 },
  rewardAvailable: { borderColor: COLORS.gold.primary, borderWidth: 2 },
  rewardLocked: { opacity: 0.4 },
  emptyReward: { width: 60, height: 60, marginBottom: 8 },
  rewardAmount: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 2 },
  claimedIcon: { position: 'absolute', top: 2, right: 2 },
  lockIcon: { position: 'absolute', bottom: 2, right: 2 },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
