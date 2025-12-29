import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface LeaderboardEntry {
  rank: number;
  username: string;
  user_id: string;
  cr?: number;
  hero_count?: number;
  rating?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  win_streak?: number;
  highest_level?: number;
  total_clears?: number;
}

export default function LeaderboardScreen() {
  const { user } = useGameStore();
  const [selectedTab, setSelectedTab] = useState<'cr' | 'arena' | 'abyss'>('cr');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedTab]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/leaderboard/${selectedTab}?limit=100`
      );
      const data = await response.json();
      setLeaderboard(data);
      
      // Find current user in leaderboard
      if (user) {
        const userEntry = data.find((entry: LeaderboardEntry) => entry.username === user.username);
        setUserRank(userEntry || null);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return ['#FFD700', '#FFA500'];
    if (rank === 2) return ['#C0C0C0', '#A0A0A0'];
    if (rank === 3) return ['#CD7F32', '#B8860B'];
    return ['#FFFFFF', '#F0F0F0'];
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'cr': return 'stats-chart';
      case 'arena': return 'trophy';
      case 'abyss': return 'flame';
      default: return 'list';
    }
  };

  const renderLeaderboardEntry = (entry: LeaderboardEntry, index: number) => {
    const isCurrentUser = user?.username === entry.username;
    const isTopThree = entry.rank <= 3;
    
    return (
      <View key={entry.user_id || index} style={styles.entryContainer}>
        {isTopThree ? (
          <LinearGradient
            colors={getRankColor(entry.rank)}
            style={[styles.entryCard, isCurrentUser && styles.currentUserCard]}
          >
            {renderEntryContent(entry, isTopThree)}
          </LinearGradient>
        ) : (
          <View style={[styles.entryCard, styles.regularCard, isCurrentUser && styles.currentUserCard]}>
            {renderEntryContent(entry, isTopThree)}
          </View>
        )}
      </View>
    );
  };

  const renderEntryContent = (entry: LeaderboardEntry, isTopThree: boolean) => (
    <View style={styles.entryContent}>
      <View style={styles.rankSection}>
        <Text style={[styles.rankText, isTopThree && styles.rankTextTop]}>
          {getRankIcon(entry.rank)}
        </Text>
      </View>
      
      <View style={styles.userSection}>
        <Text style={[styles.username, isTopThree && styles.usernameTop]}>
          {entry.username}
        </Text>
        {selectedTab === 'cr' && (
          <Text style={[styles.subInfo, isTopThree && styles.subInfoTop]}>
            {entry.hero_count} heroes
          </Text>
        )}
        {selectedTab === 'arena' && (
          <Text style={[styles.subInfo, isTopThree && styles.subInfoTop]}>
            {entry.wins}W / {entry.losses}L ({entry.win_rate?.toFixed(1)}%)
          </Text>
        )}
        {selectedTab === 'abyss' && (
          <Text style={[styles.subInfo, isTopThree && styles.subInfoTop]}>
            {entry.total_clears} clears
          </Text>
        )}
      </View>
      
      <View style={styles.scoreSection}>
        {selectedTab === 'cr' && (
          <Text style={[styles.scoreText, isTopThree && styles.scoreTextTop]}>
            {entry.cr?.toLocaleString()}
          </Text>
        )}
        {selectedTab === 'arena' && (
          <>
            <Text style={[styles.scoreText, isTopThree && styles.scoreTextTop]}>
              {entry.rating}
            </Text>
            {entry.win_streak && entry.win_streak > 0 && (
              <Text style={styles.streakText}>🔥{entry.win_streak}</Text>
            )}
          </>
        )}
        {selectedTab === 'abyss' && (
          <Text style={[styles.scoreText, isTopThree && styles.scoreTextTop]}>
            Lv.{entry.highest_level}
          </Text>
        )}
      </View>
    </View>
  );

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
        <View style={styles.header}>
          <Text style={styles.title}>🏆 Leaderboards</Text>
          
          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            {(['cr', 'arena', 'abyss'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, selectedTab === tab && styles.tabActive]}
                onPress={() => setSelectedTab(tab)}
              >
                <Ionicons 
                  name={getTabIcon(tab) as any} 
                  size={18} 
                  color={selectedTab === tab ? '#FF1493' : '#FFF'} 
                />
                <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                  {tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Current User Rank */}
        {userRank && (
          <LinearGradient
            colors={['#FF1493', '#9400D3']}
            style={styles.userRankCard}
          >
            <Text style={styles.userRankLabel}>Your Rank</Text>
            <View style={styles.userRankContent}>
              <Text style={styles.userRankNumber}>#{userRank.rank}</Text>
              <View style={styles.userRankStats}>
                {selectedTab === 'cr' && (
                  <Text style={styles.userRankScore}>CR: {userRank.cr?.toLocaleString()}</Text>
                )}
                {selectedTab === 'arena' && (
                  <Text style={styles.userRankScore}>Rating: {userRank.rating}</Text>
                )}
                {selectedTab === 'abyss' && (
                  <Text style={styles.userRankScore}>Level: {userRank.highest_level}</Text>
                )}
              </View>
            </View>
          </LinearGradient>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.loadingText}>Loading rankings...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.leaderboardList}
            contentContainerStyle={styles.leaderboardContent}
          >
            {leaderboard.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="trophy-outline" size={64} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyText}>No rankings yet</Text>
                <Text style={styles.emptySubtext}>Be the first to compete!</Text>
              </View>
            ) : (
              leaderboard.map((entry, index) => renderLeaderboardEntry(entry, index))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#FFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tabTextActive: {
    color: '#FF1493',
  },
  userRankCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  userRankLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  userRankContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRankNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userRankStats: {
    alignItems: 'flex-end',
  },
  userRankScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 16,
  },
  leaderboardList: {
    flex: 1,
  },
  leaderboardContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  entryContainer: {
    marginBottom: 8,
  },
  entryCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  regularCard: {
    backgroundColor: '#FFF',
  },
  currentUserCard: {
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  entryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  rankSection: {
    width: 50,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  rankTextTop: {
    fontSize: 24,
    color: '#FFF',
  },
  userSection: {
    flex: 1,
    marginLeft: 8,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  usernameTop: {
    color: '#FFF',
  },
  subInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  subInfoTop: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scoreSection: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF1493',
  },
  scoreTextTop: {
    color: '#FFF',
    fontSize: 20,
  },
  streakText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  errorText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});
