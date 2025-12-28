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
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/abyss/progress/${user.username}`);
      const data = await response.json();
      setProgress(data);
    } catch (error) {
      console.error('Failed to load abyss progress:', error);
    }
  };

  const battleLevel = async (level: number) => {
    setIsLoading(true);
    try {
      // For now, use a simple team setup - this would be enhanced later
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/abyss/battle/${user.username}/${level}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_ids: [] }) // Empty for now
      });
      
      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          result.victory ? '🎉 Victory!' : '💀 Defeat',
          `Level ${level}\n\n` +
          `Your Power: ${result.user_power.toLocaleString()}\n` +
          `Enemy Power: ${result.enemy_power.toLocaleString()}\n\n` +
          (result.victory ? 
            `Rewards:\n💰 Coins: +${result.rewards.coins}\n⭐ Gold: +${result.rewards.gold}\n${result.rewards.gems > 0 ? `💎 Gems: +${result.rewards.gems}` : ''}` :
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
      <LinearGradient colors={['#4B0082', '#8B008B', '#FF1493']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#4B0082', '#8B008B', '#FF1493']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>🔥 Endless Abyss</Text>
          <Text style={styles.subtitle}>Test your might against infinite challenges</Text>

          {progress && (
            <LinearGradient
              colors={['#FF6347', '#FF1493']}
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
                      !isUnlocked ? ['#666', '#444'] :
                      isCurrent ? ['#FF1493', '#9400D3'] :
                      ['#32CD32', '#00CED1']
                    }
                    style={styles.levelButtonGradient}
                  >
                    <View style={styles.levelInfo}>
                      <Text style={styles.levelNumber}>Level {level}</Text>
                      <Text style={styles.levelDifficulty}>
                        {level > 1000 ? 'Nightmare' : level > 200 ? 'Hard' : 'Normal'}
                      </Text>
                    </View>
                    <View style={styles.levelRewards}>
                      <Text style={styles.rewardText}>💰 {level * 100}</Text>
                      <Text style={styles.rewardText}>⭐ {level * 50}</Text>
                      {level % 10 === 0 && <Text style={styles.rewardText}>💎 {level / 10}</Text>}
                    </View>
                    {!isUnlocked && <Ionicons name="lock-closed" size={24} color="#FFF" />}
                    {isCurrent && <Ionicons name="play" size={24} color="#FFF" />}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.loadingText}>Battling...</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
  },
  progressCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressItem: {
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  levelsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  levelButton: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  levelButtonLocked: {
    opacity: 0.6,
  },
  levelButtonGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelInfo: {
    flex: 1,
  },
  levelNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  levelDifficulty: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
  },
  levelRewards: {
    alignItems: 'flex-end',
    marginRight: 16,
  },
  rewardText: {
    fontSize: 12,
    color: '#FFF',
    marginBottom: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});