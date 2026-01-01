import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import COLORS from '../theme/colors';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL 
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api` 
  : '/api';

interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  avatar_frame?: string;
  vip_level?: number;
}

type LeaderboardType = 'power' | 'arena' | 'abyss' | 'campaign';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeType, setActiveType] = useState<LeaderboardType>('power');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  }, []);

  useEffect(() => {
    if (hydrated) {
      loadLeaderboard();
    }
  }, [hydrated, activeType]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/leaderboard/${activeType}?limit=50`).catch(() => ({ data: [] }));
      const data = response.data || [];
      
      // Add rank numbers
      const rankedData = data.map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1,
      }));
      
      setEntries(rankedData.length > 0 ? rankedData : generateMockData());
      
      // Find user's rank
      if (user) {
        const userEntry = rankedData.find((e: any) => e.username === user.username);
        setUserRank(userEntry || { rank: 999, username: user.username, score: user.total_power || 0 });
      }
    } catch (error) {
      setEntries(generateMockData());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateMockData = (): LeaderboardEntry[] => {
    const names = ['DragonSlayer', 'ShadowMaster', 'LightBringer', 'StormCaller', 'IronFist', 'CrystalMage', 'VoidWalker', 'PhoenixRider', 'ThunderLord', 'FrostQueen'];
    return names.map((name, i) => ({
      rank: i + 1,
      username: name,
      score: Math.floor(100000 - (i * 8000) + (Math.random() * 2000)),
      vip_level: Math.max(0, 10 - i),
    }));
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { colors: ['#FFD700', '#FFA500'], icon: '🥇' };
    if (rank === 2) return { colors: ['#C0C0C0', '#A0A0A0'], icon: '🥈' };
    if (rank === 3) return { colors: ['#CD7F32', '#8B4513'], icon: '🥉' };
    if (rank <= 10) return { colors: ['#8b5cf6', '#6d28d9'], icon: '⭐' };
    if (rank <= 50) return { colors: ['#3b82f6', '#1d4ed8'], icon: '' };
    return { colors: [COLORS.navy.medium, COLORS.navy.primary], icon: '' };
  };

  const formatScore = (score: number) => {
    if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
    if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
    return score.toString();
  };

  const getLeaderboardConfig = (type: LeaderboardType) => {
    switch (type) {
      case 'power': return { title: 'Total Power', icon: 'flash', color: '#f59e0b' };
      case 'arena': return { title: 'Arena Rating', icon: 'trophy', color: '#dc2626' };
      case 'abyss': return { title: 'Abyss Floor', icon: 'chevron-down-circle', color: '#22c55e' };
      case 'campaign': return { title: 'Campaign', icon: 'book', color: '#3b82f6' };
    }
  };

  const config = getLeaderboardConfig(activeType);

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading Rankings...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏆 Leaderboards</Text>
          <TouchableOpacity onPress={loadLeaderboard}>
            <Ionicons name="refresh" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
        </View>

        {/* Type Tabs */}
        <ScrollView horizontal style={styles.tabsContainer} showsHorizontalScrollIndicator={false}>
          {(['power', 'arena', 'abyss', 'campaign'] as const).map(type => {
            const typeConfig = getLeaderboardConfig(type);
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeTab, activeType === type && { backgroundColor: typeConfig.color + '40', borderColor: typeConfig.color }]}
                onPress={() => setActiveType(type)}
              >
                <Ionicons name={typeConfig.icon as any} size={16} color={activeType === type ? typeConfig.color : COLORS.cream.dark} />
                <Text style={[styles.typeTabText, activeType === type && { color: typeConfig.color }]}>
                  {typeConfig.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Top 3 Podium */}
        {entries.length >= 3 && (
          <View style={styles.podium}>
            {/* 2nd Place */}
            <Animated.View style={[styles.podiumItem, { transform: [{ scale: scaleAnim }] }]}>
              <View style={[styles.podiumRank, { backgroundColor: '#C0C0C0' }]}>
                <Text style={styles.podiumRankText}>🥈</Text>
              </View>
              <Text style={styles.podiumName}>{entries[1]?.username}</Text>
              <Text style={styles.podiumScore}>{formatScore(entries[1]?.score || 0)}</Text>
              <View style={[styles.podiumBar, { height: 60, backgroundColor: '#C0C0C080' }]} />
            </Animated.View>

            {/* 1st Place */}
            <Animated.View style={[styles.podiumItem, styles.podiumFirst, { transform: [{ scale: scaleAnim }] }]}>
              <View style={[styles.podiumRank, { backgroundColor: '#FFD700' }]}>
                <Text style={styles.podiumRankText}>🥇</Text>
              </View>
              <Text style={styles.podiumName}>{entries[0]?.username}</Text>
              <Text style={styles.podiumScore}>{formatScore(entries[0]?.score || 0)}</Text>
              <View style={[styles.podiumBar, { height: 80, backgroundColor: '#FFD70080' }]} />
            </Animated.View>

            {/* 3rd Place */}
            <Animated.View style={[styles.podiumItem, { transform: [{ scale: scaleAnim }] }]}>
              <View style={[styles.podiumRank, { backgroundColor: '#CD7F32' }]}>
                <Text style={styles.podiumRankText}>🥉</Text>
              </View>
              <Text style={styles.podiumName}>{entries[2]?.username}</Text>
              <Text style={styles.podiumScore}>{formatScore(entries[2]?.score || 0)}</Text>
              <View style={[styles.podiumBar, { height: 40, backgroundColor: '#CD7F3280' }]} />
            </Animated.View>
          </View>
        )}

        {/* Rankings List */}
        <ScrollView
          style={styles.rankingsList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeaderboard(); }} tintColor={COLORS.gold.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {entries.slice(3).map((entry, index) => {
            const rankStyle = getRankStyle(entry.rank);
            const isUser = entry.username === user?.username;
            
            return (
              <View key={entry.username} style={[styles.rankRow, isUser && styles.rankRowUser]}>
                <View style={[styles.rankBadge, { backgroundColor: rankStyle.colors[0] }]}>
                  <Text style={styles.rankNumber}>{rankStyle.icon || `#${entry.rank}`}</Text>
                </View>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankName, isUser && styles.rankNameUser]}>
                    {entry.username} {isUser && '(You)'}
                  </Text>
                  {entry.vip_level && entry.vip_level > 0 && (
                    <Text style={styles.rankVip}>VIP {entry.vip_level}</Text>
                  )}
                </View>
                <Text style={[styles.rankScore, { color: config.color }]}>
                  {formatScore(entry.score)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* User's Rank Footer */}
        {userRank && (
          <View style={styles.userRankFooter}>
            <LinearGradient colors={[COLORS.gold.primary + '30', COLORS.gold.dark + '20']} style={styles.userRankGradient}>
              <Text style={styles.userRankLabel}>Your Rank</Text>
              <View style={styles.userRankMain}>
                <Text style={styles.userRankNumber}>#{userRank.rank}</Text>
                <Text style={styles.userRankScore}>{formatScore(userRank.score)}</Text>
              </View>
            </LinearGradient>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gold.primary + '30' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },

  tabsContainer: { maxHeight: 50, paddingHorizontal: 12, paddingVertical: 8 },
  typeTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: COLORS.navy.medium, borderWidth: 1, borderColor: 'transparent' },
  typeTabText: { fontSize: 12, color: COLORS.cream.dark, fontWeight: '600' },

  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingVertical: 20, paddingHorizontal: 20, gap: 12 },
  podiumItem: { alignItems: 'center', width: 90 },
  podiumFirst: { marginBottom: 10 },
  podiumRank: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  podiumRankText: { fontSize: 20 },
  podiumName: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 4 },
  podiumScore: { fontSize: 11, color: COLORS.gold.primary, fontWeight: '600', marginBottom: 8 },
  podiumBar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },

  rankingsList: { flex: 1, paddingHorizontal: 16 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ffffff10' },
  rankRowUser: { backgroundColor: COLORS.gold.primary + '20', borderRadius: 10, marginHorizontal: -8, paddingHorizontal: 8 },
  rankBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankNumber: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure },
  rankNameUser: { color: COLORS.gold.primary },
  rankVip: { fontSize: 10, color: COLORS.gold.light, marginTop: 2 },
  rankScore: { fontSize: 14, fontWeight: 'bold' },

  userRankFooter: { paddingHorizontal: 16, paddingBottom: 16 },
  userRankGradient: { borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userRankLabel: { fontSize: 12, color: COLORS.cream.dark },
  userRankMain: { alignItems: 'flex-end' },
  userRankNumber: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  userRankScore: { fontSize: 12, color: COLORS.cream.soft },
});