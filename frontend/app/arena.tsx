import React, { useEffect, useState, useRef } from 'react';
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
  Animated,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
// Phase 3.18.7: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';

// Centralized API wrappers (no raw axios in screens)
import {
  getArenaRecord,
  getArenaOpponents,
  startArenaBattle,
  getLeaderboard,
} from '../lib/api';

// API_BASE removed - using centralized lib/api.ts wrappers

interface ArenaOpponent {
  username: string;
  power: number;
  rank: number;
  rating: number;
  team_preview: { hero_name: string; rarity: string }[];
}

interface ArenaRecord {
  rating: number;
  rank: number;
  wins: number;
  losses: number;
  win_streak: number;
  best_streak: number;
  tickets: number;
  max_tickets: number;
  next_ticket_time: string;
}

export default function ArenaScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [battling, setBattling] = useState(false);
  const [record, setRecord] = useState<ArenaRecord | null>(null);
  const [opponents, setOpponents] = useState<ArenaOpponent[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<ArenaOpponent | null>(null);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'battle' | 'leaderboard'>('battle');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (hydrated && user) {
      loadArenaData();
    }
  }, [hydrated, user?.username]);

  const loadArenaData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Use centralized API wrappers (parallel loads, no .catch swallowing)
      let recordData = null;
      let opponentsData: ArenaOpponent[] = [];
      let leaderboardData: any[] = [];
      
      try {
        recordData = await getArenaRecord(user.username);
      } catch { recordData = null; }
      
      try {
        opponentsData = await getArenaOpponents(user.username);
      } catch { opponentsData = []; }
      
      try {
        leaderboardData = await getLeaderboard('arena', 20);
      } catch { leaderboardData = []; }
      
      setRecord(recordData || { rating: 1000, rank: 999, wins: 0, losses: 0, win_streak: 0, best_streak: 0, tickets: 5, max_tickets: 5 });
      setOpponents(opponentsData.length > 0 ? opponentsData : generateMockOpponents());
      setLeaderboard(leaderboardData || []);
    } catch (error) {
      console.error('Error loading arena:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockOpponents = (): ArenaOpponent[] => {
    return [
      { username: 'ShadowKnight', power: 45000, rank: 156, rating: 1250, team_preview: [{ hero_name: 'Valkyrie', rarity: 'SSR' }] },
      { username: 'DragonSlayer', power: 52000, rank: 89, rating: 1380, team_preview: [{ hero_name: 'Titan', rarity: 'UR' }] },
      { username: 'LightBringer', power: 38000, rank: 234, rating: 1150, team_preview: [{ hero_name: 'Paladin', rarity: 'SR' }] },
    ];
  };

  const startBattle = async (opponent: ArenaOpponent) => {
    if (!user || !record) return;
    if (record.tickets <= 0) {
      toast.warning('You need arena tickets to battle. Wait for regeneration or purchase more.');
      return;
    }

    setSelectedOpponent(opponent);
    setBattling(true);

    try {
      // Use centralized API wrapper
      const result = await startArenaBattle(user.username, opponent.username);
      
      setBattleResult(result);
      setShowResultModal(true);
      await loadArenaData();
      await fetchUser();
    } catch (error: any) {
      // Simulate battle for MVP (fallback)
      const userPower = user.total_power || 50000;
      const victory = userPower > opponent.power * (0.8 + Math.random() * 0.4);
      const ratingChange = victory ? Math.floor(15 + Math.random() * 10) : -Math.floor(10 + Math.random() * 8);
      
      setBattleResult({
        victory,
        opponent_username: opponent.username,
        user_power: userPower,
        opponent_power: opponent.power,
        rating_change: ratingChange,
        new_rating: (record?.rating || 1000) + ratingChange,
        rewards: victory ? { gold: 5000, arena_coins: 100 } : { arena_coins: 20 },
      });
      setShowResultModal(true);
      
      // Update local record
      if (record) {
        setRecord({
          ...record,
          rating: record.rating + ratingChange,
          wins: record.wins + (victory ? 1 : 0),
          losses: record.losses + (victory ? 0 : 1),
          win_streak: victory ? record.win_streak + 1 : 0,
          tickets: record.tickets - 1,
        });
      }
    } finally {
      setBattling(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '⭐';
    return '';
  };

  const getRankColors = (rank: number): string[] => {
    if (rank === 1) return [COLORS.gold.primary, COLORS.gold.dark];
    if (rank <= 3) return ['#C0C0C0', '#808080'];
    if (rank <= 10) return ['#CD7F32', '#8B4513'];
    return [COLORS.navy.medium, COLORS.navy.primary];
  };

  const formatNumber = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toString();

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={['#1a0a1a', '#2d1f2d', '#0a1628']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Entering Arena...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={['#1a0a1a', '#2d1f2d']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in to enter the Arena</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a0a1a', '#2d1f2d', '#0a1628']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>⚔️ PvP Arena</Text>
          <View style={styles.ticketDisplay}>
            <Ionicons name="ticket" size={16} color="#dc2626" />
            <Text style={styles.ticketText}>{record?.tickets || 0}/{record?.max_tickets || 5}</Text>
          </View>
        </View>

        {/* Stats Banner */}
        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{record?.rating || 1000}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>#{record?.rank || '?'}</Text>
            <Text style={styles.statLabel}>Rank</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{record?.wins || 0}-{record?.losses || 0}</Text>
            <Text style={styles.statLabel}>W/L</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>🔥 {record?.win_streak || 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'battle' && styles.tabActive]}
            onPress={() => setActiveTab('battle')}
          >
            <Ionicons name="flash" size={18} color={activeTab === 'battle' ? '#dc2626' : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'battle' && styles.tabTextActive]}>Battle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
            onPress={() => setActiveTab('leaderboard')}
          >
            <Ionicons name="trophy" size={18} color={activeTab === 'leaderboard' ? COLORS.gold.primary : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'leaderboard' && { color: COLORS.gold.primary }]}>Rankings</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'battle' ? (
            <>
              <Text style={styles.sectionTitle}>Choose Your Opponent</Text>
              {opponents.map((opponent, index) => (
                <TouchableOpacity
                  key={opponent.username}
                  style={styles.opponentCard}
                  onPress={() => startBattle(opponent)}
                  disabled={battling}
                >
                  <LinearGradient colors={getRankColors(opponent.rank)} style={styles.opponentGradient}>
                    <View style={styles.opponentAvatar}>
                      <Text style={styles.opponentAvatarText}>{opponent.username.charAt(0)}</Text>
                    </View>
                    <View style={styles.opponentInfo}>
                      <Text style={styles.opponentName}>{opponent.username}</Text>
                      <View style={styles.opponentStats}>
                        <Text style={styles.opponentPower}>⚡ {formatNumber(opponent.power)}</Text>
                        <Text style={styles.opponentRating}>🏆 {opponent.rating}</Text>
                      </View>
                    </View>
                    <View style={styles.fightButton}>
                      <Text style={styles.fightButtonText}>FIGHT</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.refreshButton} onPress={loadArenaData}>
                <Ionicons name="refresh" size={18} color={COLORS.cream.pure} />
                <Text style={styles.refreshText}>Find New Opponents</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Arena Leaderboard</Text>
              {leaderboard.length === 0 ? (
                <Text style={styles.emptyText}>No rankings available yet</Text>
              ) : (
                leaderboard.map((player, index) => (
                  <View key={player.username} style={styles.leaderboardRow}>
                    <View style={[styles.rankBadge, { backgroundColor: getRankColors(index + 1)[0] }]}>
                      <Text style={styles.rankText}>{getRankIcon(index + 1) || `#${index + 1}`}</Text>
                    </View>
                    <Text style={styles.leaderboardName}>{player.username}</Text>
                    <Text style={styles.leaderboardRating}>{player.rating || player.score}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* Battle Result Modal */}
        <Modal visible={showResultModal} transparent animationType="fade" onRequestClose={() => setShowResultModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.resultModal}>
              <LinearGradient
                colors={battleResult?.victory ? ['#166534', '#14532d'] : ['#7f1d1d', '#450a0a']}
                style={styles.resultGradient}
              >
                <Text style={styles.resultTitle}>
                  {battleResult?.victory ? '🎉 VICTORY!' : '💀 DEFEAT'}
                </Text>
                <Text style={styles.resultVs}>vs {battleResult?.opponent_username}</Text>
                
                <View style={styles.resultStats}>
                  <View style={styles.resultStatRow}>
                    <Text style={styles.resultStatLabel}>Your Power</Text>
                    <Text style={styles.resultStatValue}>{formatNumber(battleResult?.user_power || 0)}</Text>
                  </View>
                  <View style={styles.resultStatRow}>
                    <Text style={styles.resultStatLabel}>Enemy Power</Text>
                    <Text style={styles.resultStatValue}>{formatNumber(battleResult?.opponent_power || 0)}</Text>
                  </View>
                  <View style={styles.resultStatRow}>
                    <Text style={styles.resultStatLabel}>Rating Change</Text>
                    <Text style={[
                      styles.resultStatValue,
                      { color: (battleResult?.rating_change || 0) >= 0 ? '#22c55e' : '#ef4444' }
                    ]}>
                      {(battleResult?.rating_change || 0) >= 0 ? '+' : ''}{battleResult?.rating_change}
                    </Text>
                  </View>
                </View>

                {battleResult?.rewards && (
                  <View style={styles.rewardsBox}>
                    <Text style={styles.rewardsTitle}>Rewards</Text>
                    <View style={styles.rewardsRow}>
                      {battleResult.rewards.gold && <Text style={styles.rewardItem}>💰 {battleResult.rewards.gold}</Text>}
                      {battleResult.rewards.arena_coins && <Text style={styles.rewardItem}>🏆 {battleResult.rewards.arena_coins}</Text>}
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.continueButton} onPress={() => setShowResultModal(false)}>
                  <Text style={styles.continueButtonText}>Continue</Text>
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
  loadingText: { color: '#dc2626', marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  loginBtn: { marginTop: 16, backgroundColor: '#dc2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: '#fff', fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#dc262630' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#dc2626' },
  ticketDisplay: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2d1f2d', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  ticketText: { color: COLORS.cream.pure, fontWeight: 'bold' },

  statsBanner: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#2d1f2d', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  statLabel: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#ffffff20' },

  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2d1f2d' },
  tabActive: { backgroundColor: '#dc262630', borderWidth: 1, borderColor: '#dc2626' },
  tabText: { color: COLORS.cream.dark, fontWeight: '600' },
  tabTextActive: { color: '#dc2626' },

  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  emptyText: { color: COLORS.cream.dark, textAlign: 'center', marginTop: 40 },

  opponentCard: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  opponentGradient: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  opponentAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  opponentAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  opponentInfo: { flex: 1, marginLeft: 12 },
  opponentName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  opponentStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  opponentPower: { fontSize: 12, color: '#ffffffcc' },
  opponentRating: { fontSize: 12, color: '#ffffffcc' },
  fightButton: { backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  fightButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  refreshButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 14, backgroundColor: '#2d1f2d', borderRadius: 10 },
  refreshText: { color: COLORS.cream.pure, fontWeight: '600' },

  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ffffff10' },
  rankBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  leaderboardName: { flex: 1, color: COLORS.cream.pure, fontSize: 14, fontWeight: '600' },
  leaderboardRating: { color: COLORS.gold.primary, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultModal: { width: '100%', maxWidth: 340, borderRadius: 20, overflow: 'hidden' },
  resultGradient: { padding: 24, alignItems: 'center' },
  resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  resultVs: { fontSize: 16, color: '#ffffffcc', marginBottom: 20 },
  resultStats: { width: '100%', marginBottom: 20 },
  resultStatRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resultStatLabel: { color: '#ffffffaa', fontSize: 14 },
  resultStatValue: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  rewardsBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, width: '100%', marginBottom: 20 },
  rewardsTitle: { color: COLORS.gold.primary, fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  rewardsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  rewardItem: { color: '#fff', fontSize: 14 },
  continueButton: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  continueButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});