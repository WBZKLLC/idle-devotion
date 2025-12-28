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

export default function ArenaScreen() {
  const { user } = useGameStore();
  const [record, setRecord] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadArenaData();
    }
  }, [user]);

  const loadArenaData = async () => {
    try {
      const [recordResponse, leaderboardResponse] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/arena/record/${user.username}`),
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/leaderboard/arena?limit=10`)
      ]);
      
      const recordData = await recordResponse.json();
      const leaderboardData = await leaderboardResponse.json();
      
      setRecord(recordData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Failed to load arena data:', error);
    }
  };

  const battle = async () => {
    setIsLoading(true);
    try {
      // For now, use a simple team setup - this would be enhanced later
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/arena/battle/${user.username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: 'default' }) // Placeholder
      });
      
      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          result.victory ? '🏆 Victory!' : '💀 Defeat',
          `vs ${result.opponent_username}\n\n` +
          `Your Power: ${result.user_power.toLocaleString()}\n` +
          `Opponent Power: ${result.opponent_power.toLocaleString()}\n\n` +
          `Rating Change: ${result.rating_change > 0 ? '+' : ''}${result.rating_change}\n` +
          `New Rating: ${result.new_rating}\n` +
          `Win Streak: ${result.win_streak}`
        );
        
        loadArenaData();
      } else {
        Alert.alert('Error', result.detail || 'Battle failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to battle');
    } finally {
      setIsLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank <= 3) return '#C0C0C0'; // Silver
    if (rank <= 10) return '#CD7F32'; // Bronze
    return '#FFF';
  };

  if (!user) {
    return (
      <LinearGradient colors={['#FF6347', '#FF1493', '#9400D3']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FF6347', '#FF1493', '#9400D3']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>🏆 PvP Arena</Text>
          <Text style={styles.subtitle}>Battle other players for glory and rewards</Text>

          {record && (
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.recordCard}
            >
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>Your Arena Record</Text>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingValue}>{record.rating}</Text>
                  <Text style={styles.ratingLabel}>Rating</Text>
                </View>
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{record.wins}</Text>
                  <Text style={styles.statLabel}>Wins</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{record.losses}</Text>
                  <Text style={styles.statLabel}>Losses</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{record.win_streak}</Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{record.highest_rating}</Text>
                  <Text style={styles.statLabel}>Best</Text>
                </View>
              </View>
            </LinearGradient>
          )}

          <TouchableOpacity
            style={styles.battleButton}
            onPress={battle}
            disabled={isLoading}
          >
            <LinearGradient
              colors={['#FF1493', '#9400D3']}
              style={styles.battleButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" size="large" />
              ) : (
                <>
                  <Ionicons name="sword" size={32} color="#FFF" />
                  <Text style={styles.battleButtonText}>Find Match</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.leaderboardContainer}>
            <Text style={styles.sectionTitle}>🏅 Top Players</Text>
            
            {leaderboard.map((player, index) => (
              <View key={player.user_id} style={styles.leaderboardItem}>
                <LinearGradient
                  colors={
                    index === 0 ? ['#FFD700', '#FFA500'] :
                    index === 1 ? ['#C0C0C0', '#A0A0A0'] :
                    index === 2 ? ['#CD7F32', '#B8860B'] :
                    ['#FFFFFF', '#F0F0F0']
                  }
                  style={styles.leaderboardGradient}
                >
                  <View style={styles.rankSection}>
                    <Text style={[styles.rankText, { color: getRankColor(player.rank) }]}>
                      #{player.rank}
                    </Text>
                    {index < 3 && (
                      <Ionicons 
                        name={index === 0 ? "trophy" : index === 1 ? "medal" : "ribbon"} 
                        size={20} 
                        color={getRankColor(player.rank)} 
                      />
                    )}
                  </View>
                  
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.username}</Text>
                    <Text style={styles.playerStats}>
                      {player.rating} • {player.wins}W/{player.losses}L • {player.win_rate.toFixed(1)}%
                    </Text>
                  </View>
                  
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakText}>{player.win_streak}</Text>
                    <Text style={styles.streakLabel}>streak</Text>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>
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
  recordCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  ratingBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
  },
  battleButton: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  battleButtonGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  battleButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  leaderboardContainer: {
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
  leaderboardItem: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  leaderboardGradient: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    gap: 4,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  playerStats: {
    fontSize: 12,
    color: '#666',
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 20, 147, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  streakText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF1493',
  },
  streakLabel: {
    fontSize: 10,
    color: '#FF1493',
  },
  errorText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});