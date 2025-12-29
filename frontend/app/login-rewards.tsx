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
import { router } from 'expo-router';

export default function LoginRewardsScreen() {
  const { user, fetchUser, _hasHydrated } = useGameStore();
  const [rewards, setRewards] = useState<any[]>([]);
  const [loginDays, setLoginDays] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (_hasHydrated && user) {
      loadRewards();
    } else if (_hasHydrated && !user) {
      setIsLoading(false);
    }
  }, [_hasHydrated, user]);

  const loadRewards = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/login-rewards/${user?.username}`
      );
      const data = await response.json();
      setRewards(data.rewards || []);
      setLoginDays(data.login_days || 0);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const claimReward = async (day: number) => {
    setIsClaiming(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/login-rewards/${user?.username}/claim/${day}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          result.is_bonus ? '🎉 Bonus Reward!' : 'Reward Claimed!',
          `+${result.reward_amount.toLocaleString()} ${getRewardName(result.reward_type)}`
        );
        loadRewards();
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
          <Text style={styles.title}>Daily Login Rewards</Text>
          
          <LinearGradient
            colors={[COLORS.gold.primary, COLORS.gold.dark]}
            style={styles.streakCard}
          >
            <Ionicons name="calendar" size={32} color={COLORS.navy.darkest} />
            <View style={styles.streakInfo}>
              <Text style={styles.streakLabel}>Login Streak</Text>
              <Text style={styles.streakValue}>{loginDays} Days</Text>
            </View>
          </LinearGradient>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.gold.primary} style={styles.loader} />
          ) : (
            <View style={styles.calendarGrid}>
              {rewards.map((reward, index) => {
                const isWeek = reward.day % 7 === 0;
                return (
                  <TouchableOpacity
                    key={reward.day}
                    style={[
                      styles.rewardCard,
                      reward.claimed && styles.rewardClaimed,
                      reward.available && styles.rewardAvailable,
                      reward.locked && styles.rewardLocked,
                      reward.bonus && styles.rewardBonus,
                    ]}
                    onPress={() => reward.available ? claimReward(reward.day) : null}
                    disabled={!reward.available || isClaiming}
                  >
                    {reward.bonus && (
                      <View style={styles.bonusBadge}>
                        <Text style={styles.bonusText}>BONUS</Text>
                      </View>
                    )}
                    
                    <Text style={styles.dayText}>Day {reward.day}</Text>
                    
                    <View style={[styles.iconContainer, { backgroundColor: getRewardColor(reward.reward_type) + '30' }]}>
                      <Ionicons 
                        name={getRewardIcon(reward.reward_type) as any} 
                        size={24} 
                        color={getRewardColor(reward.reward_type)} 
                      />
                    </View>
                    
                    <Text style={styles.rewardAmount}>{reward.reward_amount.toLocaleString()}</Text>
                    <Text style={styles.rewardType}>{getRewardName(reward.reward_type)}</Text>
                    
                    {reward.claimed && (
                      <View style={styles.claimedOverlay}>
                        <Ionicons name="checkmark-circle" size={32} color={COLORS.success} />
                      </View>
                    )}
                    
                    {reward.locked && (
                      <View style={styles.lockedOverlay}>
                        <Ionicons name="lock-closed" size={24} color={COLORS.navy.light} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.gold.primary} />
            <Text style={styles.infoText}>
              Log in daily to earn rewards! Bonus rewards on days 7, 14, 21, and 28!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 16 },
  streakCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  streakInfo: { marginLeft: 16 },
  streakLabel: { fontSize: 14, color: COLORS.navy.dark },
  streakValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.navy.darkest },
  loader: { marginTop: 40 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  rewardCard: { width: '23%', aspectRatio: 0.7, backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 8, marginBottom: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.navy.light },
  rewardClaimed: { opacity: 0.5 },
  rewardAvailable: { borderColor: COLORS.gold.primary, borderWidth: 2 },
  rewardLocked: { opacity: 0.4 },
  rewardBonus: { backgroundColor: COLORS.gold.dark + '30', borderColor: COLORS.gold.primary },
  bonusBadge: { position: 'absolute', top: -6, backgroundColor: COLORS.gold.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  bonusText: { fontSize: 8, fontWeight: 'bold', color: COLORS.navy.darkest },
  dayText: { fontSize: 10, color: COLORS.cream.dark, marginBottom: 4 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  rewardAmount: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.pure },
  rewardType: { fontSize: 8, color: COLORS.cream.dark },
  claimedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  lockedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, padding: 16, borderRadius: 12, marginTop: 16, gap: 12, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  infoText: { flex: 1, color: COLORS.cream.soft, fontSize: 13, lineHeight: 18 },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
