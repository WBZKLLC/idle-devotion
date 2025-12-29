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
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

export default function AbyssScreen() {
  const { user } = useGameStore();
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadAbyssProgress();
    }
  }, [user]);

  const loadAbyssProgress = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/abyss/progress/${user?.username}`);
      const data = await response.json();
      setProgress(data);
    } catch (error) {
      console.error('Failed to load abyss progress:', error);
    }
  };

  const battleLevel = async (level: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/abyss/battle/${user?.username}/${level}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_ids: [] })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          result.victory ? 'Victory!' : 'Defeat',
          `Level ${level}\n\n` +
          `Your Power: ${result.user_power.toLocaleString()}\n` +
          `Enemy Power: ${result.enemy_power.toLocaleString()}\n\n` +
          (result.victory ? 
            `Rewards:\nCoins: +${result.rewards.coins}\nGold: +${result.rewards.gold}\n${result.rewards.gems > 0 ? `Gems: +${result.rewards.gems}` : ''}` :
            'Try again with stronger heroes!')
        );
        
        if (result.victory) {
          loadAbyssProgress();
        }
      } else {
        Alert.alert('Error', result.detail || 'Battle failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to battle');
    } finally {
      setIsLoading(false);
    }
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

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Endless Abyss</Text>
          <Text style={styles.subtitle}>Test your might against infinite challenges</Text>

          {progress && (
            <LinearGradient
              colors={[COLORS.rarity.UR, COLORS.rarity['UR+']]}
              style={styles.progressCard}
            >
              <View style={styles.progressRow}>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Current Level</Text>
                  <Text style={styles.progressValue}>{progress.current_level}</Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Highest Level</Text>
                  <Text style={styles.progressValue}>{progress.highest_level}</Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Total Clears</Text>
                  <Text style={styles.progressValue}>{progress.total_clears}</Text>
                </View>
              </View>
            </LinearGradient>
          )}

          <View style={styles.levelsContainer}>
            <Text style={styles.sectionTitle}>Available Levels</Text>
            
            {progress && Array.from({ length: Math.min(progress.current_level + 2, progress.current_level + 10) }, (_, i) => {
              const level = Math.max(1, progress.current_level - 5 + i);
              const isUnlocked = level <= progress.current_level || level <= progress.highest_level;
              const isCurrent = level === progress.current_level;
              
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelButton, !isUnlocked && styles.levelButtonLocked]}
                  onPress={() => isUnlocked ? battleLevel(level) : null}
                  disabled={!isUnlocked || isLoading}
                >
                  <LinearGradient
                    colors={
                      !isUnlocked ? [COLORS.navy.medium, COLORS.navy.dark] :
                      isCurrent ? [COLORS.gold.primary, COLORS.gold.dark] :
                      [COLORS.success, COLORS.navy.light]
                    }
                    style={styles.levelButtonGradient}
                  >
                    <View style={styles.levelInfo}>
                      <Text style={[styles.levelNumber, !isUnlocked && styles.levelNumberLocked]}>Level {level}</Text>
                      <Text style={[styles.levelDifficulty, !isUnlocked && styles.levelDifficultyLocked]}>
                        {level > 1000 ? 'Nightmare' : level > 200 ? 'Hard' : 'Normal'}
                      </Text>
                    </View>
                    <View style={styles.levelRewards}>
                      <Text style={[styles.rewardText, !isUnlocked && styles.rewardTextLocked]}>💰 {level * 100}</Text>
                      <Text style={[styles.rewardText, !isUnlocked && styles.rewardTextLocked]}>⭐ {level * 50}</Text>
                      {level % 10 === 0 && <Text style={[styles.rewardText, !isUnlocked && styles.rewardTextLocked]}>💎 {level / 10}</Text>}
                    </View>
                    {!isUnlocked && <Ionicons name="lock-closed" size={24} color={COLORS.navy.light} />}
                    {isCurrent && <Ionicons name="play" size={24} color={COLORS.navy.darkest} />}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.gold.primary} />
              <Text style={styles.loadingText}>Battling...</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 8, letterSpacing: 1 },
  subtitle: { fontSize: 16, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 24 },
  progressCard: { borderRadius: 16, padding: 20, marginBottom: 24 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-around' },
  progressItem: { alignItems: 'center' },
  progressLabel: { fontSize: 12, color: COLORS.cream.soft, opacity: 0.8, marginBottom: 4 },
  progressValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure },
  levelsContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.light, marginBottom: 16 },
  levelButton: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  levelButtonLocked: { opacity: 0.6 },
  levelButtonGradient: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  levelInfo: { flex: 1 },
  levelNumber: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy.darkest, marginBottom: 4 },
  levelNumberLocked: { color: COLORS.cream.dark },
  levelDifficulty: { fontSize: 12, color: COLORS.navy.medium },
  levelDifficultyLocked: { color: COLORS.cream.dark },
  levelRewards: { alignItems: 'flex-end', marginRight: 16 },
  rewardText: { fontSize: 12, color: COLORS.navy.darkest, marginBottom: 2 },
  rewardTextLocked: { color: COLORS.cream.dark },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10, 22, 40, 0.9)', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.gold.primary, fontSize: 16, marginTop: 12 },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
