import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { isErrorHandledGlobally } from '../lib/api';
// Phase 3.18.5: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';
// Phase 3.50: Battle Presentation + Victory/Defeat UX
import { BattlePresentationModal, VictoryDefeatModal } from '../components/battle';
import type { BattlePresentationData, VictoryDefeatData } from '../components/battle';
import { track, Events } from '../lib/telemetry/events';

// Centralized API wrappers (no raw axios in screens)
import {
  getStagesInfo,
  getDungeonProgress,
  getStamina,
  battleDungeonStage,
  sweepDungeonStageByType,
} from '../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  dungeon: {
    exp: '#22c55e',       // Green for EXP
    gold: '#eab308',      // Yellow/Gold
    skill: '#8b5cf6',     // Purple for skill
    equipment: '#3b82f6', // Blue for equipment
    enhance: '#f97316',   // Orange for enhancement
    glow: '#4ade80',
    stone: '#374151',
    dark: '#1f2937',
  },
};

// API_BASE removed - using centralized lib/api.ts wrappers

// Stage type configurations
const STAGE_TYPES = {
  exp: {
    name: 'Soul Forge',
    icon: 'flash',
    color: COLORS.dungeon.exp,
    gradient: ['#22c55e', '#16a34a'] as const,
    desc: 'Farm Soul Dust for hero leveling',
    reward: 'Soul Dust + Gold',
    staminaCost: 10,
    path: 'exp',
  },
  gold: {
    name: 'Treasure Vault',
    icon: 'cash',
    color: COLORS.dungeon.gold,
    gradient: ['#eab308', '#ca8a04'] as const,
    desc: 'Plunder gold and coins',
    reward: 'Gold + Coins',
    staminaCost: 10,
    path: 'gold',
  },
  skill: {
    name: 'Arcane Sanctum',
    icon: 'book',
    color: COLORS.dungeon.skill,
    gradient: ['#8b5cf6', '#7c3aed'] as const,
    desc: 'Gather essence for skills',
    reward: 'Skill Essence + Gold',
    staminaCost: 12,
    path: 'skill',
  },
  equipment: {
    name: 'Divine Forge',
    icon: 'construct',
    color: COLORS.dungeon.equipment,
    gradient: ['#3b82f6', '#2563eb'] as const,
    desc: 'Craft powerful gear',
    reward: 'Equipment Drops',
    staminaCost: 15,
    path: 'equipment',
  },
  enhance: {
    name: 'Crystal Mines',
    icon: 'diamond',
    color: COLORS.dungeon.enhance,
    gradient: ['#f97316', '#ea580c'] as const,
    desc: 'Mine enhancement stones',
    reward: 'Enhancement Stones + Gold',
    staminaCost: 12,
    path: 'enhancement',
  },
} as const;

// Typed gradient fallbacks for dungeons
const DUNGEON_NAVY = [COLORS.navy.medium, COLORS.navy.dark] as const;
const DUNGEON_LOCKED = [COLORS.dungeon.stone, COLORS.dungeon.dark] as const;

interface StageInfo {
  name: string;
  difficulty: number;
}

interface UserProgress {
  exp_stage: number;
  gold_stage: number;
  skill_dungeon: number;
  equipment_dungeon: number;
  enhancement_dungeon: number;
}

interface BattleResult {
  victory: boolean;
  stage_name: string;
  rewards: Record<string, any>;
  player_power?: number;
  stage_power?: number;
  stamina_used: number;
  equipment_dropped?: any;
}

export default function DungeonsScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stagesInfo, setStagesInfo] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [userStamina, setUserStamina] = useState(100);
  const [selectedType, setSelectedType] = useState<keyof typeof STAGE_TYPES>('exp');
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [isBattling, setIsBattling] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [sweepCount, setSweepCount] = useState(3);
  
  // Phase 3.50: Battle Presentation state
  const [showPresentation, setShowPresentation] = useState(false);
  const [showVictoryDefeat, setShowVictoryDefeat] = useState(false);
  const [presentationData, setPresentationData] = useState<BattlePresentationData | null>(null);
  const [victoryDefeatData, setVictoryDefeatData] = useState<VictoryDefeatData | null>(null);

  useEffect(() => {
    if (hydrated && user) {
      loadAllData();
    }
  }, [hydrated, user?.username]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadStagesInfo(),
      loadUserProgress(),
      loadUserStamina(),
    ]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadStagesInfo = async () => {
    try {
      // Use centralized API wrapper
      const data = await getStagesInfo();
      setStagesInfo(data);
    } catch (error) {
      console.error('Error loading stages info:', error);
    }
  };

  const loadUserProgress = async () => {
    if (!user) return;
    try {
      // Use centralized API wrapper
      const data = await getDungeonProgress(user.username);
      setUserProgress(data);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const loadUserStamina = async () => {
    if (!user) return;
    try {
      // Use centralized API wrapper
      const data = await getStamina(user.username);
      setUserStamina(data.current_stamina || 100);
    } catch (error) {
      console.error('Error loading stamina:', error);
    }
  };

  const getProgressKey = (type: keyof typeof STAGE_TYPES): keyof UserProgress => {
    const map: Record<keyof typeof STAGE_TYPES, keyof UserProgress> = {
      exp: 'exp_stage',
      gold: 'gold_stage',
      skill: 'skill_dungeon',
      equipment: 'equipment_dungeon',
      enhance: 'enhancement_dungeon',
    };
    return map[type];
  };

  const getStageData = (type: keyof typeof STAGE_TYPES): Record<number, StageInfo> => {
    if (!stagesInfo) return {};
    const map: Record<keyof typeof STAGE_TYPES, string> = {
      exp: 'exp_stages',
      gold: 'gold_stages',
      skill: 'skill_dungeons',
      equipment: 'equipment_dungeons',
      enhance: 'enhancement_dungeons',
    };
    return stagesInfo[map[type]] || {};
  };

  const isStageUnlocked = (stageId: number): boolean => {
    if (!userProgress) return stageId === 1;
    const cleared = userProgress[getProgressKey(selectedType)] || 0;
    return stageId <= cleared + 1;
  };

  const isStageCleared = (stageId: number): boolean => {
    if (!userProgress) return false;
    return (userProgress[getProgressKey(selectedType)] || 0) >= stageId;
  };

  const battleStage = async (stageId: number) => {
    if (!user) return;
    
    const stageConfig = STAGE_TYPES[selectedType];
    if (userStamina < stageConfig.staminaCost) {
      // Phase 3.18.5: Toast instead of blocking Alert
      toast.warning(`Not enough stamina. Need ${stageConfig.staminaCost} ⚡`);
      return;
    }

    setIsBattling(true);
    setBattleResult(null);

    try {
      // Use centralized API wrapper
      const result = await battleDungeonStage(user.username, stageConfig.path, stageId);
      
      setBattleResult(result);
      
      // Phase 3.50: Prepare presentation data
      const presData: BattlePresentationData = {
        victory: result.victory,
        enemyPower: result.stage_power || stageId * 5000,
        playerPower: result.player_power || user?.total_power || 10000,
        rewards: result.rewards || {},
        stageName: `${stageConfig.name} - Stage ${stageId}`,
      };
      setPresentationData(presData);
      
      // Show presentation modal
      setShowPresentation(true);
      
      // Refresh data
      await Promise.all([
        loadUserProgress(),
        loadUserStamina(),
        fetchUser(),
      ]);
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        toast.error('Battle failed. Try again.');
      }
    } finally {
      setIsBattling(false);
    }
  };
  
  // Phase 3.50: Handle presentation complete
  const handlePresentationComplete = () => {
    setShowPresentation(false);
    
    // Prepare victory/defeat data
    if (battleResult && selectedStage !== null) {
      const stageConfig = STAGE_TYPES[selectedType];
      const vdData: VictoryDefeatData = {
        victory: battleResult.victory,
        stageName: `${stageConfig.name} - Stage ${selectedStage}`,
        rewards: battleResult.rewards || {},
        dungeonFloor: selectedStage,
        playerPower: battleResult.player_power || user?.total_power,
        enemyPower: battleResult.stage_power,
      };
      setVictoryDefeatData(vdData);
      setShowVictoryDefeat(true);
    }
  };
  
  // Phase 3.50: Handle victory/defeat close
  const handleVictoryDefeatClose = () => {
    setShowVictoryDefeat(false);
    setVictoryDefeatData(null);
    setPresentationData(null);
    setBattleResult(null);
  };

  const sweepStage = async (stageId: number) => {
    if (!user) return;
    
    const stageConfig = STAGE_TYPES[selectedType];
    const totalStamina = stageConfig.staminaCost * sweepCount;
    
    if (userStamina < totalStamina) {
      toast.warning(`Not enough stamina. Need ${totalStamina} ⚡ for ${sweepCount} sweeps.`);
      return;
    }

    if (!isStageCleared(stageId)) {
      toast.info('Clear the stage first to unlock sweep.');
      return;
    }

    setIsBattling(true);

    try {
      const stageTypeMap: Record<keyof typeof STAGE_TYPES, string> = {
        exp: 'exp',
        gold: 'gold',
        skill: 'skill',
        equipment: 'equipment',
        enhance: 'enhancement',
      };

      // Use centralized API wrapper
      const result = await sweepDungeonStageByType(user.username, stageTypeMap[selectedType], stageId, sweepCount);
      
      // Phase 3.50: Sweep bypasses presentation, shows victory/defeat directly
      const vdData: VictoryDefeatData = {
        victory: true,
        stageName: `${stageConfig.name} - Stage ${stageId} (${sweepCount}x Sweep)`,
        rewards: result.total_rewards || {},
        dungeonFloor: stageId,
      };
      setVictoryDefeatData(vdData);
      setShowVictoryDefeat(true);
      
      await Promise.all([
        loadUserProgress(),
        loadUserStamina(),
        fetchUser(),
      ]);
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        toast.error('Sweep failed. Try again.');
      }
    } finally {
      setIsBattling(false);
    }
  };

  const renderStageSelector = () => {
    const stages = getStageData(selectedType);
    const stageIds = Object.keys(stages).map(Number).sort((a, b) => a - b);

    return (
      <View style={styles.stageGrid}>
        {stageIds.map((stageId) => {
          const stage = stages[stageId];
          const unlocked = isStageUnlocked(stageId);
          const cleared = isStageCleared(stageId);
          const selected = selectedStage === stageId;

          return (
            <TouchableOpacity
              key={stageId}
              style={[
                styles.stageCard,
                !unlocked && styles.stageCardLocked,
                selected && styles.stageCardSelected,
                cleared && styles.stageCardCleared,
              ]}
              onPress={() => unlocked && setSelectedStage(stageId)}
              disabled={!unlocked}
            >
              <LinearGradient
                colors={unlocked ? (selected ? STAGE_TYPES[selectedType].gradient : DUNGEON_NAVY) : DUNGEON_LOCKED}
                style={styles.stageCardGradient}
              >
                <View style={styles.stageHeader}>
                  <Text style={[styles.stageNumber, !unlocked && styles.textLocked]}>
                    {stageId}
                  </Text>
                  {cleared && (
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.dungeon.exp} />
                  )}
                  {!unlocked && (
                    <Ionicons name="lock-closed" size={14} color={COLORS.cream.dark} />
                  )}
                </View>
                <Text style={[styles.stageName, !unlocked && styles.textLocked]} numberOfLines={1}>
                  {stage?.name || `Stage ${stageId}`}
                </Text>
                <View style={styles.difficultyRow}>
                  {[...Array(Math.min(stage?.difficulty || 1, 5))].map((_, i) => (
                    <Ionicons key={i} name="star" size={10} color={unlocked ? COLORS.gold.primary : COLORS.cream.dark} />
                  ))}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (!hydrated) {
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
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark, COLORS.navy.primary]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>⚔️ Dungeons</Text>
            <Text style={styles.headerSubtitle}>Farm Resources & Gear</Text>
          </View>
          <View style={styles.staminaBadge}>
            <Ionicons name="flash" size={14} color={COLORS.dungeon.exp} />
            <Text style={styles.staminaText}>{userStamina}/100</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold.primary} />
            <Text style={styles.loadingText}>Entering dungeons...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold.primary} />
            }
          >
            {/* Dungeon Type Selector */}
            <View style={styles.typeSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScrollContent}>
                {(Object.keys(STAGE_TYPES) as Array<keyof typeof STAGE_TYPES>).map((type) => {
                  const config = STAGE_TYPES[type];
                  const isSelected = selectedType === type;

                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                      onPress={() => {
                        setSelectedType(type);
                        setSelectedStage(null);
                      }}
                    >
                      <LinearGradient
                        colors={isSelected ? config.gradient : DUNGEON_NAVY}
                        style={styles.typeCardGradient}
                      >
                        <Ionicons 
                          name={config.icon as any} 
                          size={24} 
                          color={isSelected ? COLORS.cream.pure : config.color} 
                        />
                        <Text style={[styles.typeName, isSelected && styles.typeNameSelected]}>
                          {config.name}
                        </Text>
                        <Text style={[styles.typeDesc, isSelected && styles.typeDescSelected]}>
                          {config.staminaCost} ⚡
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Selected Type Info */}
            <View style={styles.infoCard}>
              <LinearGradient
                colors={STAGE_TYPES[selectedType].gradient}
                style={styles.infoGradient}
              >
                <View style={styles.infoRow}>
                  <Ionicons name={STAGE_TYPES[selectedType].icon as any} size={32} color={COLORS.cream.pure} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoTitle}>{STAGE_TYPES[selectedType].name}</Text>
                    <Text style={styles.infoDesc}>{STAGE_TYPES[selectedType].desc}</Text>
                  </View>
                </View>
                <View style={styles.rewardBadge}>
                  <Ionicons name="gift" size={14} color={COLORS.cream.pure} />
                  <Text style={styles.rewardText}>{STAGE_TYPES[selectedType].reward}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Stage Grid */}
            <Text style={styles.sectionTitle}>Select Stage</Text>
            {renderStageSelector()}

            {/* Action Buttons */}
            {selectedStage && (
              <View style={styles.actionSection}>
                <View style={styles.selectedStageInfo}>
                  <Text style={styles.selectedStageTitle}>
                    Stage {selectedStage}: {getStageData(selectedType)[selectedStage]?.name || 'Unknown'}
                  </Text>
                  <Text style={styles.selectedStageStamina}>
                    Cost: {STAGE_TYPES[selectedType].staminaCost} ⚡
                  </Text>
                </View>

                {/* Battle Button */}
                <TouchableOpacity
                  style={[styles.battleButton, isBattling && styles.buttonDisabled]}
                  onPress={() => battleStage(selectedStage)}
                  disabled={isBattling}
                >
                  <LinearGradient
                    colors={STAGE_TYPES[selectedType].gradient}
                    style={styles.battleButtonGradient}
                  >
                    {isBattling ? (
                      <ActivityIndicator color={COLORS.cream.pure} />
                    ) : (
                      <>
                        <Ionicons name="flash" size={24} color={COLORS.cream.pure} />
                        <Text style={styles.battleButtonText}>ENTER DUNGEON</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Sweep Section */}
                {isStageCleared(selectedStage) && (
                  <View style={styles.sweepSection}>
                    <View style={styles.sweepHeader}>
                      <Text style={styles.sweepTitle}>Quick Sweep</Text>
                      <Text style={styles.sweepCost}>
                        {STAGE_TYPES[selectedType].staminaCost * sweepCount} ⚡ total
                      </Text>
                    </View>
                    
                    <View style={styles.sweepControls}>
                      <TouchableOpacity
                        style={styles.sweepCountBtn}
                        onPress={() => setSweepCount(Math.max(1, sweepCount - 1))}
                      >
                        <Ionicons name="remove" size={20} color={COLORS.cream.pure} />
                      </TouchableOpacity>
                      <Text style={styles.sweepCountText}>{sweepCount}x</Text>
                      <TouchableOpacity
                        style={styles.sweepCountBtn}
                        onPress={() => setSweepCount(Math.min(10, sweepCount + 1))}
                      >
                        <Ionicons name="add" size={20} color={COLORS.cream.pure} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.sweepButton, isBattling && styles.buttonDisabled]}
                      onPress={() => sweepStage(selectedStage)}
                      disabled={isBattling}
                    >
                      <LinearGradient
                        colors={[COLORS.gold.primary, COLORS.gold.dark]}
                        style={styles.sweepButtonGradient}
                      >
                        <Ionicons name="repeat" size={20} color={COLORS.navy.darkest} />
                        <Text style={styles.sweepButtonText}>SWEEP {sweepCount}x</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Stamina Regen Info */}
            <View style={styles.staminaInfo}>
              <Ionicons name="information-circle" size={16} color={COLORS.cream.dark} />
              <Text style={styles.staminaInfoText}>
                Stamina regenerates at 1 per 5 minutes (max 100)
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Battle Result Modal */}
        <Modal
          visible={showResultModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowResultModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.resultModal}>
              <LinearGradient
                colors={battleResult?.victory ? [COLORS.dungeon.exp + '40', COLORS.navy.dark] : ['#ef4444' + '40', COLORS.navy.dark]}
                style={styles.resultGradient}
              >
                <Text style={styles.resultIcon}>
                  {battleResult?.victory ? '🎉' : '💀'}
                </Text>
                <Text style={styles.resultTitle}>
                  {battleResult?.victory ? 'VICTORY!' : 'Defeat...'}
                </Text>
                <Text style={styles.resultStageName}>
                  {battleResult?.stage_name}
                </Text>

                {battleResult?.victory && battleResult?.rewards && (
                  <View style={styles.rewardsContainer}>
                    <Text style={styles.rewardsTitle}>Rewards</Text>
                    {Object.entries(battleResult.rewards).map(([key, val]) => {
                      if (key === 'equipment') {
                        const equip = val as any;
                        return (
                          <View key={key} style={styles.equipmentReward}>
                            <Ionicons name="construct" size={16} color={COLORS.dungeon.equipment} />
                            <Text style={styles.equipmentName}>
                              {equip.name} ({equip.rarity})
                            </Text>
                          </View>
                        );
                      }
                      return (
                        <View key={key} style={styles.rewardItem}>
                          <Text style={styles.rewardKey}>{key.replace(/_/g, ' ')}</Text>
                          <Text style={styles.rewardValue}>+{(val as number).toLocaleString()}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {battleResult && (
                  <View style={styles.battleStats}>
                    <Text style={styles.battleStatText}>
                      Stamina Used: {battleResult.stamina_used} ⚡
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowResultModal(false)}
                >
                  <Text style={styles.closeButtonText}>Continue</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* Phase 3.50: Battle Presentation Modal */}
        <BattlePresentationModal
          visible={showPresentation}
          data={presentationData}
          onComplete={handlePresentationComplete}
          mode="dungeon"
        />
        
        {/* Phase 3.50: Victory/Defeat Modal */}
        <VictoryDefeatModal
          visible={showVictoryDefeat}
          data={victoryDefeatData}
          onContinue={handleVictoryDefeatClose}
          mode="dungeon"
        />
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
    borderBottomColor: COLORS.gold.dark + '30',
  },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  headerSubtitle: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  staminaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  staminaText: { fontSize: 13, color: COLORS.dungeon.exp, fontWeight: '600' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12 },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Type Selector
  typeSelector: { marginBottom: 16 },
  typeScrollContent: { gap: 10 },
  typeCard: {
    width: 100,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: { borderColor: COLORS.gold.primary },
  typeCardGradient: {
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  typeName: { fontSize: 11, fontWeight: '600', color: COLORS.cream.soft, textAlign: 'center' },
  typeNameSelected: { color: COLORS.cream.pure },
  typeDesc: { fontSize: 10, color: COLORS.cream.dark },
  typeDescSelected: { color: COLORS.cream.soft },

  // Info Card
  infoCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  infoGradient: { padding: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  infoDesc: { fontSize: 12, color: COLORS.cream.soft, marginTop: 2 },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rewardText: { fontSize: 12, color: COLORS.cream.pure, fontWeight: '500' },

  // Section
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },

  // Stage Grid
  stageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  stageCard: {
    width: (SCREEN_WIDTH - 32 - 40) / 5,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stageCardLocked: { opacity: 0.5 },
  stageCardSelected: { borderColor: COLORS.gold.primary },
  stageCardCleared: { borderColor: COLORS.dungeon.exp + '50' },
  stageCardGradient: {
    padding: 8,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  stageNumber: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  stageName: { fontSize: 8, color: COLORS.cream.dark, textAlign: 'center' },
  textLocked: { color: COLORS.cream.dark },
  difficultyRow: { flexDirection: 'row', marginTop: 4, gap: 1 },

  // Action Section
  actionSection: {
    backgroundColor: COLORS.navy.medium,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  selectedStageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedStageTitle: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure, flex: 1 },
  selectedStageStamina: { fontSize: 13, color: COLORS.dungeon.exp },

  // Battle Button
  battleButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  buttonDisabled: { opacity: 0.6 },
  battleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  battleButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, letterSpacing: 1 },

  // Sweep Section
  sweepSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.navy.light + '30',
    paddingTop: 16,
  },
  sweepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sweepTitle: { fontSize: 14, fontWeight: '600', color: COLORS.cream.soft },
  sweepCost: { fontSize: 12, color: COLORS.dungeon.exp },
  sweepControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },
  sweepCountBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.navy.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepCountText: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  sweepButton: { borderRadius: 10, overflow: 'hidden' },
  sweepButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  sweepButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.navy.darkest },

  // Stamina Info
  staminaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  staminaInfoText: { fontSize: 11, color: COLORS.cream.dark },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    overflow: 'hidden',
  },
  resultGradient: {
    padding: 24,
    alignItems: 'center',
  },
  resultIcon: { fontSize: 64, marginBottom: 12 },
  resultTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  resultStageName: { fontSize: 14, color: COLORS.cream.dark, marginBottom: 20 },
  rewardsContainer: {
    width: '100%',
    backgroundColor: COLORS.navy.dark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  rewardsTitle: { fontSize: 14, fontWeight: '600', color: COLORS.gold.primary, marginBottom: 12, textAlign: 'center' },
  rewardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rewardKey: { fontSize: 13, color: COLORS.cream.dark, textTransform: 'capitalize' },
  rewardValue: { fontSize: 14, fontWeight: '600', color: COLORS.dungeon.exp },
  equipmentReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.navy.light + '30',
    marginTop: 8,
  },
  equipmentName: { fontSize: 13, color: COLORS.dungeon.equipment, fontWeight: '600' },
  battleStats: {
    marginBottom: 16,
  },
  battleStatText: { fontSize: 12, color: COLORS.cream.dark },
  closeButton: {
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 10,
  },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
});
