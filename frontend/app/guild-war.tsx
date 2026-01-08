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
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  war: {
    red: '#dc2626',
    orange: '#f97316',
    flame: '#ef4444',
    blood: '#7f1d1d',
    victory: '#16a34a',
    defeat: '#991b1b',
  },
};

const API_BASE = '/api';

interface GuildWarStatus {
  season: number;
  status: string;
  start_time: string;
  end_time: string;
  participating_guilds: string[];
  total_guilds?: number;
}

interface LeaderboardEntry {
  rank: number;
  guild_id: string;
  guild_name: string;
  war_points: number;
  wins: number;
  losses: number;
}

interface AttackHistory {
  target_guild_name: string;
  damage_dealt: number;
  victory: boolean;
  points_earned: number;
  timestamp: string;
}

export default function GuildWarScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warStatus, setWarStatus] = useState<GuildWarStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [attackHistory, setAttackHistory] = useState<AttackHistory[]>([]);
  const [userGuild, setUserGuild] = useState<any>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackResult, setAttackResult] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<LeaderboardEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'war' | 'leaderboard' | 'history'>('war');

  // Animations
  const flameAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Flame animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(flameAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Pulse animation for attack button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (hydrated && user) {
      loadAllData();
    }
  }, [hydrated, user?.username]);

  const loadAllData = async () => {
    setLoading(true);
    // Load war status first since userGuild check depends on it
    await loadWarStatus();
    await Promise.all([
      loadLeaderboard(),
      loadUserGuild(),
      loadAttackHistory(),
    ]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadWarStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/guild-war/status`);
      setWarStatus(response.data);
    } catch (error) {
      console.error('Error loading war status:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_BASE}/guild-war/leaderboard?limit=50`);
      setLeaderboard(response.data.leaderboard || []);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const loadUserGuild = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE}/guild/${user.username}`);
      // API returns guild data directly, not under a 'guild' key
      const guildData = response.data;
      setUserGuild(guildData);
      // User has a guild if we got valid data back
      const hasGuild = !!guildData?.id;
      // Check if guild is registered for war
      if (hasGuild && warStatus) {
        setIsRegistered(warStatus.participating_guilds?.includes(guildData.id) || false);
      } else {
        setIsRegistered(false);
      }
    } catch (error) {
      setUserGuild(null);
      setIsRegistered(false);
    }
  };

  const loadAttackHistory = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE}/guild-war/history/${user.username}?limit=20`);
      setAttackHistory(response.data.attacks || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const registerForWar = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/guild-war/register/${user.username}`);
      Alert.alert('⚔️ Registered!', response.data.message);
      setIsRegistered(true);
      await loadAllData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const attackGuild = async (targetGuildId: string) => {
    if (!user) return;
    setIsAttacking(true);
    setAttackResult(null);
    
    try {
      const response = await axios.post(
        `${API_BASE}/guild-war/attack/${user.username}?target_guild_id=${targetGuildId}`
      );
      setAttackResult(response.data);
      await loadAllData();
      fetchUser();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Attack failed');
    } finally {
      setIsAttacking(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: '🥇', color: '#FFD700' };
    if (rank === 2) return { icon: '🥈', color: '#C0C0C0' };
    if (rank === 3) return { icon: '🥉', color: '#CD7F32' };
    return { icon: `#${rank}`, color: COLORS.cream.dark };
  };

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.war.blood, COLORS.navy.darkest]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.war.flame} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.war.blood, COLORS.navy.darkest]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.war.blood, COLORS.navy.darkest]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>⚔️ Guild War</Text>
            {warStatus && (
              <Text style={styles.seasonText}>Season {warStatus.season}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {warStatus && (
              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={14} color={COLORS.war.orange} />
                <Text style={styles.timerText}>{getTimeRemaining(warStatus.end_time)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'war' && styles.tabActive]}
            onPress={() => setActiveTab('war')}
          >
            <Ionicons name="flame" size={16} color={activeTab === 'war' ? COLORS.war.flame : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'war' && styles.tabTextActive]}>Battle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
            onPress={() => setActiveTab('leaderboard')}
          >
            <Ionicons name="trophy" size={16} color={activeTab === 'leaderboard' ? COLORS.gold.primary : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Rankings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Ionicons name="document-text" size={16} color={activeTab === 'history' ? COLORS.cream.soft : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.war.flame} />
            <Text style={styles.loadingText}>Preparing for war...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.war.flame} />
            }
          >
            {activeTab === 'war' && (
              <>
                {/* Guild Status Card */}
                <View style={styles.guildStatusCard}>
                  <LinearGradient colors={[COLORS.navy.dark, COLORS.navy.primary]} style={styles.guildStatusGradient}>
                    {userGuild ? (
                      <>
                        <View style={styles.guildHeader}>
                          <Text style={styles.guildIcon}>🏰</Text>
                          <View style={styles.guildInfo}>
                            <Text style={styles.guildName}>{userGuild.name}</Text>
                            <Text style={styles.guildMembers}>{userGuild.members?.length || 0} Members • Lv.{userGuild.level || 1}</Text>
                          </View>
                        </View>
                        
                        {isRegistered ? (
                          <View style={styles.registeredBadge}>
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.war.victory} />
                            <Text style={styles.registeredText}>Registered for War!</Text>
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.registerButton} onPress={registerForWar}>
                            <LinearGradient colors={[COLORS.war.red, COLORS.war.blood]} style={styles.registerButtonGradient}>
                              <Ionicons name="shield" size={20} color={COLORS.cream.pure} />
                              <Text style={styles.registerButtonText}>Register for War</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}

                        {/* Guild War Stats */}
                        {isRegistered && (
                          <View style={styles.warStats}>
                            <View style={styles.warStatItem}>
                              <Text style={styles.warStatValue}>{userGuild.war_points || 0}</Text>
                              <Text style={styles.warStatLabel}>War Points</Text>
                            </View>
                            <View style={styles.warStatDivider} />
                            <View style={styles.warStatItem}>
                              <Text style={[styles.warStatValue, { color: COLORS.war.victory }]}>{userGuild.war_wins || 0}</Text>
                              <Text style={styles.warStatLabel}>Wins</Text>
                            </View>
                            <View style={styles.warStatDivider} />
                            <View style={styles.warStatItem}>
                              <Text style={[styles.warStatValue, { color: COLORS.war.defeat }]}>{userGuild.war_losses || 0}</Text>
                              <Text style={styles.warStatLabel}>Losses</Text>
                            </View>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.noGuildContainer}>
                        <Ionicons name="alert-circle" size={48} color={COLORS.cream.dark} />
                        <Text style={styles.noGuildText}>You must join a guild to participate in Guild Wars!</Text>
                        <TouchableOpacity 
                          style={styles.joinGuildButton}
                          onPress={() => router.push('/guild')}
                        >
                          <Text style={styles.joinGuildButtonText}>Go to Guild</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </LinearGradient>
                </View>

                {/* Attack Target Selection */}
                {isRegistered && leaderboard.length > 0 && (
                  <View style={styles.targetSection}>
                    <Text style={styles.sectionTitle}>🎯 Select Target</Text>
                    <Text style={styles.sectionSubtitle}>Choose an enemy guild to attack</Text>
                    
                    {leaderboard
                      .filter(g => g.guild_id !== userGuild?.id)
                      .slice(0, 5)
                      .map((enemy, idx) => (
                        <TouchableOpacity
                          key={enemy.guild_id}
                          style={[
                            styles.enemyCard,
                            selectedTarget?.guild_id === enemy.guild_id && styles.enemyCardSelected
                          ]}
                          onPress={() => setSelectedTarget(enemy)}
                        >
                          <View style={styles.enemyRank}>
                            <Text style={styles.enemyRankText}>{getRankBadge(enemy.rank).icon}</Text>
                          </View>
                          <View style={styles.enemyInfo}>
                            <Text style={styles.enemyName}>{enemy.guild_name}</Text>
                            <Text style={styles.enemyStats}>
                              {enemy.war_points} pts • {enemy.wins}W/{enemy.losses}L
                            </Text>
                          </View>
                          <Ionicons 
                            name={selectedTarget?.guild_id === enemy.guild_id ? "checkmark-circle" : "radio-button-off"} 
                            size={24} 
                            color={selectedTarget?.guild_id === enemy.guild_id ? COLORS.war.flame : COLORS.cream.dark} 
                          />
                        </TouchableOpacity>
                      ))}

                    {/* Attack Button */}
                    {selectedTarget && (
                      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity
                          style={[styles.attackButton, isAttacking && styles.attackButtonDisabled]}
                          onPress={() => attackGuild(selectedTarget.guild_id)}
                          disabled={isAttacking}
                        >
                          <LinearGradient colors={[COLORS.war.flame, COLORS.war.red]} style={styles.attackButtonGradient}>
                            {isAttacking ? (
                              <ActivityIndicator color={COLORS.cream.pure} />
                            ) : (
                              <>
                                <Ionicons name="flash" size={24} color={COLORS.cream.pure} />
                                <Text style={styles.attackButtonText}>ATTACK!</Text>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </View>
                )}

                {/* Attack Result */}
                {attackResult && (
                  <View style={[
                    styles.resultCard,
                    attackResult.victory ? styles.victoryCard : styles.defeatCard
                  ]}>
                    <Text style={styles.resultIcon}>
                      {attackResult.victory ? '🎉' : '😔'}
                    </Text>
                    <Text style={styles.resultTitle}>
                      {attackResult.victory ? 'VICTORY!' : 'Defeat...'}
                    </Text>
                    <Text style={styles.resultDamage}>
                      Damage Dealt: {attackResult.damage_dealt?.toLocaleString()}
                    </Text>
                    <Text style={styles.resultPoints}>
                      +{attackResult.points_earned} War Points
                    </Text>
                    <TouchableOpacity 
                      style={styles.dismissButton}
                      onPress={() => setAttackResult(null)}
                    >
                      <Text style={styles.dismissButtonText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {activeTab === 'leaderboard' && (
              <View style={styles.leaderboardContainer}>
                <Text style={styles.sectionTitle}>🏆 War Rankings</Text>
                <Text style={styles.sectionSubtitle}>
                  {warStatus?.total_guilds || leaderboard.length} Guilds Participating
                </Text>
                
                {leaderboard.map((entry) => {
                  const badge = getRankBadge(entry.rank);
                  const isOwnGuild = entry.guild_id === userGuild?.id;
                  
                  return (
                    <View 
                      key={entry.guild_id} 
                      style={[
                        styles.leaderboardItem,
                        entry.rank <= 3 && styles.topRankItem,
                        isOwnGuild && styles.ownGuildItem
                      ]}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: badge.color + '30' }]}>
                        <Text style={[styles.rankText, { color: badge.color }]}>
                          {badge.icon}
                        </Text>
                      </View>
                      <View style={styles.leaderboardInfo}>
                        <Text style={[styles.leaderboardName, isOwnGuild && styles.ownGuildName]}>
                          {entry.guild_name} {isOwnGuild && '(You)'}
                        </Text>
                        <View style={styles.leaderboardStats}>
                          <Text style={styles.leaderboardWins}>
                            {entry.wins}W
                          </Text>
                          <Text style={styles.leaderboardLosses}>
                            {entry.losses}L
                          </Text>
                        </View>
                      </View>
                      <View style={styles.leaderboardPoints}>
                        <Text style={styles.pointsValue}>{entry.war_points}</Text>
                        <Text style={styles.pointsLabel}>pts</Text>
                      </View>
                    </View>
                  );
                })}

                {leaderboard.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="trophy-outline" size={48} color={COLORS.cream.dark} />
                    <Text style={styles.emptyText}>No guilds registered yet</Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'history' && (
              <View style={styles.historyContainer}>
                <Text style={styles.sectionTitle}>📜 Attack History</Text>
                
                {attackHistory.map((attack, idx) => (
                  <View 
                    key={idx} 
                    style={[
                      styles.historyItem,
                      attack.victory ? styles.historyVictory : styles.historyDefeat
                    ]}
                  >
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyTarget}>vs {attack.target_guild_name}</Text>
                      <Text style={styles.historyTime}>{formatTime(attack.timestamp)}</Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={[
                        styles.historyResult,
                        { color: attack.victory ? COLORS.war.victory : COLORS.war.defeat }
                      ]}>
                        {attack.victory ? 'Victory' : 'Defeat'}
                      </Text>
                      <Text style={styles.historyDamage}>
                        {attack.damage_dealt?.toLocaleString()} dmg
                      </Text>
                      <Text style={styles.historyPoints}>
                        +{attack.points_earned} pts
                      </Text>
                    </View>
                  </View>
                ))}

                {attackHistory.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={48} color={COLORS.cream.dark} />
                    <Text style={styles.emptyText}>No attacks yet</Text>
                    <Text style={styles.emptySubtext}>Start battling to see your history!</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.war.red + '30',
  },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  seasonText: { fontSize: 12, color: COLORS.war.orange, marginTop: 2 },
  headerRight: { minWidth: 80, alignItems: 'flex-end' },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  timerText: { fontSize: 11, color: COLORS.war.orange, fontWeight: '600' },

  // Tabs
  tabs: { flexDirection: 'row', padding: 8, gap: 8 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 8,
    backgroundColor: COLORS.navy.dark,
  },
  tabActive: { backgroundColor: COLORS.war.red + '40', borderWidth: 1, borderColor: COLORS.war.flame },
  tabText: { color: COLORS.cream.dark, fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: COLORS.cream.pure },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12 },

  scrollView: { flex: 1, padding: 16 },

  // Guild Status Card
  guildStatusCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  guildStatusGradient: { padding: 20 },
  guildHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  guildIcon: { fontSize: 40, marginRight: 12 },
  guildInfo: { flex: 1 },
  guildName: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  guildMembers: { fontSize: 12, color: COLORS.cream.dark, marginTop: 2 },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.war.victory + '20',
    paddingVertical: 12,
    borderRadius: 12,
  },
  registeredText: { color: COLORS.war.victory, fontWeight: 'bold' },
  registerButton: { borderRadius: 12, overflow: 'hidden' },
  registerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  registerButtonText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 16 },
  warStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.navy.light + '30',
  },
  warStatItem: { alignItems: 'center' },
  warStatValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure },
  warStatLabel: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  warStatDivider: { width: 1, backgroundColor: COLORS.navy.light + '30' },
  noGuildContainer: { alignItems: 'center', paddingVertical: 20 },
  noGuildText: { color: COLORS.cream.dark, textAlign: 'center', marginVertical: 12 },
  joinGuildButton: {
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  joinGuildButtonText: { color: COLORS.navy.darkest, fontWeight: 'bold' },

  // Target Section
  targetSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 12 },
  enemyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  enemyCardSelected: { borderColor: COLORS.war.flame, backgroundColor: COLORS.war.red + '20' },
  enemyRank: { width: 40, alignItems: 'center' },
  enemyRankText: { fontSize: 18 },
  enemyInfo: { flex: 1, marginLeft: 8 },
  enemyName: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  enemyStats: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  attackButton: { borderRadius: 12, overflow: 'hidden', marginTop: 16 },
  attackButtonDisabled: { opacity: 0.6 },
  attackButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  attackButtonText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 20, letterSpacing: 2 },

  // Result Card
  resultCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  victoryCard: { backgroundColor: COLORS.war.victory + '30', borderWidth: 2, borderColor: COLORS.war.victory },
  defeatCard: { backgroundColor: COLORS.war.defeat + '30', borderWidth: 2, borderColor: COLORS.war.defeat },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  resultDamage: { fontSize: 16, color: COLORS.cream.soft },
  resultPoints: { fontSize: 18, color: COLORS.gold.primary, fontWeight: 'bold', marginTop: 8 },
  dismissButton: {
    backgroundColor: COLORS.navy.dark,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  dismissButtonText: { color: COLORS.cream.pure, fontWeight: '600' },

  // Leaderboard
  leaderboardContainer: { paddingBottom: 32 },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  topRankItem: { borderWidth: 1, borderColor: COLORS.gold.dark },
  ownGuildItem: { backgroundColor: COLORS.war.red + '30', borderWidth: 1, borderColor: COLORS.war.flame },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 16, fontWeight: 'bold' },
  leaderboardInfo: { flex: 1, marginLeft: 12 },
  leaderboardName: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure },
  ownGuildName: { color: COLORS.war.flame },
  leaderboardStats: { flexDirection: 'row', gap: 8, marginTop: 2 },
  leaderboardWins: { fontSize: 11, color: COLORS.war.victory },
  leaderboardLosses: { fontSize: 11, color: COLORS.war.defeat },
  leaderboardPoints: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary },
  pointsLabel: { fontSize: 10, color: COLORS.cream.dark },

  // History
  historyContainer: { paddingBottom: 32 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy.dark,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  historyVictory: { borderLeftColor: COLORS.war.victory },
  historyDefeat: { borderLeftColor: COLORS.war.defeat },
  historyLeft: { flex: 1 },
  historyTarget: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure },
  historyTime: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyResult: { fontSize: 12, fontWeight: 'bold' },
  historyDamage: { fontSize: 11, color: COLORS.cream.soft, marginTop: 2 },
  historyPoints: { fontSize: 11, color: COLORS.gold.light },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: COLORS.cream.dark, marginTop: 12 },
  emptySubtext: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
});
