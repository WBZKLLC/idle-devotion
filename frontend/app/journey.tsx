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
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import COLORS from '../theme/colors';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL 
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api` 
  : '/api';

interface JourneyDay {
  day: number;
  rewards: { type: string; amount: number }[];
  claimed: boolean;
  unlocked: boolean;
  isToday: boolean;
}

interface JourneyMilestone {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  rewards: { type: string; amount: number }[];
  claimed: boolean;
}

export default function JourneyScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'milestones'>('daily');
  const [journeyDays, setJourneyDays] = useState<JourneyDay[]>([]);
  const [milestones, setMilestones] = useState<JourneyMilestone[]>([]);
  const [currentDay, setCurrentDay] = useState(1);

  useEffect(() => {
    if (hydrated && user) {
      loadJourneyData();
    }
  }, [hydrated, user?.username]);

  const loadJourneyData = async () => {
    setLoading(true);
    try {
      // Load journey data from API
      const response = await axios.get(`${API_BASE}/journey/status/${user?.username}`).catch(() => ({ data: null }));
      
      if (response.data) {
        setCurrentDay(response.data.current_day || user?.login_days || 1);
        // Use API data if available
      }
      
      // Generate journey days
      const loginDays = user?.login_days || 1;
      const days: JourneyDay[] = Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        rewards: getRewardsForDay(i + 1),
        claimed: i + 1 < loginDays,
        unlocked: i + 1 <= loginDays,
        isToday: i + 1 === loginDays,
      }));
      setJourneyDays(days);

      // Generate milestones
      const mstones: JourneyMilestone[] = [
        { id: 'first_hero', name: 'First Summon', description: 'Perform your first gacha summon', target: 1, progress: 1, rewards: [{ type: 'gems', amount: 100 }], claimed: true },
        { id: 'collect_5', name: 'Growing Army', description: 'Collect 5 heroes', target: 5, progress: Math.min(5, user?.heroes_count || 0), rewards: [{ type: 'hero_ticket', amount: 1 }], claimed: (user?.heroes_count || 0) >= 5 },
        { id: 'power_10k', name: 'Rising Power', description: 'Reach 10,000 total power', target: 10000, progress: user?.total_power || 0, rewards: [{ type: 'gold', amount: 10000 }], claimed: false },
        { id: 'campaign_ch3', name: 'Campaign Progress', description: 'Complete Campaign Chapter 3', target: 3, progress: 1, rewards: [{ type: 'crystals', amount: 200 }], claimed: false },
        { id: 'arena_10', name: 'Arena Warrior', description: 'Win 10 Arena battles', target: 10, progress: 3, rewards: [{ type: 'arena_coins', amount: 500 }], claimed: false },
        { id: 'vip_1', name: 'VIP Status', description: 'Reach VIP Level 1', target: 1, progress: user?.vip_level || 0, rewards: [{ type: 'gems', amount: 500 }], claimed: (user?.vip_level || 0) >= 1 },
      ];
      setMilestones(mstones);
    } catch (error) {
      console.error('Error loading journey:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRewardsForDay = (day: number): { type: string; amount: number }[] => {
    const baseRewards: { [key: number]: { type: string; amount: number }[] } = {
      1: [{ type: 'gems', amount: 50 }, { type: 'coins', amount: 5000 }],
      2: [{ type: 'gold', amount: 2000 }, { type: 'enhancement_stones', amount: 10 }],
      3: [{ type: 'gems', amount: 100 }, { type: 'stamina', amount: 60 }],
      4: [{ type: 'hero_ticket', amount: 1 }],
      5: [{ type: 'crystals', amount: 100 }, { type: 'gold', amount: 5000 }],
      6: [{ type: 'gems', amount: 200 }, { type: 'equipment_box', amount: 1 }],
      7: [{ type: 'legendary_ticket', amount: 1 }, { type: 'gems', amount: 500 }],
    };
    return baseRewards[day] || [{ type: 'coins', amount: 1000 }];
  };

  const claimDailyReward = async (day: number) => {
    const dayData = journeyDays.find(d => d.day === day);
    if (!dayData || dayData.claimed || !dayData.unlocked) return;

    try {
      await axios.post(`${API_BASE}/journey/claim-daily/${user?.username}?day=${day}`).catch(() => {});
      
      setJourneyDays(prev => prev.map(d => d.day === day ? { ...d, claimed: true } : d));
      
      const rewardText = dayData.rewards.map(r => `${r.amount} ${r.type.replace('_', ' ')}`).join(', ');
      Alert.alert('🎁 Reward Claimed!', `Day ${day}: ${rewardText}`);
      await fetchUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to claim reward');
    }
  };

  const claimMilestone = async (milestoneId: string) => {
    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone || milestone.claimed || milestone.progress < milestone.target) return;

    try {
      await axios.post(`${API_BASE}/journey/claim-milestone/${user?.username}?milestone_id=${milestoneId}`).catch(() => {});
      
      setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, claimed: true } : m));
      
      const rewardText = milestone.rewards.map(r => `${r.amount} ${r.type.replace('_', ' ')}`).join(', ');
      Alert.alert('🏆 Milestone Complete!', `${milestone.name}: ${rewardText}`);
      await fetchUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to claim milestone');
    }
  };

  const getRewardIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      gems: '💎', gold: '⭐', coins: '🪙', crystals: '🔮',
      hero_ticket: '🎫', legendary_ticket: '✨', stamina: '⚡',
      enhancement_stones: '🔶', equipment_box: '📦', arena_coins: '🏆',
    };
    return icons[type] || '🎁';
  };

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={['#0f172a', '#1e3a5f', '#0a1628']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading Journey...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={['#0f172a', '#1e3a5f']} style={styles.container}>
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
    <LinearGradient colors={['#0f172a', '#1e3a5f', '#0a1628']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>📜 Player Journey</Text>
            <Text style={styles.headerSubtitle}>Day {currentDay}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'daily' && styles.tabActive]}
            onPress={() => setActiveTab('daily')}
          >
            <Ionicons name="calendar" size={18} color={activeTab === 'daily' ? COLORS.gold.primary : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>7-Day Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'milestones' && styles.tabActive]}
            onPress={() => setActiveTab('milestones')}
          >
            <Ionicons name="flag" size={18} color={activeTab === 'milestones' ? COLORS.gold.primary : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'milestones' && styles.tabTextActive]}>Milestones</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'daily' ? (
            <>
              {/* 7-Day Login Grid */}
              <View style={styles.daysGrid}>
                {journeyDays.map(day => (
                  <TouchableOpacity
                    key={day.day}
                    style={[
                      styles.dayCard,
                      day.isToday && styles.dayCardToday,
                      day.claimed && styles.dayCardClaimed,
                      !day.unlocked && styles.dayCardLocked,
                    ]}
                    onPress={() => claimDailyReward(day.day)}
                    disabled={day.claimed || !day.unlocked}
                  >
                    <Text style={styles.dayNumber}>Day {day.day}</Text>
                    <View style={styles.dayRewards}>
                      {day.rewards.map((reward, idx) => (
                        <View key={idx} style={styles.dayRewardItem}>
                          <Text style={styles.dayRewardIcon}>{getRewardIcon(reward.type)}</Text>
                          <Text style={styles.dayRewardAmount}>{reward.amount}</Text>
                        </View>
                      ))}
                    </View>
                    {day.claimed && (
                      <View style={styles.claimedOverlay}>
                        <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
                      </View>
                    )}
                    {!day.unlocked && (
                      <View style={styles.lockedOverlay}>
                        <Ionicons name="lock-closed" size={24} color={COLORS.cream.dark} />
                      </View>
                    )}
                    {day.isToday && !day.claimed && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayText}>TODAY</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Grand Prize */}
              <View style={styles.grandPrize}>
                <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.grandPrizeGradient}>
                  <Text style={styles.grandPrizeTitle}>⭐ 7-Day Grand Prize ⭐</Text>
                  <View style={styles.grandPrizeRewards}>
                    <Text style={styles.grandPrizeIcon}>✨</Text>
                    <Text style={styles.grandPrizeText}>Legendary Hero Ticket + 500 Gems</Text>
                  </View>
                  <View style={styles.grandPrizeProgress}>
                    <Text style={styles.grandPrizeProgressText}>{Math.min(currentDay, 7)}/7 days</Text>
                  </View>
                </LinearGradient>
              </View>
            </>
          ) : (
            <>
              {/* Milestones */}
              {milestones.map(milestone => (
                <View key={milestone.id} style={styles.milestoneCard}>
                  <View style={styles.milestoneHeader}>
                    <Text style={styles.milestoneName}>{milestone.name}</Text>
                    {milestone.claimed && <Ionicons name="checkmark-circle" size={20} color="#22c55e" />}
                  </View>
                  <Text style={styles.milestoneDesc}>{milestone.description}</Text>
                  
                  {/* Progress */}
                  <View style={styles.milestoneProgress}>
                    <View style={styles.progressBarOuter}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(100, (milestone.progress / milestone.target) * 100)}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{milestone.progress}/{milestone.target}</Text>
                  </View>
                  
                  {/* Rewards */}
                  <View style={styles.milestoneRewards}>
                    {milestone.rewards.map((reward, idx) => (
                      <View key={idx} style={styles.milestoneRewardItem}>
                        <Text>{getRewardIcon(reward.type)} {reward.amount}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Claim Button */}
                  <TouchableOpacity
                    style={[
                      styles.claimButton,
                      milestone.claimed && styles.claimButtonClaimed,
                      milestone.progress < milestone.target && styles.claimButtonLocked,
                    ]}
                    onPress={() => claimMilestone(milestone.id)}
                    disabled={milestone.claimed || milestone.progress < milestone.target}
                  >
                    <Text style={styles.claimButtonText}>
                      {milestone.claimed ? '✓ Claimed' : milestone.progress >= milestone.target ? 'Claim' : 'In Progress'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  loginBtn: { marginTop: 16, backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: COLORS.navy.darkest, fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gold.primary + '30' },
  backButton: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  headerSubtitle: { fontSize: 12, color: COLORS.gold.light, marginTop: 2 },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.navy.medium },
  tabActive: { backgroundColor: COLORS.gold.primary + '30', borderWidth: 1, borderColor: COLORS.gold.primary },
  tabText: { color: COLORS.cream.dark, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold.primary },

  content: { flex: 1, padding: 16 },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  dayCard: { width: '30%', aspectRatio: 1, backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  dayCardToday: { borderColor: COLORS.gold.primary, backgroundColor: COLORS.gold.primary + '20' },
  dayCardClaimed: { opacity: 0.6 },
  dayCardLocked: { opacity: 0.4 },
  dayNumber: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  dayRewards: { flexDirection: 'column', gap: 4 },
  dayRewardItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayRewardIcon: { fontSize: 14 },
  dayRewardAmount: { fontSize: 11, color: COLORS.cream.soft },
  claimedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
  lockedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
  todayBadge: { position: 'absolute', top: -8, backgroundColor: COLORS.gold.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  todayText: { fontSize: 9, fontWeight: 'bold', color: COLORS.navy.darkest },

  grandPrize: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  grandPrizeGradient: { padding: 20, alignItems: 'center' },
  grandPrizeTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  grandPrizeRewards: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grandPrizeIcon: { fontSize: 24 },
  grandPrizeText: { fontSize: 14, color: '#fff' },
  grandPrizeProgress: { marginTop: 12 },
  grandPrizeProgressText: { fontSize: 12, color: '#ffffffcc' },

  milestoneCard: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 12 },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  milestoneName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  milestoneDesc: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 12 },
  milestoneProgress: { marginBottom: 12 },
  progressBarOuter: { height: 8, backgroundColor: COLORS.navy.darkest, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.gold.primary, borderRadius: 4 },
  progressText: { fontSize: 11, color: COLORS.cream.dark, textAlign: 'right', marginTop: 4 },
  milestoneRewards: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  milestoneRewardItem: { color: COLORS.cream.soft },
  claimButton: { backgroundColor: COLORS.gold.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  claimButtonClaimed: { backgroundColor: '#22c55e40' },
  claimButtonLocked: { backgroundColor: COLORS.navy.light },
  claimButtonText: { color: '#fff', fontWeight: 'bold' },
});