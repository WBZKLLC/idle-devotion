import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  success: '#22c55e',
  warning: '#f59e0b',
  locked: '#6b7280',
};

const DAY_THEMES = [
  { color: '#22c55e', icon: 'sunny', name: 'The Awakening' },
  { color: '#3b82f6', icon: 'trending-up', name: 'Rising Power' },
  { color: '#f59e0b', icon: 'trophy', name: 'Arena Debut' },
  { color: '#8b5cf6', icon: 'shield', name: 'Guild Initiation' },
  { color: '#ec4899', icon: 'star', name: 'Advanced Training' },
  { color: '#ef4444', icon: 'flame', name: 'Event Horizon' },
  { color: COLORS.gold.primary, icon: 'diamond', name: 'Divine Ascension' },
];

export default function JourneyScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [journeyData, setJourneyData] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (hydrated && user) {
      loadJourneyData();
    }
  }, [hydrated, user?.username]);

  const loadJourneyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/journey/${user?.username}`
      );
      if (response.ok) {
        const data = await response.json();
        setJourneyData(data);
        // Auto-select current day
        setSelectedDay(data.current_day || 1);
      }
    } catch (error) {
      console.error('Error loading journey:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimLoginReward = async (day: number) => {
    if (!user || claiming) return;
    
    setClaiming(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/journey/${user.username}/claim-login?day=${day}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          `🎉 Day ${day} Rewards!`,
          formatRewardsText(data.rewards),
          [{ text: 'Awesome!' }]
        );
        await fetchUser();
        await loadJourneyData();
      } else {
        const error = await response.json();
        Alert.alert('Cannot Claim', error.detail || 'Unable to claim reward');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to claim reward');
    } finally {
      setClaiming(false);
    }
  };

  const formatRewardsText = (rewards: any) => {
    const lines = [];
    if (rewards.crystals) lines.push(`💎 ${rewards.crystals} Crystals`);
    if (rewards.gold) lines.push(`🪙 ${rewards.gold.toLocaleString()} Gold`);
    if (rewards.coins) lines.push(`💰 ${rewards.coins.toLocaleString()} Coins`);
    if (rewards.stamina) lines.push(`⚡ ${rewards.stamina} Stamina`);
    if (rewards.divine_essence) lines.push(`✨ ${rewards.divine_essence} Divine Essence`);
    if (rewards.skill_essence) lines.push(`📖 ${rewards.skill_essence} Skill Essence`);
    if (rewards.guild_coins) lines.push(`🛡️ ${rewards.guild_coins} Guild Coins`);
    if (rewards.arena_tickets) lines.push(`🎫 ${rewards.arena_tickets} Arena Tickets`);
    if (rewards.blood_crystals) lines.push(`🩸 ${rewards.blood_crystals} Blood Crystals`);
    if (rewards.guaranteed_ssr_selector) lines.push(`⭐ SSR HERO SELECTOR!`);
    return lines.join('\n');
  };

  const getRewardIcon = (key: string) => {
    const icons: Record<string, string> = {
      crystals: '💎',
      gold: '🪙',
      coins: '💰',
      stamina: '⚡',
      divine_essence: '✨',
      skill_essence: '📖',
      guild_coins: '🛡️',
      arena_tickets: '🎫',
      blood_crystals: '🩸',
      guaranteed_ssr_selector: '⭐',
      rune_stones: '💠',
      enhancement_stones: '🔨',
      sr_ticket: '🎫',
      ssr_shards: '💫',
      ur_shards: '🌟',
      hero_exp: '📈',
      pvp_medals: '🏅',
      awakening_stones: '💠',
      abyss_tokens: '🌀',
      legendary_shard: '👑',
      ssr_ticket: '🌟',
    };
    return icons[key] || '🎁';
  };

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading your journey...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentDay = journeyData?.current_day || 1;
  const accountAge = journeyData?.account_age_days || 1;

  return (
    <LinearGradient colors={[COLORS.navy.darkest, '#0f172a', COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>📜 First 7-Day Journey</Text>
            <Text style={styles.headerSubtitle}>Day {accountAge} of your adventure</Text>
          </View>
          <View style={styles.dayBadge}>
            <Text style={styles.dayBadgeText}>{currentDay}/7</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Progress Overview */}
          <View style={styles.progressCard}>
            <LinearGradient colors={[COLORS.gold.primary + '20', COLORS.navy.dark]} style={styles.progressGradient}>
              <Text style={styles.progressTitle}>🏆 Journey Progress</Text>
              <View style={styles.progressBarOuter}>
                <LinearGradient
                  colors={[COLORS.gold.dark, COLORS.gold.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${(Math.min(accountAge, 7) / 7) * 100}%` }]}
                />
              </View>
              <View style={styles.progressInfo}>
                <Text style={styles.progressText}>
                  {accountAge >= 7 ? '✨ Journey Complete!' : `${7 - accountAge} days remaining`}
                </Text>
                <Text style={styles.totalCrystals}>
                  💎 ~{journeyData?.total_journey_crystals?.toLocaleString() || '13,000'} total crystals
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* Day Selector */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.daySelector}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const dayData = journeyData?.days?.[day];
              const theme = DAY_THEMES[day - 1];
              const isUnlocked = dayData?.is_unlocked || accountAge >= day;
              const isCurrent = dayData?.is_current || currentDay === day;
              const isSelected = selectedDay === day;
              const isClaimed = dayData?.login_claimed;
              
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCard,
                    isSelected && styles.dayCardSelected,
                    !isUnlocked && styles.dayCardLocked,
                  ]}
                  onPress={() => isUnlocked && setSelectedDay(day)}
                  disabled={!isUnlocked}
                >
                  <LinearGradient
                    colors={isUnlocked ? [theme.color + '40', theme.color + '10'] : [COLORS.locked + '40', COLORS.locked + '10']}
                    style={styles.dayCardGradient}
                  >
                    <View style={[styles.dayNumber, { backgroundColor: isUnlocked ? theme.color : COLORS.locked }]}>
                      {isClaimed ? (
                        <Ionicons name="checkmark" size={16} color={COLORS.cream.pure} />
                      ) : (
                        <Text style={styles.dayNumberText}>{day}</Text>
                      )}
                    </View>
                    <Text style={[styles.dayName, !isUnlocked && styles.dayNameLocked]}>Day {day}</Text>
                    {isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>NOW</Text>
                      </View>
                    )}
                    {!isUnlocked && (
                      <Ionicons name="lock-closed" size={12} color={COLORS.locked} style={styles.lockIcon} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Selected Day Details */}
          {selectedDay && journeyData?.days?.[selectedDay] && (
            <View style={styles.dayDetails}>
              <LinearGradient
                colors={[DAY_THEMES[selectedDay - 1].color + '30', COLORS.navy.primary]}
                style={styles.dayDetailsGradient}
              >
                <View style={styles.dayDetailsHeader}>
                  <View style={[styles.dayIcon, { backgroundColor: DAY_THEMES[selectedDay - 1].color }]}>
                    <Ionicons name={DAY_THEMES[selectedDay - 1].icon as any} size={24} color={COLORS.cream.pure} />
                  </View>
                  <View style={styles.dayTitleContainer}>
                    <Text style={styles.dayTheme}>{DAY_THEMES[selectedDay - 1].name}</Text>
                    <Text style={styles.dayDescription}>
                      {journeyData.days[selectedDay].description || 'Begin your adventure!'}
                    </Text>
                  </View>
                </View>

                {/* Login Reward */}
                <View style={styles.loginRewardSection}>
                  <Text style={styles.sectionTitle}>🎁 Login Reward</Text>
                  <View style={styles.rewardsGrid}>
                    {Object.entries(journeyData.days[selectedDay].login_reward || {}).map(([key, value]) => (
                      <View key={key} style={styles.rewardItem}>
                        <Text style={styles.rewardIcon}>{getRewardIcon(key)}</Text>
                        <Text style={styles.rewardValue}>
                          {typeof value === 'number' ? value.toLocaleString() : value}
                        </Text>
                        <Text style={styles.rewardName}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Claim Button */}
                  {journeyData.days[selectedDay].is_unlocked && !journeyData.days[selectedDay].login_claimed && (
                    <TouchableOpacity
                      style={styles.claimButton}
                      onPress={() => claimLoginReward(selectedDay)}
                      disabled={claiming}
                    >
                      <LinearGradient
                        colors={[COLORS.gold.primary, COLORS.gold.dark]}
                        style={styles.claimButtonGradient}
                      >
                        {claiming ? (
                          <ActivityIndicator color={COLORS.navy.darkest} />
                        ) : (
                          <>
                            <Ionicons name="gift" size={18} color={COLORS.navy.darkest} />
                            <Text style={styles.claimButtonText}>CLAIM REWARDS</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  
                  {journeyData.days[selectedDay].login_claimed && (
                    <View style={styles.claimedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                      <Text style={styles.claimedText}>Rewards Claimed!</Text>
                    </View>
                  )}
                  
                  {!journeyData.days[selectedDay].is_unlocked && (
                    <View style={styles.lockedBadge}>
                      <Ionicons name="time" size={18} color={COLORS.warning} />
                      <Text style={styles.lockedText}>Unlocks on Day {selectedDay}</Text>
                    </View>
                  )}
                </View>

                {/* Unlocks */}
                {journeyData.days[selectedDay].unlocks?.length > 0 && (
                  <View style={styles.unlocksSection}>
                    <Text style={styles.sectionTitle}>🔓 Features Unlocked</Text>
                    <View style={styles.unlocksList}>
                      {journeyData.days[selectedDay].unlocks.map((unlock: string, index: number) => (
                        <View key={index} style={styles.unlockItem}>
                          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                          <Text style={styles.unlockText}>
                            {unlock.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Milestones */}
                {journeyData.days[selectedDay].milestones?.length > 0 && (
                  <View style={styles.milestonesSection}>
                    <Text style={styles.sectionTitle}>🎯 Day {selectedDay} Milestones</Text>
                    {journeyData.days[selectedDay].milestones.map((milestone: any, index: number) => (
                      <View key={index} style={styles.milestoneCard}>
                        <View style={styles.milestoneHeader}>
                          <Text style={styles.milestoneTask}>{milestone.task}</Text>
                        </View>
                        <View style={styles.milestoneRewards}>
                          {Object.entries(milestone.reward || {}).map(([key, value]) => (
                            <View key={key} style={styles.milestoneRewardItem}>
                              <Text style={styles.milestoneRewardIcon}>{getRewardIcon(key)}</Text>
                              <Text style={styles.milestoneRewardValue}>
                                {typeof value === 'number' ? value.toLocaleString() : value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Day 7 Special */}
                {selectedDay === 7 && (
                  <View style={styles.specialRewardBox}>
                    <LinearGradient colors={[COLORS.gold.primary + '40', COLORS.gold.dark + '20']} style={styles.specialRewardGradient}>
                      <Text style={styles.specialRewardIcon}>⭐</Text>
                      <Text style={styles.specialRewardTitle}>Day 7 Special Reward</Text>
                      <Text style={styles.specialRewardText}>
                        SSR Hero Selector - Choose ANY SSR hero!
                      </Text>
                    </LinearGradient>
                  </View>
                )}
              </LinearGradient>
            </View>
          )}

          {/* Tips */}
          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>💡 Pro Tips</Text>
            <Text style={styles.tipsText}>• Login daily to maximize rewards</Text>
            <Text style={styles.tipsText}>• Complete milestones for bonus crystals</Text>
            <Text style={styles.tipsText}>• Day 7 gives you a FREE SSR hero of your choice!</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  headerSubtitle: { fontSize: 11, color: COLORS.gold.light, marginTop: 2 },
  dayBadge: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  dayBadgeText: { color: COLORS.navy.darkest, fontWeight: 'bold', fontSize: 14 },
  
  content: { padding: 16, paddingBottom: 40 },
  
  progressCard: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  progressGradient: { padding: 16 },
  progressTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  progressBarOuter: { height: 10, backgroundColor: COLORS.navy.dark, borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 5 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  progressText: { fontSize: 12, color: COLORS.cream.soft },
  totalCrystals: { fontSize: 12, color: COLORS.gold.light },
  
  daySelector: { gap: 10, paddingVertical: 10, marginBottom: 20 },
  dayCard: { width: 70, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  dayCardSelected: { borderColor: COLORS.gold.primary },
  dayCardLocked: { opacity: 0.5 },
  dayCardGradient: { padding: 10, alignItems: 'center' },
  dayNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  dayNumberText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 14 },
  dayName: { fontSize: 10, color: COLORS.cream.soft, fontWeight: '600' },
  dayNameLocked: { color: COLORS.locked },
  currentBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.success, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  currentBadgeText: { fontSize: 7, color: COLORS.cream.pure, fontWeight: 'bold' },
  lockIcon: { marginTop: 4 },
  
  dayDetails: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  dayDetailsGradient: { padding: 16 },
  dayDetailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dayIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dayTitleContainer: { flex: 1 },
  dayTheme: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  dayDescription: { fontSize: 12, color: COLORS.cream.dark, marginTop: 2 },
  
  loginRewardSection: { backgroundColor: COLORS.navy.dark + '60', borderRadius: 12, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.light, marginBottom: 12 },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rewardItem: { backgroundColor: COLORS.navy.medium, borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 70 },
  rewardIcon: { fontSize: 24, marginBottom: 4 },
  rewardValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  rewardName: { fontSize: 8, color: COLORS.cream.dark, textAlign: 'center', marginTop: 2 },
  
  claimButton: { marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  claimButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  claimButtonText: { color: COLORS.navy.darkest, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  claimedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  claimedText: { color: COLORS.success, fontWeight: '600', fontSize: 14 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  lockedText: { color: COLORS.warning, fontWeight: '600', fontSize: 14 },
  
  unlocksSection: { marginBottom: 16 },
  unlocksList: { gap: 6 },
  unlockItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unlockText: { color: COLORS.cream.soft, fontSize: 13 },
  
  milestonesSection: { marginBottom: 16 },
  milestoneCard: { backgroundColor: COLORS.navy.dark + '80', borderRadius: 10, padding: 12, marginBottom: 8 },
  milestoneHeader: { marginBottom: 8 },
  milestoneTask: { color: COLORS.cream.pure, fontSize: 13, fontWeight: '500' },
  milestoneRewards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  milestoneRewardItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.navy.medium, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  milestoneRewardIcon: { fontSize: 14 },
  milestoneRewardValue: { color: COLORS.gold.light, fontSize: 12, fontWeight: '600' },
  
  specialRewardBox: { borderRadius: 12, overflow: 'hidden' },
  specialRewardGradient: { padding: 16, alignItems: 'center' },
  specialRewardIcon: { fontSize: 40, marginBottom: 8 },
  specialRewardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 4 },
  specialRewardText: { fontSize: 13, color: COLORS.cream.soft, textAlign: 'center' },
  
  tipsBox: { backgroundColor: COLORS.navy.medium + '60', borderRadius: 12, padding: 14 },
  tipsTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 8 },
  tipsText: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 4 },
});
