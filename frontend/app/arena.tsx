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
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/arena/record/${user?.username}`),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/leaderboard/arena?limit=10`)
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
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/arena/battle/${user?.username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: 'default' })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          result.victory ? 'Victory!' : 'Defeat',
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

  const getRankColors = (rank: number): [string, string] => {
    if (rank === 1) return [COLORS.gold.primary, COLORS.gold.dark];
    if (rank <= 3) return ['#C0C0C0', '#A0A0A0'];
    if (rank <= 10) return ['#CD7F32', '#B8860B'];
    return [COLORS.navy.medium, COLORS.navy.primary];
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
          <Text style={styles.title}>PvP Arena</Text>
          <Text style={styles.subtitle}>Battle other players for glory and rewards</Text>

          {record && (
            <LinearGradient
              colors={[COLORS.gold.primary, COLORS.gold.dark]}
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
              colors={[COLORS.rarity.UR, COLORS.rarity['UR+']]}
              style={styles.battleButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.cream.pure} size="large" />
              ) : (
                <>
                  <Ionicons name="flash" size={32} color={COLORS.cream.pure} />
                  <Text style={styles.battleButtonText}>Find Match</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.leaderboardContainer}>
            <Text style={styles.sectionTitle}>Top Players</Text>
            
            {leaderboard.map((player, index) => (
              <View key={player.user_id} style={styles.leaderboardItem}>
                <LinearGradient
                  colors={getRankColors(player.rank)}
                  style={styles.leaderboardGradient}
                >
                  <View style={styles.rankSection}>
                    <Text style={[styles.rankText, index < 3 && styles.rankTextTop]}>
                      #{player.rank}
                    </Text>
                    {index < 3 && (
                      <Ionicons 
                        name={index === 0 ? "trophy" : index === 1 ? "medal" : "ribbon"} 
                        size={20} 
                        color={index === 0 ? COLORS.navy.darkest : COLORS.navy.dark} 
                      />
                    )}
                  </View>
                  
                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, index < 3 && styles.playerNameTop]}>{player.username}</Text>
                    <Text style={[styles.playerStats, index < 3 && styles.playerStatsTop]}>
                      {player.rating} • {player.wins}W/{player.losses}L • {player.win_rate.toFixed(1)}%
                    </Text>
                  </View>
                  
                  <View style={styles.streakBadge}>
                    <Text style={[styles.streakText, index < 3 && styles.streakTextTop]}>{player.win_streak}</Text>
                    <Text style={[styles.streakLabel, index < 3 && styles.streakLabelTop]}>streak</Text>
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
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 8, letterSpacing: 1 },
  subtitle: { fontSize: 16, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 24 },
  recordCard: { borderRadius: 16, padding: 20, marginBottom: 24 },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  recordTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy.darkest },
  ratingBadge: { backgroundColor: COLORS.navy.darkest + '40', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  ratingValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.navy.darkest },
  ratingLabel: { fontSize: 12, color: COLORS.navy.dark },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy.darkest, marginBottom: 4 },
  statLabel: { fontSize: 12, color: COLORS.navy.dark },
  battleButton: { marginBottom: 24, borderRadius: 16, overflow: 'hidden' },
  battleButtonGradient: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  battleButtonText: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  leaderboardContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.light, marginBottom: 16 },
  leaderboardItem: { marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  leaderboardGradient: { padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  rankSection: { flexDirection: 'row', alignItems: 'center', width: 60, gap: 4 },
  rankText: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.soft },
  rankTextTop: { color: COLORS.navy.darkest },
  playerInfo: { flex: 1, marginLeft: 12 },
  playerName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 2 },
  playerNameTop: { color: COLORS.navy.darkest },
  playerStats: { fontSize: 12, color: COLORS.cream.dark },
  playerStatsTop: { color: COLORS.navy.medium },
  streakBadge: { backgroundColor: COLORS.navy.darkest + '30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center' },
  streakText: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary },
  streakTextTop: { color: COLORS.navy.darkest },
  streakLabel: { fontSize: 10, color: COLORS.gold.light },
  streakLabelTop: { color: COLORS.navy.medium },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
