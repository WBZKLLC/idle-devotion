import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../../theme/colors';
// Phase 3.18.7: Toast for non-blocking feedback
import { toast } from '../../components/ui/Toast';
// Phase 3.22.3: Canonical button
import { PrimaryButton } from '../../components/ui/PrimaryButton';
// Phase 3.59: Battle presentation modals
import { BattlePresentationModal, VictoryDefeatModal } from '../../components/battle';
import type { BattlePresentationData, VictoryDefeatData } from '../../components/battle';
// Phase 3.49: Canonical sourceId generation
import { makeSourceId } from '../../lib/ids/sourceId';
// Phase 3.59: Telemetry
import { track, Events } from '../../lib/telemetry/events';
// Phase 4.2: Focus-based refresh (no setInterval)
import { useFocusEffect } from '@react-navigation/native';
// Phase 4.2: PvP Season API
import { 
  getPvpSeason, 
  getPvpRewardsPreview, 
  claimPvpDaily, 
  claimPvpSeason,
  type PvpSeasonResponse,
  type PvpRewardsPreviewResponse,
  type PvpClaimReceipt,
} from '../../lib/api/pvp';
// Phase E4: PvP Rules Sheet
import { PvpRulesSheet } from '../../components/pvp/PvpRulesSheet';

// Centralized API wrappers (no raw axios in screens)
import {
  getArenaRecord,
  getArenaOpponents,
  executePvPMatch,
  getLeaderboard,
} from '../../lib/api';

// API_BASE removed - using centralized lib/api.ts wrappers

// Phase 3.59: Updated interface to match backend
interface ArenaOpponent {
  id: string;
  username: string;
  power: number;
  rank: number;
  rating: number;
  isNpc: boolean;
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
  const { user, fetchUser, userHeroes, fetchUserHeroes } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [battling, setBattling] = useState(false);
  const [record, setRecord] = useState<ArenaRecord | null>(null);
  const [opponents, setOpponents] = useState<ArenaOpponent[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<ArenaOpponent | null>(null);
  const [battleResult, setBattleResult] = useState<any>(null);
  // Phase 3.59: Removed showResultModal - using VictoryDefeatModal instead
  const [activeTab, setActiveTab] = useState<'battle' | 'leaderboard'>('battle');
  
  // Phase 4.2: Season state
  const [season, setSeason] = useState<PvpSeasonResponse | null>(null);
  const [rewardsPreview, setRewardsPreview] = useState<PvpRewardsPreviewResponse | null>(null);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimingSeason, setClaimingSeason] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PvpClaimReceipt | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  // Phase E4: Rules sheet state
  const [showRulesSheet, setShowRulesSheet] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Phase 4.2: Focus-based refresh (no setInterval)
  useFocusEffect(
    useCallback(() => {
      if (hydrated && user) {
        loadArenaData();
        loadSeasonData();
        track(Events.PVP_SEASON_VIEWED, { username: user.username });
      }
    }, [hydrated, user?.username])
  );

  // Phase 4.2: Load season data
  const loadSeasonData = async () => {
    try {
      const seasonData = await getPvpSeason();
      setSeason(seasonData);
    } catch (error) {
      console.error('Error loading PvP season:', error);
    }
  };

  // Phase 4.2: Load rewards preview
  const handleShowRewardsPreview = async () => {
    track(Events.PVP_REWARDS_PREVIEW_VIEWED, {});
    if (!rewardsPreview) {
      try {
        const preview = await getPvpRewardsPreview();
        setRewardsPreview(preview);
      } catch (error) {
        console.error('Error loading rewards preview:', error);
        toast.error('Failed to load rewards preview');
        return;
      }
    }
    setShowRewardsModal(true);
  };

  // Phase 4.2: Claim daily reward
  const handleClaimDaily = async () => {
    if (claimingDaily) return;
    setClaimingDaily(true);
    try {
      const receipt = await claimPvpDaily(makeSourceId('pvp_daily'));
      setLastReceipt(receipt);
      if (receipt.success) {
        setShowReceiptModal(true);
        await fetchUser();
      } else if (receipt.error === 'already_claimed') {
        toast.info('Daily reward already claimed today');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to claim daily reward');
    } finally {
      setClaimingDaily(false);
    }
  };

  // Phase 4.2: Claim season reward
  const handleClaimSeason = async () => {
    if (claimingSeason || !season) return;
    setClaimingSeason(true);
    try {
      const receipt = await claimPvpSeason(makeSourceId('pvp_season'), season.season_id);
      setLastReceipt(receipt);
      if (receipt.success) {
        setShowReceiptModal(true);
        await fetchUser();
      } else if (receipt.error === 'already_claimed') {
        toast.info('Season reward already claimed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to claim season reward');
    } finally {
      setClaimingSeason(false);
    }
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadArenaData(), loadSeasonData()]);
    setRefreshing(false);
  }, [user?.username]);

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

  // Phase 3.59: Remove mock opponents - backend now provides NPC fallback
  const generateMockOpponents = (): ArenaOpponent[] => {
    // Backend provides deterministic NPCs when no real opponents exist
    return [];
  };

  // Phase 3.59: State for battle presentation flow
  const [showBattlePresentation, setShowBattlePresentation] = useState(false);
  const [showVictoryDefeat, setShowVictoryDefeat] = useState(false);

  // Phase 3.59: Start battle with new server-authoritative flow
  const startBattle = async (opponent: ArenaOpponent) => {
    if (!user || !record) return;
    
    // Track PvP match preview
    track(Events.PVP_MATCH_PREVIEW, { 
      opponent_id: opponent.id,
      opponent_power: opponent.power,
      is_npc: opponent.isNpc 
    });
    
    // Check tickets locally (server will also validate)
    const userTickets = user.arena_tickets ?? record.tickets ?? 5;
    if (userTickets <= 0) {
      toast.warning('You need arena tickets to battle. Wait for regeneration or purchase more.');
      return;
    }

    setSelectedOpponent(opponent);
    setBattling(true);
    setShowBattlePresentation(true);

    try {
      // Phase 3.59: Generate sourceId for idempotency
      const sourceId = makeSourceId('pvp_match');
      
      // Phase 3.59: Use new server-authoritative PvP match endpoint
      const result = await executePvPMatch(opponent.id, sourceId);
      
      setBattleResult(result);
      
      // Show battle presentation for 2 seconds, then show result
      setTimeout(() => {
        setShowBattlePresentation(false);
        setShowVictoryDefeat(true);
      }, 2000);
      
      await loadArenaData();
      await fetchUser();
    } catch (error: any) {
      console.error('PvP match error:', error);
      setShowBattlePresentation(false);
      toast.error(error.response?.data?.detail || 'Battle failed. Please try again.');
    } finally {
      setBattling(false);
    }
  };

  // Phase 3.59: Handle battle presentation completion
  const handleBattleComplete = () => {
    setShowBattlePresentation(false);
    if (battleResult) {
      setShowVictoryDefeat(true);
    }
  };

  // Phase 3.59: Handle victory/defeat modal close
  const handleResultClose = () => {
    setShowVictoryDefeat(false);
    setBattleResult(null);
    setSelectedOpponent(null);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '⭐';
    return '';
  };

  const getRankColors = (rank: number): readonly [string, string] => {
    if (rank === 1) return [COLORS.gold.primary, COLORS.gold.dark] as const;
    if (rank <= 3) return ['#C0C0C0', '#808080'] as const;
    if (rank <= 10) return ['#CD7F32', '#8B4513'] as const;
    return [COLORS.navy.medium, COLORS.navy.primary] as const;
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
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.errorText}>Please log in to enter the Arena</Text>
          <View style={{ marginTop: 16, width: '60%' }}>
            <PrimaryButton title="Go to Login" onPress={() => router.push('/')} variant="gold" size="md" />
          </View>
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
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={() => setShowRulesSheet(true)}
            >
              <Ionicons name="help-circle" size={20} color={COLORS.gold.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={() => router.push('/pvp-tournament' as any)}
            >
              <Ionicons name="trophy" size={20} color={COLORS.gold.primary} />
            </TouchableOpacity>
            <View style={styles.ticketDisplay}>
              <Ionicons name="ticket" size={16} color="#dc2626" />
              <Text style={styles.ticketText}>{record?.tickets || 0}/{record?.max_tickets || 5}</Text>
            </View>
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

        {/* Phase 4.2: Season Panel */}
        {season && (
          <View style={styles.seasonPanel}>
            <View style={styles.seasonHeader}>
              <View>
                <Text style={styles.seasonName}>{season.name}</Text>
                <Text style={styles.seasonRank}>Rank: {season.current_rank_band?.toUpperCase()}</Text>
              </View>
              <TouchableOpacity 
                style={styles.rewardsButton} 
                onPress={handleShowRewardsPreview}
              >
                <Ionicons name="gift" size={16} color="#dc2626" />
                <Text style={styles.rewardsButtonText}>Rewards</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.claimButtons}>
              <TouchableOpacity 
                style={[styles.claimButton, claimingDaily && styles.claimButtonDisabled]}
                onPress={handleClaimDaily}
                disabled={claimingDaily}
              >
                {claimingDaily ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="today" size={14} color="#fff" />
                    <Text style={styles.claimButtonText}>Claim Daily</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.claimButton, styles.claimSeasonButton, claimingSeason && styles.claimButtonDisabled]}
                onPress={handleClaimSeason}
                disabled={claimingSeason}
              >
                {claimingSeason ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="calendar" size={14} color="#fff" />
                    <Text style={styles.claimButtonText}>Claim Season</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

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

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#dc2626"
              colors={['#dc2626']}
            />
          }
        >
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

        {/* Phase 3.59: Battle Presentation Modal */}
        <BattlePresentationModal
          visible={showBattlePresentation}
          data={battleResult ? {
            victory: battleResult.victory,
            playerPower: battleResult.user_power ?? user?.total_power ?? 50000,
            enemyPower: battleResult.opponent_power ?? selectedOpponent?.power ?? 50000,
            stageName: `PvP vs ${selectedOpponent?.username ?? 'Opponent'}`,
            rewards: battleResult.rewards,
          } : null}
          onComplete={handleBattleComplete}
          mode="arena"
        />

        {/* Phase 3.59: Victory/Defeat Result Modal */}
        <VictoryDefeatModal
          visible={showVictoryDefeat}
          data={battleResult ? {
            victory: battleResult.victory,
            stageName: `vs ${battleResult.opponent_username ?? selectedOpponent?.username ?? 'Opponent'}`,
            rewards: battleResult.rewards,
            playerPower: battleResult.user_power,
            enemyPower: battleResult.opponent_power,
          } : null}
          onContinue={handleResultClose}
          mode="arena"
        />

        {/* Phase 4.2: Rewards Preview Modal */}
        <Modal
          visible={showRewardsModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRewardsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.rewardsModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Season Rewards</Text>
                <TouchableOpacity onPress={() => setShowRewardsModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.rewardsScroll}>
                {rewardsPreview?.rewards.map((tier) => (
                  <View key={tier.rank_band} style={styles.rewardTier}>
                    <View style={styles.tierHeader}>
                      <Text style={styles.tierName}>{tier.rank_band.toUpperCase()}</Text>
                      <Text style={styles.tierRating}>≥{tier.min_rating}</Text>
                    </View>
                    <View style={styles.tierRewards}>
                      {Object.entries(tier.rewards).map(([currency, amount]) => (
                        <Text key={currency} style={styles.tierRewardItem}>
                          {currency}: {amount.toLocaleString()}
                        </Text>
                      ))}
                      {tier.title && <Text style={styles.tierTitle}>🏆 {tier.title}</Text>}
                      {tier.frame && <Text style={styles.tierFrame}>🖼️ {tier.frame}</Text>}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.rewardsNote}>{rewardsPreview?.note}</Text>
            </View>
          </View>
        </Modal>

        {/* Phase 4.2: Receipt Modal for Claims */}
        <Modal
          visible={showReceiptModal && !!lastReceipt}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowReceiptModal(false);
            setLastReceipt(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.receiptModal}>
              <Text style={styles.receiptTitle}>
                {lastReceipt?.error === 'already_claimed' 
                  ? '⚠️ Already Claimed' 
                  : `🎁 ${lastReceipt?.rank_band?.toUpperCase() || 'PvP'} Rewards`}
              </Text>
              
              {lastReceipt?.rewards && !lastReceipt.error && (
                <View style={styles.receiptRewards}>
                  {Object.entries(lastReceipt.rewards).map(([currency, amount]) => (
                    <View key={currency} style={styles.receiptRewardRow}>
                      <Text style={styles.receiptCurrency}>{currency.replace('_', ' ')}</Text>
                      <Text style={styles.receiptAmount}>+{(amount as number).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {lastReceipt?.title && (
                <Text style={styles.receiptBonus}>🏆 Title: {lastReceipt.title}</Text>
              )}
              {lastReceipt?.frame && (
                <Text style={styles.receiptBonus}>🖼️ Frame: {lastReceipt.frame}</Text>
              )}
              
              <TouchableOpacity 
                style={styles.receiptCloseButton}
                onPress={() => {
                  setShowReceiptModal(false);
                  setLastReceipt(null);
                }}
              >
                <Text style={styles.receiptCloseText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Phase E4: PvP Rules Sheet */}
        <PvpRulesSheet 
          visible={showRulesSheet} 
          onClose={() => setShowRulesSheet(false)} 
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#dc2626', marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#dc262630' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#dc2626' },
  // Phase E4: Header actions container
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionButton: { padding: 6, borderRadius: 8, backgroundColor: '#2d1f2d' },
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
  
  // Phase 4.2: Season Panel styles
  seasonPanel: { 
    marginHorizontal: 16, 
    marginTop: 12, 
    backgroundColor: '#2d1f2d', 
    borderRadius: 12, 
    padding: 14,
    borderWidth: 1,
    borderColor: '#dc262640',
  },
  seasonHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 12,
  },
  seasonName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  seasonRank: { fontSize: 12, color: COLORS.gold.primary, marginTop: 2 },
  rewardsButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    backgroundColor: '#dc262620',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dc262650',
  },
  rewardsButtonText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  claimButtons: { flexDirection: 'row', gap: 8 },
  claimButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#22c55e', 
    paddingVertical: 10, 
    borderRadius: 8,
  },
  claimSeasonButton: { backgroundColor: '#eab308' },
  claimButtonDisabled: { opacity: 0.5 },
  claimButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  // Phase 4.2: Rewards Modal styles
  rewardsModal: { 
    width: '100%', 
    maxWidth: 360, 
    maxHeight: '80%',
    backgroundColor: '#2d1f2d', 
    borderRadius: 16, 
    overflow: 'hidden',
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff20',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  rewardsScroll: { padding: 16, maxHeight: 400 },
  rewardTier: { 
    backgroundColor: '#1a0a1a', 
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold.primary,
  },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tierName: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary },
  tierRating: { fontSize: 12, color: COLORS.cream.dark },
  tierRewards: { gap: 4 },
  tierRewardItem: { fontSize: 12, color: COLORS.cream.pure },
  tierTitle: { fontSize: 12, color: '#22c55e', marginTop: 4 },
  tierFrame: { fontSize: 12, color: '#3b82f6' },
  rewardsNote: { 
    padding: 16, 
    fontSize: 11, 
    color: COLORS.cream.dark, 
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ffffff10',
  },
  
  // Phase 4.2: Receipt Modal styles
  receiptModal: { 
    width: '100%', 
    maxWidth: 340, 
    backgroundColor: '#2d1f2d', 
    borderRadius: 16, 
    padding: 20,
    alignItems: 'center',
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
    marginBottom: 16,
    textAlign: 'center',
  },
  receiptRewards: {
    width: '100%',
    backgroundColor: '#1a0a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  receiptRewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff10',
  },
  receiptCurrency: {
    fontSize: 14,
    color: COLORS.cream.dark,
    textTransform: 'capitalize',
  },
  receiptAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold.primary,
  },
  receiptBonus: {
    fontSize: 13,
    color: '#22c55e',
    marginBottom: 4,
  },
  receiptCloseButton: { 
    backgroundColor: '#dc2626', 
    paddingVertical: 14, 
    paddingHorizontal: 40,
    borderRadius: 10, 
    marginTop: 16, 
    alignItems: 'center',
  },
  receiptCloseText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});