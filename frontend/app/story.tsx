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
  Modal,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

export default function StoryScreen() {
  const { user, fetchUser } = useGameStore();
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBattling, setIsBattling] = useState(false);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [showBattleResult, setShowBattleResult] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  const loadProgress = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/story/progress/${user?.username}`
      );
      const data = await response.json();
      setProgress(data);
      setSelectedChapter(data.current_chapter || 1);
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const battleStage = async (chapter: number, stage: number) => {
    setIsBattling(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/story/battle/${user?.username}/${chapter}/${stage}`,
        { method: 'POST' }
      );
      
      const result = await response.json();
      setBattleResult(result);
      setShowBattleResult(true);
      
      if (result.victory) {
        loadProgress();
        fetchUser();
      }
    } catch (error) {
      Alert.alert('Error', 'Battle failed');
    } finally {
      setIsBattling(false);
    }
  };

  const renderStars = (count: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3].map(i => (
          <Ionicons
            key={i}
            name={i <= count ? 'star' : 'star-outline'}
            size={12}
            color={i <= count ? COLORS.gold.primary : COLORS.navy.light}
          />
        ))}
      </View>
    );
  };

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentChapterData = progress?.chapters?.find((c: any) => c.chapter === selectedChapter);

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Campaign</Text>
          
          {/* Total Stars */}
          <LinearGradient
            colors={[COLORS.gold.primary, COLORS.gold.dark]}
            style={styles.progressCard}
          >
            <Ionicons name="star" size={28} color={COLORS.navy.darkest} />
            <View style={styles.progressInfo}>
              <Text style={styles.progressLabel}>Total Stars</Text>
              <Text style={styles.progressValue}>{progress?.total_stars || 0}</Text>
            </View>
          </LinearGradient>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.gold.primary} style={styles.loader} />
          ) : (
            <>
              {/* Chapter Selection */}
              <View style={styles.chapterTabs}>
                {progress?.chapters?.map((chapter: any) => (
                  <TouchableOpacity
                    key={chapter.chapter}
                    style={[
                      styles.chapterTab,
                      selectedChapter === chapter.chapter && styles.chapterTabActive,
                      !chapter.unlocked && styles.chapterTabLocked
                    ]}
                    onPress={() => chapter.unlocked ? setSelectedChapter(chapter.chapter) : null}
                    disabled={!chapter.unlocked}
                  >
                    {!chapter.unlocked && (
                      <Ionicons name="lock-closed" size={14} color={COLORS.navy.light} />
                    )}
                    <Text style={[
                      styles.chapterTabText,
                      selectedChapter === chapter.chapter && styles.chapterTabTextActive
                    ]}>
                      Ch.{chapter.chapter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Chapter Title */}
              {currentChapterData && (
                <View style={styles.chapterHeader}>
                  <Text style={styles.chapterTitle}>
                    Chapter {currentChapterData.chapter}: {currentChapterData.name}
                  </Text>
                </View>
              )}
              
              {/* Stages */}
              <View style={styles.stagesContainer}>
                {currentChapterData?.stages?.map((stage: any, index: number) => {
                  const isBoss = stage.is_boss;
                  const isCompleted = stage.completed;
                  const isUnlocked = stage.unlocked;
                  
                  return (
                    <TouchableOpacity
                      key={stage.stage}
                      style={[
                        styles.stageCard,
                        isBoss && styles.stageCardBoss,
                        !isUnlocked && styles.stageCardLocked,
                        isCompleted && styles.stageCardCompleted
                      ]}
                      onPress={() => isUnlocked ? battleStage(selectedChapter, stage.stage) : null}
                      disabled={!isUnlocked || isBattling}
                    >
                      <LinearGradient
                        colors={
                          !isUnlocked ? [COLORS.navy.medium, COLORS.navy.dark] :
                          isBoss ? [COLORS.rarity.UR, COLORS.rarity['UR+']] :
                          isCompleted ? [COLORS.success, '#0d5c2e'] :
                          [COLORS.gold.primary, COLORS.gold.dark]
                        }
                        style={styles.stageGradient}
                      >
                        <View style={styles.stageHeader}>
                          <View style={styles.stageNumber}>
                            {isBoss ? (
                              <Ionicons name="skull" size={20} color={COLORS.cream.pure} />
                            ) : (
                              <Text style={styles.stageNumberText}>{stage.stage}</Text>
                            )}
                          </View>
                          {isCompleted && renderStars(stage.stars)}
                        </View>
                        
                        <Text style={[
                          styles.stageName,
                          !isUnlocked && styles.stageNameLocked
                        ]}>
                          {stage.name}
                        </Text>
                        
                        <View style={styles.stageInfo}>
                          <Text style={styles.stagePower}>
                            ⚔️ {stage.enemy_power?.toLocaleString()}
                          </Text>
                        </View>
                        
                        {!isUnlocked && (
                          <View style={styles.lockedOverlay}>
                            <Ionicons name="lock-closed" size={32} color={COLORS.cream.dark} />
                          </View>
                        )}
                        
                        {isBattling && isUnlocked && (
                          <View style={styles.battleOverlay}>
                            <ActivityIndicator color={COLORS.cream.pure} />
                          </View>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
        
        {/* Battle Result Modal */}
        <Modal
          visible={showBattleResult}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowBattleResult(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={battleResult?.victory ? [COLORS.success, '#0d5c2e'] : [COLORS.error, '#8B0000']}
                style={styles.resultHeader}
              >
                <Ionicons 
                  name={battleResult?.victory ? 'trophy' : 'close-circle'} 
                  size={48} 
                  color={COLORS.cream.pure} 
                />
                <Text style={styles.resultTitle}>
                  {battleResult?.victory ? 'Victory!' : 'Defeat!'}
                </Text>
                {battleResult?.is_boss && battleResult?.victory && (
                  <Text style={styles.bossText}>🎉 BOSS DEFEATED!</Text>
                )}
              </LinearGradient>
              
              <View style={styles.resultBody}>
                <View style={styles.powerComparison}>
                  <View style={styles.powerItem}>
                    <Text style={styles.powerLabel}>Your Power</Text>
                    <Text style={styles.powerValue}>{battleResult?.team_power?.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.vs}>VS</Text>
                  <View style={styles.powerItem}>
                    <Text style={styles.powerLabel}>Enemy Power</Text>
                    <Text style={styles.powerValue}>{battleResult?.enemy_power?.toLocaleString()}</Text>
                  </View>
                </View>
                
                {battleResult?.victory && battleResult?.stars > 0 && (
                  <View style={styles.starsEarned}>
                    <Text style={styles.starsLabel}>Stars Earned</Text>
                    <View style={styles.bigStars}>
                      {[1, 2, 3].map(i => (
                        <Ionicons
                          key={i}
                          name={i <= battleResult.stars ? 'star' : 'star-outline'}
                          size={32}
                          color={i <= battleResult.stars ? COLORS.gold.primary : COLORS.navy.light}
                        />
                      ))}
                    </View>
                  </View>
                )}
                
                {battleResult?.victory && battleResult?.rewards && (
                  <View style={styles.rewardsSection}>
                    <Text style={styles.rewardsTitle}>Rewards</Text>
                    <View style={styles.rewardsGrid}>
                      {Object.entries(battleResult.rewards).map(([type, amount]) => (
                        <View key={type} style={styles.rewardItem}>
                          <Text style={styles.rewardAmount}>+{(amount as number).toLocaleString()}</Text>
                          <Text style={styles.rewardType}>{type}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowBattleResult(false)}
              >
                <Text style={styles.closeButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 16 },
  progressCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  progressInfo: { marginLeft: 16 },
  progressLabel: { fontSize: 14, color: COLORS.navy.dark },
  progressValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.navy.darkest },
  loader: { marginTop: 40 },
  chapterTabs: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  chapterTab: { flex: 1, paddingVertical: 10, backgroundColor: COLORS.navy.medium, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.navy.light },
  chapterTabActive: { backgroundColor: COLORS.gold.primary, borderColor: COLORS.gold.primary },
  chapterTabLocked: { opacity: 0.5 },
  chapterTabText: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.soft },
  chapterTabTextActive: { color: COLORS.navy.darkest },
  chapterHeader: { marginBottom: 16 },
  chapterTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.light },
  stagesContainer: { gap: 12 },
  stageCard: { borderRadius: 16, overflow: 'hidden' },
  stageCardBoss: {},
  stageCardLocked: { opacity: 0.6 },
  stageCardCompleted: {},
  stageGradient: { padding: 16, minHeight: 100 },
  stageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stageNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.navy.darkest + '40', alignItems: 'center', justifyContent: 'center' },
  stageNumberText: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  starsRow: { flexDirection: 'row', gap: 2 },
  stageName: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  stageNameLocked: { color: COLORS.cream.dark },
  stageInfo: { flexDirection: 'row', alignItems: 'center' },
  stagePower: { fontSize: 14, color: COLORS.cream.soft },
  lockedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  battleOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { backgroundColor: COLORS.navy.primary, borderRadius: 20, width: '90%', overflow: 'hidden' },
  resultHeader: { padding: 24, alignItems: 'center' },
  resultTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  bossText: { fontSize: 16, color: COLORS.gold.primary, marginTop: 8, fontWeight: 'bold' },
  resultBody: { padding: 20 },
  powerComparison: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 },
  powerItem: { alignItems: 'center' },
  powerLabel: { fontSize: 12, color: COLORS.cream.dark },
  powerValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  vs: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.dark },
  starsEarned: { alignItems: 'center', marginBottom: 20 },
  starsLabel: { fontSize: 14, color: COLORS.cream.dark, marginBottom: 8 },
  bigStars: { flexDirection: 'row', gap: 8 },
  rewardsSection: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16 },
  rewardsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12, textAlign: 'center' },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  rewardItem: { alignItems: 'center', minWidth: 70 },
  rewardAmount: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold.primary },
  rewardType: { fontSize: 10, color: COLORS.cream.dark, textTransform: 'capitalize' },
  closeButton: { backgroundColor: COLORS.gold.primary, margin: 20, marginTop: 0, padding: 16, borderRadius: 12, alignItems: 'center' },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
