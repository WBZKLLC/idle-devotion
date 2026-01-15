import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { isErrorHandledGlobally } from '../lib/api';
// Phase 3.18.7: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';

// Centralized API wrappers (no raw axios in screens)
import {
  getCampaignChapters,
  getCampaignChapterDetail,
  completeCampaignStage,
} from '../lib/api';

// ✅ 2Dlive shell (UI-only)
import {
  CenteredBackground,
  DivineOverlays,
  SanctumAtmosphere,
  GlassCard,
} from '../components/DivineShell';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// API_BASE removed - using centralized lib/api.ts wrappers

// ✅ Campaign environment background (confirmed path)
const CAMPAIGN_BG = require('../assets/backgrounds/sanctum_environment_01.jpg');

// Act-specific stage backgrounds (Option B)
// Put these files in: /app/frontend/assets/backgrounds/
const ACT_BACKGROUNDS: Record<number, any> = {
  1: require('../assets/backgrounds/act_01_bg.jpg'),
  2: require('../assets/backgrounds/act_02_bg.jpg'),
  3: require('../assets/backgrounds/act_03_bg.jpg'),
  4: require('../assets/backgrounds/act_04_bg.jpg'),
};

// Dark Fantasy Color Palette
const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  // Act-specific colors
  acts: {
    1: { primary: '#3b82f6', secondary: '#1e40af', name: 'The Mortal Threat' },     // Blue - Empire
    2: { primary: '#dc2626', secondary: '#7f1d1d', name: 'The Ancient Evil' },      // Red - Demons
    3: { primary: '#fbbf24', secondary: '#b45309', name: 'The Divine Conflict' },   // Gold - Angels
    4: { primary: '#8b5cf6', secondary: '#4c1d95', name: 'The Cosmic Balance' },    // Purple - Void
  },
};

// Chapter Icons & Backgrounds
const CHAPTER_VISUALS: { [key: number]: { icon: string; bg: string[] } } = {
  1:  { icon: '🔥', bg: ['#1e3a5f', '#0d1b2a'] },
  2:  { icon: '🏰', bg: ['#3d1f1f', '#1a0a0a'] },
  3:  { icon: '⚔️', bg: ['#4a3000', '#1a1000'] },
  4:  { icon: '👿', bg: ['#2d1f4e', '#0f0a1f'] },
  5:  { icon: '🔥', bg: ['#4a1010', '#1a0505'] },
  6:  { icon: '⛓️', bg: ['#1a0a2e', '#0a0510'] },
  7:  { icon: '👼', bg: ['#4a4a00', '#1a1a00'] },
  8:  { icon: '💔', bg: ['#3d2060', '#150a25'] },
  9:  { icon: '📜', bg: ['#5a3080', '#1f1030'] },
  10: { icon: '🌀', bg: ['#1a1040', '#050510'] },
  11: { icon: '🤝', bg: ['#0a0a1f', '#020205'] },
  12: { icon: '👑', bg: ['#ffffff', '#a0a0a0'] },
};

interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  act: number;
  act_name: string;
  summary: string;
  is_unlocked: boolean;
  is_completed: boolean;
  progress: { cleared: number; total: number };
  recommended_power: number;
  theme_color: string;
  completion_unlock?: string;
}

interface Stage {
  stage_id: string;
  chapter: number;
  stage: number;
  is_boss: boolean;
  is_mini_boss: boolean;
  is_cleared: boolean;
  is_unlocked: boolean;
  stars: number;
  enemy_power: number;
  recommended_player_power: number;
  stamina_cost: number;
  first_clear_rewards: any;
  three_star_bonus: any;
  special_event?: any;
}

interface DialogueLine {
  speaker: string;
  text: string;
}

export default function CampaignScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();

  // State
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [activeTab, setActiveTab] = useState<'chapters' | 'stages'>('chapters');

  // Battle state
  const [isBattling, setIsBattling] = useState(false);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [showBattleModal, setShowBattleModal] = useState(false);

  // Dialogue state
  const [showDialogue, setShowDialogue] = useState(false);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (hydrated && user) {
      loadChapters();
    }
  }, [hydrated, user?.username]);

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadChapters = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Use centralized API wrapper
      const data = await getCampaignChapters(user.username);
      setChapters(data.chapters || []);
    } catch (error: any) {
      console.error('Error loading chapters:', error);
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Error', 'Failed to load campaign data');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadChapterStages = async (chapter: Chapter) => {
    if (!user) return;
    try {
      setLoading(true);
      // Use centralized API wrapper
      const data = await getCampaignChapterDetail(user.username, String(chapter.id));
      setStages(data.stages || []);
      setSelectedChapter(chapter);
      setActiveTab('stages');
    } catch (error: any) {
      console.error('Error loading stages:', error);
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Error', 'Failed to load chapter stages');
      }
    } finally {
      setLoading(false);
    }
  };

  const startBattle = async (stage: Stage) => {
    if (!user || !selectedChapter) return;

    setSelectedStage(stage);
    setIsBattling(true);
    setShowBattleModal(true);
    setBattleResult(null);

    try {
      // Use centralized API wrapper
      const result = await completeCampaignStage(user.username, selectedChapter.id, stage.stage, 3);

      setBattleResult({ ...result, victory: result.success });

      // Show dialogue if first clear
      if (result.first_clear && result.dialogue) {
        setDialogueLines(result.dialogue);
        setCurrentDialogueIndex(0);
        setShowDialogue(true);
      }

      // Refresh data
      await fetchUser();
      await loadChapterStages(selectedChapter);

    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Battle Failed', error?.message || 'Unable to complete stage');
      }
      setShowBattleModal(false);
    } finally {
      setIsBattling(false);
    }
  };

  const advanceDialogue = () => {
    if (currentDialogueIndex < dialogueLines.length - 1) {
      setCurrentDialogueIndex(prev => prev + 1);
    } else {
      setShowDialogue(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getActColor = (act: number) => {
    return COLORS.acts[act as keyof typeof COLORS.acts] || COLORS.acts[1];
  };

  // ----------------------------
  // 2Dlive wrapped loading screen (UI-only)
  // ----------------------------
  if (!hydrated || loading) {
    return (
      <View style={styles.root}>
        <CenteredBackground source={CAMPAIGN_BG} mode="contain" zoom={1.03} opacity={1} />
        <SanctumAtmosphere />
        <DivineOverlays vignette={true} rays={false} grain={true} />

        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading Campaign...</Text>
        </SafeAreaView>
      </View>
    );
  }

  // ----------------------------
  // 2Dlive wrapped not-logged-in (UI-only)
  // ----------------------------
  if (!user) {
    return (
      <View style={styles.root}>
        <CenteredBackground source={CAMPAIGN_BG} mode="contain" zoom={1.03} opacity={1} />
        <SanctumAtmosphere />
        <DivineOverlays vignette={true} rays={false} grain={true} />

        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login to access the campaign</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // Render chapter card (premium gold stroke wrapper)
  const renderChapterCard = ({ item: chapter }: { item: Chapter }) => {
    const actColor = getActColor(chapter.act);
    const visuals = CHAPTER_VISUALS[chapter.id] || CHAPTER_VISUALS[1];
    const progressPercent = chapter.progress.total > 0
      ? (chapter.progress.cleared / chapter.progress.total) * 100
      : 0;

    const unlocked = chapter.is_unlocked;

    return (
      <TouchableOpacity
        style={styles.chapterCardOuter}
        onPress={() => unlocked && loadChapterStages(chapter)}
        disabled={!unlocked}
        activeOpacity={0.85}
      >
        {/* Premium gold stroke frame */}
        <View style={[styles.goldStrokeFrame, !unlocked && styles.goldStrokeFrameLocked]}>
          <View style={[styles.goldStrokeInner, !unlocked && styles.goldStrokeInnerLocked]}>
            <View style={[styles.chapterCard, !unlocked && styles.chapterLocked]}>
              <LinearGradient
                colors={unlocked ? visuals.bg : ['#1a1a1a', '#0a0a0a']}
                style={styles.chapterGradient}
              >
                {/* Lock overlay */}
                {!unlocked && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={32} color={COLORS.cream.dark} />
                    <Text style={styles.lockText}>Complete Chapter {chapter.id - 1}</Text>
                  </View>
                )}

                {/* Chapter header */}
                <View style={styles.chapterHeader}>
                  <View style={styles.chapterIconContainer}>
                    <Text style={styles.chapterIcon}>{visuals.icon}</Text>
                  </View>
                  <View style={styles.chapterInfo}>
                    <Text style={styles.chapterNumber}>Chapter {chapter.id}</Text>
                    <Text style={styles.chapterTitle}>{chapter.title}</Text>
                    <Text style={styles.chapterSubtitle}>{chapter.subtitle}</Text>
                  </View>
                  {chapter.is_completed && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    </View>
                  )}
                </View>

                {/* Act badge */}
                <View style={[styles.actBadge, { backgroundColor: actColor.primary + '40' }]}>
                  <Text style={[styles.actText, { color: actColor.primary }]}>
                    Act {chapter.act}: {actColor.name}
                  </Text>
                </View>

                {/* Summary */}
                <Text style={styles.chapterSummary} numberOfLines={2}>
                  {chapter.summary}
                </Text>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <LinearGradient
                      colors={[actColor.primary, actColor.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${progressPercent}%` }]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {chapter.progress.cleared}/{chapter.progress.total} Stages
                  </Text>
                </View>

                {/* Footer info */}
                <View style={styles.chapterFooter}>
                  <View style={styles.powerReq}>
                    <Ionicons name="flash" size={14} color={COLORS.gold.light} />
                    <Text style={styles.powerText}>{formatNumber(chapter.recommended_power)} PWR</Text>
                  </View>
                  {chapter.completion_unlock && (
                    <View style={styles.unlockPreview}>
                      <Ionicons name="gift" size={14} color="#22c55e" />
                      <Text style={styles.unlockText}>Unlocks: {chapter.completion_unlock}</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>

              {/* Soft premium sheen */}
              <View pointerEvents="none" style={styles.chapterSheen} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render stage button (unchanged)
  const renderStageButton = (stage: Stage, index: number) => {
    const isBoss = stage.is_boss;
    const isMini = stage.is_mini_boss;
    const isCleared = stage.is_cleared;
    const isLocked = !stage.is_unlocked;

    return (
      <TouchableOpacity
        key={stage.stage_id}
        style={[
          styles.stageButton,
          isBoss && styles.stageBoss,
          isMini && styles.stageMiniBoss,
          isCleared && styles.stageCleared,
          isLocked && styles.stageLocked,
        ]}
        onPress={() => !isLocked && setSelectedStage(stage)}
        disabled={isLocked}
      >
        {isLocked ? (
          <Ionicons name="lock-closed" size={16} color={COLORS.cream.dark + '60'} />
        ) : isCleared ? (
          <>
            <View style={styles.stageStars}>
              {[1, 2, 3].map(star => (
                <Ionicons
                  key={star}
                  name={star <= (stage.stars || 0) ? 'star' : 'star-outline'}
                  size={10}
                  color={star <= (stage.stars || 0) ? COLORS.gold.primary : COLORS.cream.dark}
                />
              ))}
            </View>
            <Text style={styles.stageNumber}>{stage.stage}</Text>
          </>
        ) : (
          <>
            {isBoss && <Text style={styles.bossIcon}>👹</Text>}
            {isMini && !isBoss && <Text style={styles.bossIcon}>⚔️</Text>}
            {!isBoss && !isMini && <Text style={styles.stageNumber}>{stage.stage}</Text>}
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      {/* Background logic:
          - Chapters tab: Sanctum environment
          - Stages tab: Act-specific background (Option B) */}
      <CenteredBackground
        source={
          activeTab === 'stages' && selectedChapter
            ? (ACT_BACKGROUNDS[selectedChapter.act] ?? CAMPAIGN_BG)
            : CAMPAIGN_BG
        }
        mode="contain"
        zoom={1.03}
        opacity={1}
      />
      <SanctumAtmosphere />
      <DivineOverlays vignette={true} rays={false} grain={true} />

      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => activeTab === 'stages' ? setActiveTab('chapters') : router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {activeTab === 'chapters' ? '📖 Campaign' : selectedChapter?.title}
            </Text>
            {activeTab === 'stages' && selectedChapter && (
              <Text style={styles.headerSubtitle}>Chapter {selectedChapter.id}</Text>
            )}
          </View>
          <View style={styles.staminaDisplay}>
            <Ionicons name="flash" size={16} color="#22c55e" />
            <Text style={styles.staminaText}>{user.stamina || 100}</Text>
          </View>
        </View>

        {/* Chapters List */}
        {activeTab === 'chapters' && (
          <Animated.View style={[styles.chaptersContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <FlatList
              data={chapters}
              renderItem={renderChapterCard}
              keyExtractor={item => `chapter-${item.id}`}
              contentContainerStyle={styles.chaptersList}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        )}

        {/* Stages Grid */}
        {activeTab === 'stages' && selectedChapter && (
          <ScrollView style={styles.stagesContainer} showsVerticalScrollIndicator={false}>
            {/* ✅ story banner wrapped in GlassCard */}
            <GlassCard style={styles.glassWrap}>
              <LinearGradient
                colors={CHAPTER_VISUALS[selectedChapter.id]?.bg || ['#1a1a1a', '#0a0a0a']}
                style={styles.storyBanner}
              >
                <Text style={styles.storyBannerIcon}>{CHAPTER_VISUALS[selectedChapter.id]?.icon}</Text>
                <Text style={styles.storyBannerTitle}>{selectedChapter.title}</Text>
                <Text style={styles.storyBannerSub}>{selectedChapter.subtitle}</Text>
                <Text style={styles.storyBannerSummary}>{selectedChapter.summary}</Text>
              </LinearGradient>
            </GlassCard>

            {/* Stage grid */}
            <View style={styles.stagesGrid}>
              {stages.map((stage, idx) => renderStageButton(stage, idx))}
            </View>

            {/* ✅ boss preview wrapped in GlassCard */}
            {stages.find(s => s.is_boss) && (
              <GlassCard style={styles.glassWrap}>
                <View style={styles.bossPreview}>
                  <Text style={styles.bossPreviewTitle}>👹 Chapter Boss</Text>
                  <Text style={styles.bossPreviewText}>
                    Defeat all stages to unlock the chapter boss!
                  </Text>
                </View>
              </GlassCard>
            )}
          </ScrollView>
        )}

        {/* Stage Detail Modal */}
        <Modal
          visible={!!selectedStage && !showBattleModal}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedStage(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.stageModal}>
              <LinearGradient
                colors={[COLORS.navy.primary, COLORS.navy.darkest]}
                style={styles.stageModalGradient}
              >
                {/* Close button */}
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setSelectedStage(null)}
                >
                  <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                </TouchableOpacity>

                {selectedStage && (
                  <>
                    {/* Stage header */}
                    <View style={styles.stageModalHeader}>
                      <Text style={styles.stageModalTitle}>
                        {selectedStage.is_boss ? '👹 BOSS STAGE' :
                          selectedStage.is_mini_boss ? '⚔️ ELITE STAGE' :
                            `Stage ${selectedStage.stage}`}
                      </Text>
                      <Text style={styles.stageModalSub}>
                        Chapter {selectedStage.chapter}-{selectedStage.stage}
                      </Text>
                    </View>

                    {/* Power requirement */}
                    <View style={styles.powerRequirement}>
                      <Text style={styles.powerLabel}>Recommended Power</Text>
                      <Text style={styles.powerValue}>
                        {formatNumber(selectedStage.recommended_player_power)}
                      </Text>
                    </View>

                    {/* Stamina cost */}
                    <View style={styles.staminaCost}>
                      <Ionicons name="flash" size={18} color="#22c55e" />
                      <Text style={styles.staminaCostText}>
                        Cost: {selectedStage.stamina_cost} Stamina
                      </Text>
                    </View>

                    {/* First clear rewards */}
                    {!selectedStage.is_cleared && selectedStage.first_clear_rewards && (
                      <View style={styles.rewardsSection}>
                        <Text style={styles.rewardsTitle}>🎁 First Clear Rewards</Text>
                        <View style={styles.rewardsGrid}>
                          {Object.entries(selectedStage.first_clear_rewards).map(([key, val]) => (
                            <View key={key} style={styles.rewardItem}>
                              <Text style={styles.rewardValue}>{formatNumber(val as number)}</Text>
                              <Text style={styles.rewardLabel}>{key.replace(/_/g, ' ')}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Already cleared */}
                    {selectedStage.is_cleared && (
                      <View style={styles.clearedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                        <Text style={styles.clearedText}>Stage Cleared!</Text>
                        <View style={styles.starsDisplay}>
                          {[1, 2, 3].map(star => (
                            <Ionicons
                              key={star}
                              name={star <= (selectedStage.stars || 0) ? 'star' : 'star-outline'}
                              size={16}
                              color={star <= (selectedStage.stars || 0) ? COLORS.gold.primary : COLORS.cream.dark}
                            />
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Special event indicator */}
                    {selectedStage.special_event && (
                      <View style={styles.specialEvent}>
                        <Text style={styles.specialEventTitle}>
                          ✨ {selectedStage.special_event.event}
                        </Text>
                        <Text style={styles.specialEventText}>
                          {selectedStage.special_event.narrative || selectedStage.special_event.hint}
                        </Text>
                      </View>
                    )}

                    {/* Battle button */}
                    <TouchableOpacity
                      style={[styles.battleButton, isBattling && styles.battleButtonDisabled]}
                      onPress={() => startBattle(selectedStage)}
                      disabled={isBattling}
                    >
                      <LinearGradient
                        colors={isBattling ? ['#555', '#333'] : [COLORS.gold.primary, COLORS.gold.dark]}
                        style={styles.battleButtonGradient}
                      >
                        {isBattling ? (
                          <ActivityIndicator color={COLORS.cream.pure} />
                        ) : (
                          <>
                            <Ionicons name="flash" size={20} color={COLORS.navy.darkest} />
                            <Text style={styles.battleButtonText}>
                              {selectedStage.is_cleared ? 'SWEEP' : 'BATTLE'}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* Battle Result Modal */}
        <Modal
          visible={showBattleModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBattleModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.battleModal}>
              <LinearGradient
                colors={battleResult?.victory ? ['#166534', '#14532d'] : ['#7f1d1d', '#450a0a']}
                style={styles.battleModalGradient}
              >
                {isBattling ? (
                  <View style={styles.battleLoading}>
                    <ActivityIndicator size="large" color={COLORS.cream.pure} />
                    <Text style={styles.battleLoadingText}>Fighting...</Text>
                  </View>
                ) : battleResult ? (
                  <>
                    <Text style={styles.battleResultTitle}>
                      {battleResult.victory ? '🎉 VICTORY!' : '💀 DEFEAT'}
                    </Text>

                    {battleResult.first_clear && (
                      <View style={styles.firstClearBadge}>
                        <Ionicons name="star" size={16} color={COLORS.gold.primary} />
                        <Text style={styles.firstClearText}>First Clear!</Text>
                      </View>
                    )}

                    {/* Stars earned */}
                    <View style={styles.starsEarned}>
                      {[1, 2, 3].map(star => (
                        <Ionicons
                          key={star}
                          name={star <= (battleResult.stars || 0) ? 'star' : 'star-outline'}
                          size={28}
                          color={star <= (battleResult.stars || 0) ? COLORS.gold.primary : COLORS.cream.dark}
                        />
                      ))}
                    </View>

                    {/* Rewards */}
                    {battleResult.rewards && Object.keys(battleResult.rewards).length > 0 && (
                      <View style={styles.battleRewards}>
                        <Text style={styles.battleRewardsTitle}>Rewards Earned</Text>
                        <View style={styles.battleRewardsGrid}>
                          {Object.entries(battleResult.rewards).map(([key, val]) => (
                            <View key={key} style={styles.battleRewardItem}>
                              <Text style={styles.battleRewardValue}>
                                +{formatNumber(val as number)}
                              </Text>
                              <Text style={styles.battleRewardLabel}>
                                {key.replace(/_/g, ' ')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Unlock notification */}
                    {battleResult.unlock_message && (
                      <View style={styles.unlockNotification}>
                        <Ionicons name="gift" size={20} color="#22c55e" />
                        <Text style={styles.unlockNotificationText}>
                          {battleResult.unlock_message}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() => {
                        setShowBattleModal(false);
                        setSelectedStage(null);
                      }}
                    >
                      <Text style={styles.continueButtonText}>Continue</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* Dialogue Modal */}
        <Modal
          visible={showDialogue}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDialogue(false)}
        >
          <TouchableOpacity
            style={styles.dialogueOverlay}
            activeOpacity={1}
            onPress={advanceDialogue}
          >
            <View style={styles.dialogueBox}>
              <LinearGradient
                colors={[COLORS.navy.primary, COLORS.navy.darkest]}
                style={styles.dialogueGradient}
              >
                {dialogueLines[currentDialogueIndex] && (
                  <>
                    <Text style={styles.dialogueSpeaker}>
                      {dialogueLines[currentDialogueIndex].speaker}
                    </Text>
                    <Text style={styles.dialogueText}>
                      "{dialogueLines[currentDialogueIndex].text}"
                    </Text>
                    <Text style={styles.dialogueTap}>Tap to continue...</Text>
                    <View style={styles.dialogueProgress}>
                      <Text style={styles.dialogueProgressText}>
                        {currentDialogueIndex + 1}/{dialogueLines.length}
                      </Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060A' },
  container: { flex: 1 },

  // GlassCard wrapper spacing helper
  glassWrap: { marginBottom: 20 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16, textAlign: 'center', marginBottom: 16 },
  loginBtn: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: COLORS.navy.darkest, fontWeight: 'bold' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold.primary + '30',
  },
  backButton: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  headerSubtitle: { fontSize: 12, color: COLORS.gold.light, marginTop: 2 },
  staminaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  staminaText: { color: COLORS.cream.pure, fontWeight: 'bold' },

  // Chapters
  chaptersContainer: { flex: 1 },
  chaptersList: { padding: 16, paddingBottom: 100 },

  // ✅ Premium chapter frame
  chapterCardOuter: { marginBottom: 16 },
  goldStrokeFrame: {
    borderRadius: 18,
    padding: 1.2,
    backgroundColor: 'rgba(255, 215, 140, 0.22)',
  },
  goldStrokeFrameLocked: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  goldStrokeInner: {
    borderRadius: 17,
    backgroundColor: 'rgba(10, 12, 18, 0.55)',
    overflow: 'hidden',
  },
  goldStrokeInnerLocked: {
    backgroundColor: 'rgba(10, 12, 18, 0.40)',
  },

  chapterCard: { borderRadius: 17, overflow: 'hidden' },
  chapterLocked: { opacity: 0.75 },
  chapterGradient: { padding: 16 },

  chapterSheen: {
    position: 'absolute',
    left: -40,
    top: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 215, 140, 0.06)',
  },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 16,
  },
  lockText: { color: COLORS.cream.dark, marginTop: 8, fontSize: 12 },

  chapterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chapterIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.navy.darkest + '80',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chapterIcon: { fontSize: 28 },
  chapterInfo: { flex: 1 },
  chapterNumber: { fontSize: 11, color: COLORS.gold.light, fontWeight: '600' },
  chapterTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  chapterSubtitle: { fontSize: 12, color: COLORS.cream.dark, fontStyle: 'italic' },
  completedBadge: { marginLeft: 8 },

  actBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  actText: { fontSize: 11, fontWeight: '600' },

  chapterSummary: { fontSize: 13, color: COLORS.cream.soft, lineHeight: 18, marginBottom: 12 },

  progressContainer: { marginBottom: 12 },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.navy.darkest,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 11, color: COLORS.cream.dark, textAlign: 'right' },

  chapterFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  powerReq: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  powerText: { fontSize: 12, color: COLORS.gold.light },
  unlockPreview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockText: { fontSize: 11, color: '#22c55e' },

  // Stages
  stagesContainer: { flex: 1, padding: 16 },

  storyBanner: { borderRadius: 16, padding: 20, alignItems: 'center' },
  storyBannerIcon: { fontSize: 40, marginBottom: 8 },
  storyBannerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  storyBannerSub: { fontSize: 14, color: COLORS.gold.light, fontStyle: 'italic', marginBottom: 8 },
  storyBannerSummary: { fontSize: 13, color: COLORS.cream.soft, textAlign: 'center', lineHeight: 18 },

  stagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  stageButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.navy.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.navy.light,
  },
  stageBoss: {
    width: 70,
    height: 70,
    borderRadius: 16,
    borderColor: '#ef4444',
    backgroundColor: '#7f1d1d40',
  },
  stageMiniBoss: {
    borderColor: COLORS.gold.primary,
    backgroundColor: COLORS.gold.dark + '30',
  },
  stageCleared: {
    borderColor: '#22c55e',
    backgroundColor: '#16653420',
  },
  stageLocked: {
    backgroundColor: COLORS.navy.darkest,
    borderColor: COLORS.navy.dark,
    opacity: 0.5,
  },
  stageStars: { flexDirection: 'row', marginBottom: 2 },
  stageNumber: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  bossIcon: { fontSize: 24 },

  bossPreview: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ef4444' + '50',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  bossPreviewTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 4 },
  bossPreviewText: { fontSize: 13, color: COLORS.cream.dark, textAlign: 'center' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  stageModal: { width: '100%', maxWidth: 380, borderRadius: 20, overflow: 'hidden' },
  stageModalGradient: { padding: 24 },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  stageModalHeader: { alignItems: 'center', marginBottom: 20 },
  stageModalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.cream.pure },
  stageModalSub: { fontSize: 14, color: COLORS.cream.dark, marginTop: 4 },
  powerRequirement: { alignItems: 'center', marginBottom: 16 },
  powerLabel: { fontSize: 12, color: COLORS.cream.dark },
  powerValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary },
  staminaCost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  staminaCostText: { fontSize: 14, color: '#22c55e' },
  rewardsSection: { marginBottom: 20 },
  rewardsTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12, textAlign: 'center' },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  rewardItem: { alignItems: 'center', minWidth: 70 },
  rewardValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold.primary },
  rewardLabel: { fontSize: 10, color: COLORS.cream.dark, textTransform: 'capitalize' },
  clearedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#16653420',
    borderRadius: 12,
  },
  clearedText: { fontSize: 16, color: '#22c55e', fontWeight: '600' },
  starsDisplay: { flexDirection: 'row', gap: 2 },
  specialEvent: {
    backgroundColor: COLORS.gold.primary + '20',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '50',
  },
  specialEventTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 4 },
  specialEventText: { fontSize: 12, color: COLORS.cream.soft, lineHeight: 16 },
  battleButton: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  battleButtonDisabled: { opacity: 0.6 },
  battleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  battleButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy.darkest, letterSpacing: 1 },

  // Battle Modal
  battleModal: { width: '100%', maxWidth: 350, borderRadius: 20, overflow: 'hidden' },
  battleModalGradient: { padding: 24, alignItems: 'center' },
  battleLoading: { alignItems: 'center', paddingVertical: 40 },
  battleLoadingText: { color: COLORS.cream.pure, marginTop: 12, fontSize: 16 },
  battleResultTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  firstClearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold.primary + '30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  firstClearText: { color: COLORS.gold.primary, fontWeight: 'bold' },
  starsEarned: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  battleRewards: { width: '100%', marginBottom: 20 },
  battleRewardsTitle: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 12 },
  battleRewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  battleRewardItem: { alignItems: 'center', minWidth: 70 },
  battleRewardValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary },
  battleRewardLabel: { fontSize: 10, color: COLORS.cream.dark, textTransform: 'capitalize' },
  unlockNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16653430',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  unlockNotificationText: { color: '#22c55e', fontSize: 13, flex: 1 },
  continueButton: {
    backgroundColor: COLORS.cream.pure,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  continueButtonText: { color: COLORS.navy.darkest, fontWeight: 'bold', fontSize: 16 },

  // Dialogue Modal
  dialogueOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 40,
  },
  dialogueBox: { borderRadius: 16, overflow: 'hidden' },
  dialogueGradient: { padding: 20 },
  dialogueSpeaker: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold.primary,
    marginBottom: 8,
  },
  dialogueText: {
    fontSize: 15,
    color: COLORS.cream.pure,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  dialogueTap: {
    fontSize: 11,
    color: COLORS.cream.dark,
    marginTop: 16,
    textAlign: 'center',
  },
  dialogueProgress: { alignItems: 'center', marginTop: 8 },
  dialogueProgressText: { fontSize: 11, color: COLORS.cream.dark },
});
