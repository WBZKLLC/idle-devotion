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
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// Phase 3.18.7: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';

// Centralized API wrappers (no raw axios in screens)
import {
  getAbyssStatus,
  getAbyssLeaderboard,
  getAbyssRecords,
  attackAbyss,
  isErrorHandledGlobally,
} from '../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  // Cave dive theme colors
  cave: {
    surface: '#4a5568',  // Rocky surface
    shallow: '#2d3748', // Shallow depths
    mid: '#1a202c',     // Mid depths
    deep: '#171923',    // Deep abyss
    darkest: '#0d0d12', // Deepest void
    glow: '#48bb78',    // Eerie green glow
    magma: '#ed8936',   // Magma veins
    crystal: '#9f7aea', // Crystal formations
    water: '#4299e1',   // Underground water
  },
};

// API_BASE removed - using centralized lib/api.ts wrappers
const MAX_LEVELS = 1000;

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

  useEffect(() => {
    if (hydrated && user) {
      loadAbyssData();
    }
  }, [hydrated, user?.username]);

  const loadAbyssData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Use centralized API wrapper
      const data = await getAbyssStatus(user.username);
      setAbyssData(data);
    } catch (error) {
      console.error('Error loading abyss:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      // Use centralized API wrapper
      const data = await getAbyssLeaderboard(user?.server_id || 'server_1');
      setLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const loadLevelRecords = async (level: number) => {
    if (!user) return;
    try {
      // Use centralized API wrapper
      const data = await getAbyssRecords(user.username, level);
      setLevelRecords(data);
      setShowRecordsModal(true);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const attackBoss = async () => {
    if (!user || !abyssData?.current_boss) return;
    
    setIsAttacking(true);
    setAttackResult(null);
    
    try {
      // Use centralized API wrapper
      const result = await attackAbyss(user.username);
      setAttackResult(result);
      
      if (result.boss_defeated) {
        // Show victory
        setTimeout(() => {
          if (result.milestone_reward) {
            Alert.alert(
              '🎉 MILESTONE FIRST CLEAR!',
              `${result.milestone_reward.message}\n\nDepth ${result.level}m conquered!`
            );
          }
          loadAbyssData();
          fetchUser();
        }, 1500);
      }
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Error', error?.message || 'Attack failed');
      }
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

  const getDepthColor = (level: number) => {
    // Color gradient based on depth
    if (level <= 100) return COLORS.cave.shallow;
    if (level <= 300) return COLORS.cave.mid;
    if (level <= 500) return COLORS.cave.deep;
    if (level <= 700) return '#1a0a2e'; // Purple deep
    if (level <= 900) return '#0f0a1a'; // Dark purple
    return COLORS.cave.darkest;
  };

  const getDepthZone = (level: number) => {
    if (level <= 100) return { name: 'Shallow Depths', icon: '🪨' };
    if (level <= 200) return { name: 'Crystal Caverns', icon: '💎' };
    if (level <= 300) return { name: 'Magma Tunnels', icon: '🔥' };
    if (level <= 400) return { name: 'Frozen Abyss', icon: '❄️' };
    if (level <= 500) return { name: 'Shadow Realm', icon: '👁️' };
    if (level <= 600) return { name: 'Void Chambers', icon: '🌀' };
    if (level <= 700) return { name: 'Elder Deep', icon: '🐙' };
    if (level <= 800) return { name: 'Chaos Core', icon: '💀' };
    if (level <= 900) return { name: 'Oblivion Gate', icon: '⚡' };
    return { name: 'The Final Depth', icon: '👑' };
  };

  const getElementColor = (element: string) => {
    const colors: {[key: string]: string} = {
      Fire: '#ed8936',
      Water: '#4299e1',
      Earth: '#a0522d',
      Wind: '#48bb78',
      Light: '#f6e05e',
      Dark: '#9f7aea',
    };
    return colors[element] || COLORS.cave.glow;
  };

  // Calculate depth percentage for visual indicator
  const depthPercentage = abyssData ? (abyssData.highest_cleared / MAX_LEVELS) * 100 : 0;

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.cave.surface, COLORS.cave.deep]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.cave.glow} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.cave.surface, COLORS.cave.deep]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentZone = abyssData ? getDepthZone(abyssData.current_level || 1) : { name: 'Surface', icon: '🏔️' };

  return (
    <LinearGradient 
      colors={[
        COLORS.cave.surface, 
        getDepthColor(abyssData?.current_level || 1),
        COLORS.cave.darkest
      ]} 
      style={styles.container}
    >
      <SafeAreaView style={styles.container}>
        {/* Header with Depth Meter */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>⛏️ The Abyss</Text>
            <Text style={styles.zoneText}>{currentZone.icon} {currentZone.name}</Text>
          </View>
          <View style={styles.depthBadge}>
            <Ionicons name="chevron-down-outline" size={14} color={COLORS.cave.glow} />
            <Text style={styles.depthBadgeText}>
              {abyssData?.current_level || 1}m
            </Text>
          </View>
        </View>

        {/* Depth Meter Visual */}
        <View style={styles.depthMeterContainer}>
          <View style={styles.depthMeterTrack}>
            <View 
              style={[
                styles.depthMeterFill,
                { 
                  height: `${depthPercentage}%`,
                  backgroundColor: COLORS.cave.glow,
                }
              ]} 
            />
            {/* Depth markers */}
            {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((marker, idx) => (
              <View 
                key={marker} 
                style={[
                  styles.depthMarker,
                  { bottom: `${(marker / MAX_LEVELS) * 100}%` }
                ]}
              >
                <View style={[
                  styles.depthMarkerDot,
                  (abyssData?.highest_cleared || 0) >= marker && styles.depthMarkerDotCleared
                ]} />
              </View>
            ))}
          </View>
          <View style={styles.depthMeterLabels}>
            <Text style={styles.depthLabel}>Surface</Text>
            <Text style={styles.depthLabel}>1000m</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'battle' && styles.tabActive]}
            onPress={() => setActiveTab('battle')}
          >
            <Ionicons name="skull" size={16} color={activeTab === 'battle' ? COLORS.cave.glow : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'battle' && styles.tabTextActive]}>Descend</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'records' && styles.tabActive]}
            onPress={() => { setActiveTab('records'); loadAbyssData(); }}
          >
            <Ionicons name="document-text" size={16} color={activeTab === 'records' ? COLORS.cave.glow : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>Records</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
            onPress={() => { setActiveTab('leaderboard'); loadLeaderboard(); }}
          >
            <Ionicons name="trophy" size={16} color={activeTab === 'leaderboard' ? COLORS.cave.glow : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Rankings</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.cave.glow} />
            <Text style={styles.loadingText}>Descending into darkness...</Text>
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
                      You have reached the deepest depth - 1000m!
                    </Text>
                    <Text style={styles.completedSubtext}>
                      You are a true master of the Abyss
                    </Text>
                  </View>
                ) : abyssData.current_boss && (
                  <>
                    {/* Depth Level Info */}
                    <View style={styles.levelInfo}>
                      <View style={styles.depthIndicator}>
                        <Ionicons name="arrow-down" size={20} color={COLORS.cave.glow} />
                        <Text style={styles.levelNumber}>Depth {abyssData.current_level}m</Text>
                        <Ionicons name="arrow-down" size={20} color={COLORS.cave.glow} />
                      </View>
                      {abyssData.current_boss.is_milestone && (
                        <View style={styles.milestoneBadge}>
                          <Text style={styles.milestoneBadgeText}>⭐ MILESTONE BOSS</Text>
                        </View>
                      )}
                    </View>

                    {/* Boss Card - Cave themed - Static */}
                    <View style={styles.bossCard}>
                      <LinearGradient 
                        colors={[getDepthColor(abyssData.current_level), COLORS.cave.darkest]} 
                        style={styles.bossCardGradient}
                      >
                        {/* Cave decorations */}
                        <View style={styles.caveDecoration}>
                          <Text style={styles.caveRock}>🪨</Text>
                          <Text style={styles.caveRock}>💎</Text>
                          <Text style={styles.caveRock}>🪨</Text>
                        </View>
                        
                        <View style={styles.bossHeader}>
                          <View style={styles.bossIconContainer}>
                            <Text style={styles.bossEmoji}>👹</Text>
                          </View>
                          <View style={styles.bossInfo}>
                            <Text style={styles.bossName}>{abyssData.current_boss.name}</Text>
                            <View style={[styles.elementBadge, { backgroundColor: getElementColor(abyssData.current_boss.element) }]}>
                              <Text style={styles.elementText}>{abyssData.current_boss.element}</Text>
                            </View>
                          </View>
                        </View>

                        {/* HP Bar */}
                        <View style={styles.hpContainer}>
                          <View style={styles.hpLabelRow}>
                            <Ionicons name="heart" size={14} color="#e74c3c" />
                            <Text style={styles.hpLabel}>HP</Text>
                          </View>
                          <View style={styles.hpBar}>
                            <LinearGradient 
                              colors={['#e74c3c', '#c0392b']} 
                              start={{x: 0, y: 0}} 
                              end={{x: 1, y: 0}}
                              style={[styles.hpFill, { width: '100%' }]} 
                            />
                          </View>
                          <Text style={styles.hpText}>{formatNumber(abyssData.current_boss.max_hp)}</Text>
                        </View>

                        {/* Attack stat */}
                        <View style={styles.statRow}>
                          <Ionicons name="flash" size={16} color={COLORS.cave.magma} />
                          <Text style={styles.statText}>ATK: {formatNumber(abyssData.current_boss.atk)}</Text>
                        </View>
                      </LinearGradient>
                    </View>

                    {/* Static Damage Display */}
                    {attackResult && (
                      <View style={styles.damagePopup}>
                        <Text style={[styles.damageText, attackResult.is_critical && styles.criticalText]}>
                          {attackResult.is_critical ? '💥 CRIT! ' : ''}-{formatNumber(attackResult.damage_dealt)}
                        </Text>
                      </View>
                    )}

                    {/* Attack Result */}
                    {attackResult && (
                      <View style={[styles.resultCard, attackResult.boss_defeated && styles.victoryCard]}>
                        {attackResult.boss_defeated ? (
                          <>
                            <Text style={styles.victoryTitle}>🎉 VICTORY!</Text>
                            <Text style={styles.victoryText}>Depth {attackResult.level}m Cleared!</Text>
                            {attackResult.is_first_server_clear && (
                              <View style={styles.firstClearBadge}>
                                <Text style={styles.firstClearText}>⭐ First to reach this depth!</Text>
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
                              Need {formatNumber(attackResult.damage_needed)} more damage
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
                        colors={isAttacking ? ['#555', '#333'] : [COLORS.cave.glow, '#2f855a']}
                        style={styles.attackButtonGradient}
                      >
                        {isAttacking ? (
                          <ActivityIndicator color={COLORS.cream.pure} />
                        ) : (
                          <>
                            <Ionicons name="arrow-down-circle" size={24} color={COLORS.cream.pure} />
                            <Text style={styles.attackButtonText}>DESCEND</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Rewards Preview */}
                    {abyssData.rewards_preview && (
                      <View style={styles.rewardsPreview}>
                        <Text style={styles.rewardsPreviewTitle}>🎁 Clear Rewards:</Text>
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
                    <Text style={styles.sectionTitle}>🏆 Server First Explorers</Text>
                    {abyssData.milestone_first_clears.slice(0, 5).map((fc: any, idx: number) => (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.firstClearItem}
                        onPress={() => loadLevelRecords(fc.level)}
                      >
                        <Text style={styles.firstClearLevel}>{fc.level}m</Text>
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
                  <Text style={styles.statsTitle}>⛏️ Your Expedition</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{abyssData.highest_cleared}m</Text>
                      <Text style={styles.statLabel}>Deepest Reached</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatNumber(abyssData.total_damage_dealt || 0)}</Text>
                      <Text style={styles.statLabel}>Total Damage</Text>
                    </View>
                  </View>
                  
                  {/* Progress visualization */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <LinearGradient 
                        colors={[COLORS.cave.glow, '#2f855a']}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 0}}
                        style={[
                          styles.progressFill, 
                          { width: `${depthPercentage}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {depthPercentage.toFixed(1)}% of Abyss Explored
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>View Depth Records</Text>
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
                      <Text style={styles.levelButtonText}>{level}m</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'leaderboard' && (
              <View style={styles.leaderboardContainer}>
                {leaderboard ? (
                  <>
                    <Text style={styles.sectionTitle}>🏆 Deepest Explorers</Text>
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
                          <Text style={styles.leaderboardLevel}>Depth: {player.highest_cleared}m</Text>
                        </View>
                        <Text style={styles.leaderboardDamage}>{formatNumber(player.total_damage)}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <ActivityIndicator size="large" color={COLORS.cave.glow} />
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
              <LinearGradient colors={[COLORS.cave.mid, COLORS.cave.deep]} style={styles.modalGradient}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Depth {levelRecords?.level}m Records</Text>
                  <TouchableOpacity onPress={() => setShowRecordsModal(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {levelRecords?.first_clear && (
                    <View style={styles.recordSection}>
                      <Text style={styles.recordSectionTitle}>⭐ First Explorer</Text>
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
                </ScrollView>
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
    borderBottomColor: COLORS.cave.glow + '30',
  },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  zoneText: { fontSize: 12, color: COLORS.cave.glow, marginTop: 2 },
  depthBadge: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: COLORS.cave.deep, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cave.glow + '50',
  },
  depthBadgeText: { color: COLORS.cave.glow, fontWeight: 'bold', fontSize: 14, marginLeft: 4 },
  
  // Depth Meter
  depthMeterContainer: {
    position: 'absolute',
    right: 8,
    top: 120,
    bottom: 80,
    width: 30,
    alignItems: 'center',
    zIndex: 10,
  },
  depthMeterTrack: {
    flex: 1,
    width: 8,
    backgroundColor: COLORS.cave.deep,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  depthMeterFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 4,
  },
  depthMarker: {
    position: 'absolute',
    right: -8,
    width: 16,
    alignItems: 'center',
  },
  depthMarkerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.cave.shallow,
  },
  depthMarkerDotCleared: {
    backgroundColor: COLORS.cave.glow,
  },
  depthMeterLabels: {
    position: 'absolute',
    left: -30,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  depthLabel: {
    fontSize: 8,
    color: COLORS.cream.dark,
  },
  
  // Tabs
  tabs: { flexDirection: 'row', padding: 8, gap: 8, marginRight: 40 },
  tab: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10, 
    gap: 6,
    borderRadius: 8, 
    backgroundColor: COLORS.cave.deep,
  },
  tabActive: { backgroundColor: COLORS.cave.glow + '30', borderWidth: 1, borderColor: COLORS.cave.glow },
  tabText: { color: COLORS.cream.dark, fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: COLORS.cave.glow },
  
  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12 },
  
  scrollView: { flex: 1, padding: 16, paddingRight: 50 },
  
  // Level Info
  levelInfo: { alignItems: 'center', marginBottom: 16 },
  depthIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
  },
  levelNumber: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure },
  milestoneBadge: { 
    backgroundColor: COLORS.gold.primary, 
    paddingHorizontal: 16, 
    paddingVertical: 6, 
    borderRadius: 16, 
    marginTop: 8,
  },
  milestoneBadgeText: { color: COLORS.cave.darkest, fontWeight: 'bold', fontSize: 12 },
  
  // Boss Card
  bossCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  bossCardGradient: { padding: 20 },
  caveDecoration: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    opacity: 0.5,
  },
  caveRock: { fontSize: 20 },
  bossHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  bossIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.cave.darkest,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: COLORS.cave.glow + '50',
  },
  bossEmoji: { fontSize: 36 },
  bossInfo: { flex: 1 },
  bossName: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 6 },
  elementBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  elementText: { color: COLORS.cream.pure, fontWeight: '600', fontSize: 12 },
  
  // HP Bar
  hpContainer: { marginBottom: 12 },
  hpLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  hpLabel: { color: '#e74c3c', fontWeight: 'bold', fontSize: 12 },
  hpBar: { height: 16, backgroundColor: COLORS.cave.darkest, borderRadius: 8, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 8 },
  hpText: { color: COLORS.cream.pure, fontWeight: '600', marginTop: 4, textAlign: 'right', fontSize: 12 },
  
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { color: COLORS.cream.soft, fontSize: 14 },
  
  // Damage Popup
  damagePopup: { position: 'absolute', top: 200, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  damageText: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: COLORS.cream.pure, 
    textShadowColor: '#000', 
    textShadowOffset: { width: 2, height: 2 }, 
    textShadowRadius: 4,
  },
  criticalText: { color: COLORS.gold.primary, fontSize: 38 },
  
  // Result Card
  resultCard: { 
    backgroundColor: COLORS.cave.deep, 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cave.shallow,
  },
  victoryCard: { 
    backgroundColor: COLORS.cave.glow + '20', 
    borderWidth: 2, 
    borderColor: COLORS.cave.glow,
  },
  victoryTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.cave.glow, marginBottom: 4 },
  victoryText: { fontSize: 16, color: COLORS.cream.pure, marginBottom: 8 },
  firstClearBadge: { 
    backgroundColor: COLORS.gold.primary, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8, 
    marginBottom: 12,
  },
  firstClearText: { color: COLORS.cave.darkest, fontWeight: 'bold' },
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
  attackButtonGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 18, 
    gap: 10,
  },
  attackButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, letterSpacing: 2 },
  
  // Rewards Preview
  rewardsPreview: { 
    backgroundColor: COLORS.cave.deep, 
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cave.shallow,
  },
  rewardsPreviewTitle: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 8 },
  rewardsPreviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rewardsPreviewItem: { fontSize: 12, color: COLORS.gold.light },
  
  // First Clears Section
  firstClearsSection: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  firstClearItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.cave.deep, 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cave.shallow,
  },
  firstClearLevel: { fontSize: 14, fontWeight: 'bold', color: COLORS.cave.glow, width: 60 },
  firstClearPlayer: { flex: 1, fontSize: 14, color: COLORS.cream.pure },
  
  // Completed
  completedContainer: { alignItems: 'center', paddingVertical: 40 },
  completedIcon: { fontSize: 64, marginBottom: 16 },
  completedTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 8 },
  completedText: { fontSize: 16, color: COLORS.cream.soft, textAlign: 'center' },
  completedSubtext: { fontSize: 14, color: COLORS.cave.glow, marginTop: 8 },
  
  // Records Tab
  recordsContainer: { paddingBottom: 32 },
  statsCard: { 
    backgroundColor: COLORS.cave.deep, 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cave.glow + '30',
  },
  statsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.cave.glow },
  statLabel: { fontSize: 12, color: COLORS.cream.dark },
  progressContainer: { marginTop: 8 },
  progressBar: { height: 10, backgroundColor: COLORS.cave.darkest, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: 12, color: COLORS.cream.soft, textAlign: 'center' },
  levelButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    backgroundColor: COLORS.cave.deep, 
    borderRadius: 8, 
    opacity: 0.5,
    borderWidth: 1,
    borderColor: COLORS.cave.shallow,
  },
  levelButtonCleared: { opacity: 1, backgroundColor: COLORS.cave.glow + '30', borderColor: COLORS.cave.glow },
  levelButtonText: { color: COLORS.cream.pure, fontWeight: '600' },
  
  // Leaderboard
  leaderboardContainer: { paddingBottom: 32 },
  leaderboardItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.cave.deep, 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cave.shallow,
  },
  topRankItem: { borderWidth: 1, borderColor: COLORS.gold.dark },
  rankText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, width: 40 },
  goldRank: { color: '#FFD700' },
  silverRank: { color: '#C0C0C0' },
  bronzeRank: { color: '#CD7F32' },
  leaderboardInfo: { flex: 1, marginLeft: 8 },
  leaderboardName: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure },
  leaderboardLevel: { fontSize: 12, color: COLORS.cave.glow },
  leaderboardDamage: { fontSize: 12, color: COLORS.cream.dark },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, maxHeight: '80%', borderRadius: 16, overflow: 'hidden' },
  modalGradient: { padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  modalScroll: { maxHeight: 400 },
  recordSection: { marginBottom: 16 },
  recordSectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cave.glow, marginBottom: 8 },
  recordCard: { backgroundColor: COLORS.cave.deep, borderRadius: 8, padding: 12 },
  recordPlayer: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  recordPower: { fontSize: 12, color: COLORS.cave.glow, marginBottom: 4 },
  heroesUsed: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heroName: { 
    fontSize: 11, 
    color: COLORS.cream.dark, 
    backgroundColor: COLORS.cave.darkest, 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4,
  },
});
