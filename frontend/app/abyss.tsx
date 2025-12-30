import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  abyss: { purple: '#9b59b6', darkPurple: '#6c3483', red: '#e74c3c' },
};

const API_BASE = '/api';

export default function AbyssScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [abyssData, setAbyssData] = useState<any>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackResult, setAttackResult] = useState<any>(null);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [levelRecords, setLevelRecords] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'battle' | 'records' | 'leaderboard'>('battle');
  const [leaderboard, setLeaderboard] = useState<any>(null);
  
  // Animation refs
  const bossShakeAnim = useRef(new Animated.Value(0)).current;
  const damagePopAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hydrated && user) {
      loadAbyssData();
    }
  }, [hydrated, user?.username]);

  const loadAbyssData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/abyss/${user.username}/status`);
      setAbyssData(response.data);
    } catch (error) {
      console.error('Error loading abyss:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_BASE}/abyss/leaderboard/${user?.server_id || 'server_1'}`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const loadLevelRecords = async (level: number) => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE}/abyss/${user.username}/records?level=${level}`);
      setLevelRecords(response.data);
      setShowRecordsModal(true);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const attackBoss = async () => {
    if (!user || !abyssData?.current_boss) return;
    
    setIsAttacking(true);
    setAttackResult(null);
    
    // Shake animation
    Animated.sequence([
      Animated.timing(bossShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(bossShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(bossShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(bossShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    
    try {
      const response = await axios.post(`${API_BASE}/abyss/${user.username}/attack`);
      setAttackResult(response.data);
      
      // Damage pop animation
      damagePopAnim.setValue(0);
      Animated.timing(damagePopAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
      
      if (response.data.boss_defeated) {
        // Show victory
        setTimeout(() => {
          if (response.data.milestone_reward) {
            Alert.alert(
              '🎉 MILESTONE FIRST CLEAR!',
              `${response.data.milestone_reward.message}\n\nLevel ${response.data.level} conquered!`
            );
          }
          loadAbyssData();
          fetchUser();
        }, 1500);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Attack failed');
    } finally {
      setIsAttacking(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getElementColor = (element: string) => {
    const colors: {[key: string]: string} = {
      Fire: '#e74c3c',
      Water: '#3498db',
      Earth: '#8b4513',
      Wind: '#2ecc71',
      Light: '#f1c40f',
      Dark: '#9b59b6',
    };
    return colors[element] || COLORS.navy.light;
  };

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.abyss.darkPurple]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.abyss.purple} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.abyss.darkPurple]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.abyss.darkPurple, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>⚔️ The Abyss</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>
              {abyssData?.highest_cleared || 0}/1000
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'battle' && styles.tabActive]}
            onPress={() => setActiveTab('battle')}
          >
            <Text style={[styles.tabText, activeTab === 'battle' && styles.tabTextActive]}>Battle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'records' && styles.tabActive]}
            onPress={() => { setActiveTab('records'); loadAbyssData(); }}
          >
            <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>Records</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
            onPress={() => { setActiveTab('leaderboard'); loadLeaderboard(); }}
          >
            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Rankings</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.abyss.purple} />
            <Text style={styles.loadingText}>Entering the Abyss...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {activeTab === 'battle' && abyssData && (
              <>
                {abyssData.is_completed ? (
                  <View style={styles.completedContainer}>
                    <Text style={styles.completedIcon}>🏆</Text>
                    <Text style={styles.completedTitle}>ABYSS CONQUERED!</Text>
                    <Text style={styles.completedText}>
                      You have defeated all 1000 levels of the Abyss!
                    </Text>
                  </View>
                ) : abyssData.current_boss && (
                  <>
                    {/* Level Info */}
                    <View style={styles.levelInfo}>
                      <Text style={styles.levelNumber}>Level {abyssData.current_level}</Text>
                      {abyssData.current_boss.is_milestone && (
                        <View style={styles.milestoneBadge}>
                          <Text style={styles.milestoneBadgeText}>🔥 MILESTONE</Text>
                        </View>
                      )}
                    </View>

                    {/* Boss Card */}
                    <Animated.View 
                      style={[
                        styles.bossCard,
                        { transform: [{ translateX: bossShakeAnim }] }
                      ]}
                    >
                      <LinearGradient 
                        colors={[COLORS.abyss.darkPurple, COLORS.navy.darkest]} 
                        style={styles.bossCardGradient}
                      >
                        <View style={styles.bossHeader}>
                          <Text style={styles.bossEmoji}>👹</Text>
                          <View style={styles.bossInfo}>
                            <Text style={styles.bossName}>{abyssData.current_boss.name}</Text>
                            <View style={[styles.elementBadge, { backgroundColor: getElementColor(abyssData.current_boss.element) }]}>
                              <Text style={styles.elementText}>{abyssData.current_boss.element}</Text>
                            </View>
                          </View>
                        </View>

                        {/* HP Bar */}
                        <View style={styles.hpContainer}>
                          <Text style={styles.hpLabel}>HP</Text>
                          <View style={styles.hpBar}>
                            <View style={[styles.hpFill, { width: '100%' }]} />
                          </View>
                          <Text style={styles.hpText}>{formatNumber(abyssData.current_boss.max_hp)}</Text>
                        </View>

                        {/* Attack stat */}
                        <View style={styles.statRow}>
                          <Ionicons name="flash" size={16} color={COLORS.abyss.red} />
                          <Text style={styles.statText}>ATK: {formatNumber(abyssData.current_boss.atk)}</Text>
                        </View>
                      </LinearGradient>
                    </Animated.View>

                    {/* Damage Popup */}
                    {attackResult && (
                      <Animated.View 
                        style={[
                          styles.damagePopup,
                          {
                            opacity: damagePopAnim,
                            transform: [{
                              translateY: damagePopAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -50]
                              })
                            }]
                          }
                        ]}
                      >
                        <Text style={[styles.damageText, attackResult.is_critical && styles.criticalText]}>
                          {attackResult.is_critical ? '💥 CRIT! ' : ''}-{formatNumber(attackResult.damage_dealt)}
                        </Text>
                      </Animated.View>
                    )}

                    {/* Attack Result */}
                    {attackResult && (
                      <View style={[styles.resultCard, attackResult.boss_defeated && styles.victoryCard]}>
                        {attackResult.boss_defeated ? (
                          <>
                            <Text style={styles.victoryTitle}>🎉 VICTORY!</Text>
                            <Text style={styles.victoryText}>Level {attackResult.level} Cleared!</Text>
                            {attackResult.is_first_server_clear && (
                              <View style={styles.firstClearBadge}>
                                <Text style={styles.firstClearText}>⭐ First Clear on Server!</Text>
                              </View>
                            )}
                            <View style={styles.rewardsGrid}>
                              {Object.entries(attackResult.rewards || {}).map(([key, value]) => (
                                <View key={key} style={styles.rewardItem}>
                                  <Text style={styles.rewardValue}>+{formatNumber(value as number)}</Text>
                                  <Text style={styles.rewardLabel}>{key}</Text>
                                </View>
                              ))}
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={styles.resultTitle}>Boss Survived!</Text>
                            <Text style={styles.resultText}>
                              Dealt {formatNumber(attackResult.damage_dealt)} damage
                            </Text>
                            <Text style={styles.hintText}>
                              Need {formatNumber(attackResult.damage_needed)} more damage to defeat
                            </Text>
                          </>
                        )}
                      </View>
                    )}

                    {/* Attack Button */}
                    <TouchableOpacity
                      style={[styles.attackButton, isAttacking && styles.attackButtonDisabled]}
                      onPress={attackBoss}
                      disabled={isAttacking}
                    >
                      <LinearGradient
                        colors={isAttacking ? ['#555', '#333'] : [COLORS.abyss.purple, COLORS.abyss.darkPurple]}
                        style={styles.attackButtonGradient}
                      >
                        {isAttacking ? (
                          <ActivityIndicator color={COLORS.cream.pure} />
                        ) : (
                          <>
                            <Ionicons name="skull" size={24} color={COLORS.cream.pure} />
                            <Text style={styles.attackButtonText}>CHALLENGE</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Rewards Preview */}
                    {abyssData.rewards_preview && (
                      <View style={styles.rewardsPreview}>
                        <Text style={styles.rewardsPreviewTitle}>Clear Rewards:</Text>
                        <View style={styles.rewardsPreviewGrid}>
                          {Object.entries(abyssData.rewards_preview).map(([key, value]) => (
                            <Text key={key} style={styles.rewardsPreviewItem}>
                              {formatNumber(value as number)} {key}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* Milestone First Clears */}
                {abyssData.milestone_first_clears && abyssData.milestone_first_clears.length > 0 && (
                  <View style={styles.firstClearsSection}>
                    <Text style={styles.sectionTitle}>🏆 Server First Clears</Text>
                    {abyssData.milestone_first_clears.slice(0, 5).map((fc: any, idx: number) => (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.firstClearItem}
                        onPress={() => loadLevelRecords(fc.level)}
                      >
                        <Text style={styles.firstClearLevel}>Lv.{fc.level}</Text>
                        <Text style={styles.firstClearPlayer}>{fc.cleared_by}</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.cream.dark} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {activeTab === 'records' && abyssData && (
              <View style={styles.recordsContainer}>
                <View style={styles.statsCard}>
                  <Text style={styles.statsTitle}>Your Progress</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{abyssData.highest_cleared}</Text>
                      <Text style={styles.statLabel}>Highest Level</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatNumber(abyssData.total_damage_dealt || 0)}</Text>
                      <Text style={styles.statLabel}>Total Damage</Text>
                    </View>
                  </View>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${(abyssData.highest_cleared / 1000) * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {((abyssData.highest_cleared / 1000) * 100).toFixed(1)}% Complete
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>View Level Records</Text>
                <View style={styles.levelButtons}>
                  {[50, 100, 150, 200, 250, 300, 500, 1000].map(level => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelButton,
                        level <= abyssData.highest_cleared && styles.levelButtonCleared
                      ]}
                      onPress={() => loadLevelRecords(level)}
                      disabled={level > abyssData.highest_cleared}
                    >
                      <Text style={styles.levelButtonText}>Lv.{level}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'leaderboard' && (
              <View style={styles.leaderboardContainer}>
                {leaderboard ? (
                  <>
                    <Text style={styles.sectionTitle}>🏆 Server Rankings</Text>
                    {leaderboard.leaderboard.map((player: any) => (
                      <View 
                        key={player.rank} 
                        style={[
                          styles.leaderboardItem,
                          player.rank <= 3 && styles.topRankItem
                        ]}
                      >
                        <Text style={[
                          styles.rankText,
                          player.rank === 1 && styles.goldRank,
                          player.rank === 2 && styles.silverRank,
                          player.rank === 3 && styles.bronzeRank,
                        ]}>
                          {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
                        </Text>
                        <View style={styles.leaderboardInfo}>
                          <Text style={styles.leaderboardName}>{player.username}</Text>
                          <Text style={styles.leaderboardLevel}>Level {player.highest_cleared}</Text>
                        </View>
                        <Text style={styles.leaderboardDamage}>{formatNumber(player.total_damage)}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <ActivityIndicator size="large" color={COLORS.abyss.purple} />
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* Level Records Modal */}
        <Modal
          visible={showRecordsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRecordsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Level {levelRecords?.level} Records</Text>
                <TouchableOpacity onPress={() => setShowRecordsModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                </TouchableOpacity>
              </View>

              {levelRecords?.first_clear && (
                <View style={styles.recordSection}>
                  <Text style={styles.recordSectionTitle}>⭐ First Clear</Text>
                  <View style={styles.recordCard}>
                    <Text style={styles.recordPlayer}>{levelRecords.first_clear.username}</Text>
                    <Text style={styles.recordPower}>Power: {formatNumber(levelRecords.first_clear.power_rating)}</Text>
                    <View style={styles.heroesUsed}>
                      {levelRecords.first_clear.heroes_used?.map((hero: any, idx: number) => (
                        <Text key={idx} style={styles.heroName}>{hero.name} (Lv.{hero.level})</Text>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {levelRecords?.recent_clears && levelRecords.recent_clears.length > 0 && (
                <View style={styles.recordSection}>
                  <Text style={styles.recordSectionTitle}>📜 Recent Clears</Text>
                  {levelRecords.recent_clears.map((clear: any, idx: number) => (
                    <View key={idx} style={styles.recordCard}>
                      <Text style={styles.recordPlayer}>{clear.username}</Text>
                      <Text style={styles.recordPower}>Power: {formatNumber(clear.power_rating)}</Text>
                      <View style={styles.heroesUsed}>
                        {clear.heroes_used?.map((hero: any, hidx: number) => (
                          <Text key={hidx} style={styles.heroName}>{hero.name}</Text>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Modal>
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
    borderBottomColor: COLORS.abyss.purple + '40',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  levelBadge: { backgroundColor: COLORS.abyss.purple, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  levelBadgeText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 12 },
  
  // Tabs
  tabs: { flexDirection: 'row', padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.navy.medium },
  tabActive: { backgroundColor: COLORS.abyss.purple },
  tabText: { color: COLORS.cream.dark, fontWeight: '500' },
  tabTextActive: { color: COLORS.cream.pure },
  
  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12 },
  
  scrollView: { flex: 1, padding: 16 },
  
  // Level Info
  levelInfo: { alignItems: 'center', marginBottom: 16 },
  levelNumber: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure },
  milestoneBadge: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  milestoneBadgeText: { color: COLORS.navy.darkest, fontWeight: 'bold', fontSize: 12 },
  
  // Boss Card
  bossCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  bossCardGradient: { padding: 20 },
  bossHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  bossEmoji: { fontSize: 48, marginRight: 16 },
  bossInfo: { flex: 1 },
  bossName: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 4 },
  elementBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  elementText: { color: COLORS.cream.pure, fontWeight: '600', fontSize: 12 },
  
  // HP Bar
  hpContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hpLabel: { color: COLORS.abyss.red, fontWeight: 'bold', width: 30 },
  hpBar: { flex: 1, height: 12, backgroundColor: COLORS.navy.dark, borderRadius: 6, overflow: 'hidden' },
  hpFill: { height: '100%', backgroundColor: COLORS.abyss.red, borderRadius: 6 },
  hpText: { color: COLORS.cream.pure, fontWeight: '600', width: 70, textAlign: 'right' },
  
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { color: COLORS.cream.soft, fontSize: 14 },
  
  // Damage Popup
  damagePopup: { position: 'absolute', top: 180, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  damageText: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 },
  criticalText: { color: COLORS.gold.primary, fontSize: 36 },
  
  // Result Card
  resultCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center' },
  victoryCard: { backgroundColor: COLORS.abyss.purple + '40', borderWidth: 2, borderColor: COLORS.gold.primary },
  victoryTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 4 },
  victoryText: { fontSize: 16, color: COLORS.cream.pure, marginBottom: 8 },
  firstClearBadge: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  firstClearText: { color: COLORS.navy.darkest, fontWeight: 'bold' },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  rewardItem: { alignItems: 'center', minWidth: 70 },
  rewardValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold.primary },
  rewardLabel: { fontSize: 11, color: COLORS.cream.dark, textTransform: 'capitalize' },
  resultTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  resultText: { fontSize: 14, color: COLORS.cream.soft },
  hintText: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
  
  // Attack Button
  attackButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  attackButtonDisabled: { opacity: 0.6 },
  attackButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 },
  attackButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, letterSpacing: 2 },
  
  // Rewards Preview
  rewardsPreview: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 12, marginBottom: 16 },
  rewardsPreviewTitle: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 8 },
  rewardsPreviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rewardsPreviewItem: { fontSize: 12, color: COLORS.gold.light },
  
  // First Clears Section
  firstClearsSection: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  firstClearItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, padding: 12, borderRadius: 8, marginBottom: 8 },
  firstClearLevel: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, width: 60 },
  firstClearPlayer: { flex: 1, fontSize: 14, color: COLORS.cream.pure },
  
  // Completed
  completedContainer: { alignItems: 'center', paddingVertical: 40 },
  completedIcon: { fontSize: 64, marginBottom: 16 },
  completedTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 8 },
  completedText: { fontSize: 16, color: COLORS.cream.soft, textAlign: 'center' },
  
  // Records Tab
  recordsContainer: { paddingBottom: 32 },
  statsCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginBottom: 16 },
  statsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary },
  statLabel: { fontSize: 12, color: COLORS.cream.dark },
  progressBar: { height: 8, backgroundColor: COLORS.navy.dark, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: COLORS.abyss.purple },
  progressText: { fontSize: 12, color: COLORS.cream.soft, textAlign: 'center' },
  levelButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelButton: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.navy.medium, borderRadius: 8, opacity: 0.5 },
  levelButtonCleared: { opacity: 1, backgroundColor: COLORS.abyss.purple },
  levelButtonText: { color: COLORS.cream.pure, fontWeight: '600' },
  
  // Leaderboard
  leaderboardContainer: { paddingBottom: 32 },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, padding: 12, borderRadius: 8, marginBottom: 8 },
  topRankItem: { borderWidth: 1, borderColor: COLORS.gold.dark },
  rankText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, width: 40 },
  goldRank: { color: '#FFD700' },
  silverRank: { color: '#C0C0C0' },
  bronzeRank: { color: '#CD7F32' },
  leaderboardInfo: { flex: 1, marginLeft: 8 },
  leaderboardName: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure },
  leaderboardLevel: { fontSize: 12, color: COLORS.abyss.purple },
  leaderboardDamage: { fontSize: 12, color: COLORS.cream.dark },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.navy.primary, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  recordSection: { marginBottom: 16 },
  recordSectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 8 },
  recordCard: { backgroundColor: COLORS.navy.medium, borderRadius: 8, padding: 12 },
  recordPlayer: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  recordPower: { fontSize: 12, color: COLORS.abyss.purple, marginBottom: 4 },
  heroesUsed: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heroName: { fontSize: 11, color: COLORS.cream.dark, backgroundColor: COLORS.navy.dark, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
