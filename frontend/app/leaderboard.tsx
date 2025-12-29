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
import COLORS from '../theme/colors';

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

  const getRankColors = (rank: number): [string, string] => {
    if (rank === 1) return [COLORS.gold.primary, COLORS.gold.dark];
    if (rank === 2) return ['#C0C0C0', '#A0A0A0'];
    if (rank === 3) return ['#CD7F32', '#B8860B'];
    return [COLORS.navy.medium, COLORS.navy.primary];
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
            colors={getRankColors(entry.rank)}
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
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboards</Text>
          
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
                  color={selectedTab === tab ? COLORS.navy.darkest : COLORS.cream.soft} 
                />
                <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                  {tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {userRank && (
          <LinearGradient
            colors={[COLORS.gold.primary, COLORS.gold.dark]}
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
            <ActivityIndicator size="large" color={COLORS.gold.primary} />
            <Text style={styles.loadingText}>Loading rankings...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.leaderboardList}
            contentContainerStyle={styles.leaderboardContent}
          >
            {leaderboard.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="trophy-outline" size={64} color={COLORS.navy.light} />
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
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 16, letterSpacing: 1 },
  tabContainer: { flexDirection: 'row', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabActive: { backgroundColor: COLORS.gold.primary },
  tabText: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.soft },
  tabTextActive: { color: COLORS.navy.darkest },
  userRankCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16 },
  userRankLabel: { fontSize: 12, color: COLORS.navy.darkest, opacity: 0.8, marginBottom: 4 },
  userRankContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userRankNumber: { fontSize: 32, fontWeight: 'bold', color: COLORS.navy.darkest },
  userRankStats: { alignItems: 'flex-end' },
  userRankScore: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy.darkest },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12, fontSize: 16 },
  leaderboardList: { flex: 1 },
  leaderboardContent: { paddingHorizontal: 16, paddingBottom: 100 },
  entryContainer: { marginBottom: 8 },
  entryCard: { borderRadius: 12, overflow: 'hidden' },
  regularCard: { backgroundColor: COLORS.navy.medium, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  currentUserCard: { borderWidth: 2, borderColor: COLORS.gold.primary },
  entryContent: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  rankSection: { width: 50, alignItems: 'center' },
  rankText: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.soft },
  rankTextTop: { fontSize: 24, color: COLORS.navy.darkest },
  userSection: { flex: 1, marginLeft: 8 },
  username: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  usernameTop: { color: COLORS.navy.darkest },
  subInfo: { fontSize: 12, color: COLORS.cream.dark, marginTop: 2 },
  subInfoTop: { color: COLORS.navy.medium },
  scoreSection: { alignItems: 'flex-end' },
  scoreText: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary },
  scoreTextTop: { color: COLORS.navy.darkest, fontSize: 20 },
  streakText: { fontSize: 12, color: COLORS.gold.light, marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.cream.dark, marginTop: 4 },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
