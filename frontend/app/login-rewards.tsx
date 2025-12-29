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
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { router } from 'expo-router';

const MONTHS = ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'];
const DAYS_PER_MONTH = 30;

export default function LoginRewardsScreen() {
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  const [rewards, setRewards] = useState<any[]>([]);
  const [loginDays, setLoginDays] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (hydrated && user) {
      loadRewards();
    } else if (hydrated && !user) {
      setIsLoading(false);
    }
  }, [hydrated, user]);

  // Auto-select current month based on login days
  useEffect(() => {
    if (loginDays > 0) {
      const month = Math.min(Math.ceil(loginDays / DAYS_PER_MONTH), 6);
      setCurrentMonth(month);
    }
  }, [loginDays]);

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
      case 'summon_tickets': return 'ticket';
      default: return 'gift';
    }
  };

  const getRewardColor = (type: string) => {
    switch (type) {
      case 'crystals': return COLORS.rarity['UR+'];
      case 'coins': return COLORS.gold.light;
      case 'gold': return COLORS.gold.primary;
      case 'divine_essence': return COLORS.rarity.UR;
      case 'summon_tickets': return '#4dabf7';
      default: return COLORS.cream.soft;
    }
  };

  const getRewardName = (type: string) => {
    switch (type) {
      case 'crystals': return 'Crystals';
      case 'coins': return 'Coins';
      case 'gold': return 'Gold';
      case 'divine_essence': return 'Divine Essence';
      case 'summon_tickets': return 'Summon Tickets';
      default: return type;
    }
  };

  // Get rewards for current month
  const getMonthRewards = () => {
    const startDay = (currentMonth - 1) * DAYS_PER_MONTH + 1;
    const endDay = currentMonth * DAYS_PER_MONTH;
    return rewards.filter(r => r.day >= startDay && r.day <= endDay);
  };

  // Count available rewards
  const availableCount = rewards.filter(r => r.available).length;

  if (!_hasHydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/')}>
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const monthRewards = getMonthRewards();

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.title}>Login Rewards</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Streak Card */}
          <LinearGradient
            colors={[COLORS.gold.primary, COLORS.gold.dark]}
            style={styles.streakCard}
          >
            <View style={styles.streakLeft}>
              <Ionicons name="calendar" size={36} color={COLORS.navy.darkest} />
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakLabel}>Login Streak</Text>
              <Text style={styles.streakValue}>{loginDays} / 180 Days</Text>
              <View style={styles.progressBarOuter}>
                <View style={[styles.progressBarFill, { width: `${(loginDays / 180) * 100}%` }]} />
              </View>
            </View>
            {availableCount > 0 && (
              <View style={styles.availableBadge}>
                <Text style={styles.availableBadgeText}>{availableCount}</Text>
              </View>
            )}
          </LinearGradient>
          
          {/* Month Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthTabs}>
            {MONTHS.map((month, index) => {
              const monthNum = index + 1;
              const isUnlocked = loginDays >= (index * DAYS_PER_MONTH);
              const hasAvailable = rewards.some(
                r => r.day > index * DAYS_PER_MONTH && r.day <= (index + 1) * DAYS_PER_MONTH && r.available
              );
              
              return (
                <TouchableOpacity
                  key={monthNum}
                  style={[
                    styles.monthTab,
                    currentMonth === monthNum && styles.monthTabActive,
                    !isUnlocked && styles.monthTabLocked
                  ]}
                  onPress={() => isUnlocked ? setCurrentMonth(monthNum) : null}
                  disabled={!isUnlocked}
                >
                  {!isUnlocked && <Ionicons name="lock-closed" size={12} color={COLORS.navy.light} />}
                  <Text style={[
                    styles.monthTabText,
                    currentMonth === monthNum && styles.monthTabTextActive
                  ]}>
                    {month}
                  </Text>
                  {hasAvailable && <View style={styles.monthDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.gold.primary} style={styles.loader} />
          ) : (
            <>
              {/* Month Header */}
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{MONTHS[currentMonth - 1]}</Text>
                <Text style={styles.monthSubtitle}>
                  Days {(currentMonth - 1) * DAYS_PER_MONTH + 1} - {currentMonth * DAYS_PER_MONTH}
                </Text>
              </View>

              {/* Rewards Grid */}
              <View style={styles.calendarGrid}>
                {monthRewards.map((reward) => {
                  const dayInMonth = ((reward.day - 1) % DAYS_PER_MONTH) + 1;
                  const isWeekBonus = reward.day % 7 === 0;
                  const isMonthBonus = reward.day % 30 === 0;
                  const isMilestone = reward.day === 90 || reward.day === 180;
                  
                  return (
                    <TouchableOpacity
                      key={reward.day}
                      style={[
                        styles.rewardCard,
                        reward.claimed && styles.rewardClaimed,
                        reward.available && styles.rewardAvailable,
                        reward.locked && styles.rewardLocked,
                        (isWeekBonus || isMonthBonus || isMilestone) && styles.rewardBonus,
                        isMilestone && styles.rewardMilestone,
                      ]}
                      onPress={() => reward.available ? claimReward(reward.day) : null}
                      disabled={!reward.available || isClaiming}
                    >
                      {(isWeekBonus || isMonthBonus || isMilestone) && (
                        <View style={[
                          styles.bonusBadge,
                          isMilestone && styles.milestoneBadge
                        ]}>
                          <Text style={styles.bonusText}>
                            {isMilestone ? '★' : isMonthBonus ? '🎁' : '✓'}
                          </Text>
                        </View>
                      )}
                      
                      <Text style={styles.dayText}>Day {reward.day}</Text>
                      
                      <View style={[
                        styles.iconContainer, 
                        { backgroundColor: getRewardColor(reward.reward_type) + '30' }
                      ]}>
                        <Ionicons 
                          name={getRewardIcon(reward.reward_type) as any} 
                          size={20} 
                          color={getRewardColor(reward.reward_type)} 
                        />
                      </View>
                      
                      <Text style={styles.rewardAmount} numberOfLines={1}>
                        {reward.reward_amount >= 1000 
                          ? `${(reward.reward_amount / 1000).toFixed(reward.reward_amount % 1000 === 0 ? 0 : 1)}k`
                          : reward.reward_amount}
                      </Text>
                      <Text style={styles.rewardType} numberOfLines={1}>
                        {getRewardName(reward.reward_type)}
                      </Text>
                      
                      {reward.claimed && (
                        <View style={styles.claimedOverlay}>
                          <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
                        </View>
                      )}
                      
                      {reward.locked && (
                        <View style={styles.lockedOverlay}>
                          <Ionicons name="lock-closed" size={20} color={COLORS.navy.light} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          
          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.gold.primary} />
            <Text style={styles.infoText}>
              Log in daily for 6 months to unlock all rewards! 
              Weekly bonuses every 7 days, monthly bonuses every 30 days. 
              Special milestones at Day 90 and Day 180!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  placeholder: { width: 40 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 100 },
  
  // Streak Card
  streakCard: { 
    borderRadius: 16, 
    padding: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  streakLeft: { marginRight: 16 },
  streakInfo: { flex: 1 },
  streakLabel: { fontSize: 12, color: COLORS.navy.dark, marginBottom: 2 },
  streakValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.navy.darkest, marginBottom: 8 },
  progressBarOuter: { 
    height: 6, 
    backgroundColor: COLORS.navy.darkest + '40', 
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: COLORS.navy.darkest,
    borderRadius: 3,
  },
  availableBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.error,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.navy.darkest,
  },
  availableBadgeText: { 
    color: COLORS.cream.pure, 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  
  // Month Tabs
  monthTabs: { marginBottom: 16 },
  monthTab: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 20, 
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.navy.light,
  },
  monthTabActive: { 
    backgroundColor: COLORS.gold.primary,
    borderColor: COLORS.gold.primary,
  },
  monthTabLocked: { opacity: 0.5 },
  monthTabText: { fontSize: 14, fontWeight: '600', color: COLORS.cream.soft },
  monthTabTextActive: { color: COLORS.navy.darkest },
  monthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.error,
    marginLeft: 4,
  },
  
  // Month Header
  monthHeader: { marginBottom: 12 },
  monthTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  monthSubtitle: { fontSize: 12, color: COLORS.cream.dark },
  
  loader: { marginTop: 40 },
  
  // Calendar Grid - 5 columns for 30 days
  calendarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8,
  },
  rewardCard: { 
    width: '18.5%',
    aspectRatio: 0.75, 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 10, 
    padding: 6, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: COLORS.navy.light,
    position: 'relative',
  },
  rewardClaimed: { opacity: 0.6 },
  rewardAvailable: { 
    borderColor: COLORS.gold.primary, 
    borderWidth: 2,
    shadowColor: COLORS.gold.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  rewardLocked: { opacity: 0.4 },
  rewardBonus: { 
    backgroundColor: COLORS.gold.dark + '30', 
    borderColor: COLORS.gold.dark 
  },
  rewardMilestone: {
    backgroundColor: COLORS.rarity.UR + '30',
    borderColor: COLORS.rarity.UR,
    borderWidth: 2,
  },
  bonusBadge: { 
    position: 'absolute', 
    top: -6, 
    right: -4,
    backgroundColor: COLORS.gold.primary, 
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneBadge: {
    backgroundColor: COLORS.rarity.UR,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  bonusText: { fontSize: 8, fontWeight: 'bold', color: COLORS.navy.darkest },
  dayText: { fontSize: 8, color: COLORS.cream.dark, marginBottom: 2 },
  iconContainer: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 2 
  },
  rewardAmount: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  rewardType: { fontSize: 7, color: COLORS.cream.dark },
  claimedOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 10 
  },
  lockedOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 10 
  },
  
  // Info Box
  infoBox: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    backgroundColor: COLORS.navy.medium, 
    padding: 16, 
    borderRadius: 12, 
    marginTop: 20, 
    gap: 12, 
    borderWidth: 1, 
    borderColor: COLORS.gold.dark + '30' 
  },
  infoText: { flex: 1, color: COLORS.cream.soft, fontSize: 12, lineHeight: 18 },
  
  // Error/Login states
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
  loginButton: {
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  loginButtonText: {
    color: COLORS.navy.darkest,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
