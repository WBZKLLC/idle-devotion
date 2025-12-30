import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import COLORS from '../theme/colors';

const API_BASE = '/api';

export default function ProfileScreen() {
  const { user, userHeroes, fetchUserHeroes, fetchUser, logout } = useGameStore();
  const hydrated = useHydration();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{success: boolean; message: string; rewards?: any} | null>(null);

  useEffect(() => {
    if (hydrated && user) {
      fetchUserHeroes();
    }
  }, [hydrated, user?.username]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleRedeemCode = async () => {
    if (!codeInput.trim()) {
      Alert.alert('Error', 'Please enter a code');
      return;
    }
    if (!user) return;

    setIsRedeeming(true);
    setRedeemResult(null);

    try {
      const response = await axios.post(
        `${API_BASE}/codes/redeem?username=${encodeURIComponent(user.username)}&code=${encodeURIComponent(codeInput.trim())}`
      );
      
      setRedeemResult({
        success: true,
        message: response.data.message,
        rewards: response.data.rewards
      });
      
      // Refresh user data to update currencies
      await fetchUser();
      setCodeInput('');
    } catch (error: any) {
      setRedeemResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to redeem code'
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.noUserText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const rarityCount = userHeroes.reduce(
    (acc, hero) => {
      const rarity = hero.hero_data?.rarity || 'SR';
      acc[rarity] = (acc[rarity] || 0) + 1;
      return acc;
    },
    {} as { [key: string]: number }
  );

  const totalDuplicates = userHeroes.reduce((sum, hero) => sum + hero.duplicates, 0);
  const averageRank = userHeroes.length > 0
    ? (userHeroes.reduce((sum, hero) => sum + hero.rank, 0) / userHeroes.length).toFixed(1)
    : '0';

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.avatarGradient}>
                <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            </View>
            <Text style={styles.username}>{user.username}</Text>
            <View style={styles.dayBadge}>
              <Ionicons name="calendar" size={16} color={COLORS.gold.primary} />
              <Text style={styles.dayText}>Day {user.login_days}</Text>
            </View>
          </View>

          {/* Currency Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resources</Text>
            <View style={styles.resourceGrid}>
              <View style={styles.resourceCard}>
                <Ionicons name="diamond" size={32} color={COLORS.rarity['UR+']} />
                <Text style={styles.resourceValue}>{user.gems}</Text>
                <Text style={styles.resourceLabel}>Crystals</Text>
              </View>
              <View style={styles.resourceCard}>
                <Ionicons name="cash" size={32} color={COLORS.gold.light} />
                <Text style={styles.resourceValue}>{user.coins}</Text>
                <Text style={styles.resourceLabel}>Coins</Text>
              </View>
              <View style={styles.resourceCard}>
                <Ionicons name="star" size={32} color={COLORS.gold.primary} />
                <Text style={styles.resourceValue}>{user.gold}</Text>
                <Text style={styles.resourceLabel}>Gold</Text>
              </View>
            </View>
          </View>

          {/* Gacha Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gacha Statistics</Text>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Pulls</Text>
                <Text style={styles.statValue}>{user.total_pulls}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Common Pity</Text>
                <Text style={styles.statValue}>{user.pity_counter || 0} / 50</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Premium Pity</Text>
                <Text style={styles.statValue}>{user.pity_counter_premium || 0} / 50</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Divine Pity</Text>
                <Text style={styles.statValue}>{user.pity_counter_divine || 0} / 40</Text>
              </View>
            </View>
          </View>

          {/* Collection Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collection</Text>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Heroes</Text>
                <Text style={styles.statValue}>{userHeroes.length}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Duplicates</Text>
                <Text style={styles.statValue}>{totalDuplicates}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Average Rank</Text>
                <Text style={styles.statValue}>{averageRank}</Text>
              </View>
            </View>

            {Object.keys(rarityCount).length > 0 && (
              <View style={styles.rarityBreakdown}>
                <Text style={styles.rarityTitle}>By Rarity</Text>
                <View style={styles.rarityGrid}>
                  {['SR', 'SSR', 'SSR+', 'UR', 'UR+'].map((rarity) => (
                    <View key={rarity} style={[styles.rarityItem, { borderColor: COLORS.rarity[rarity as keyof typeof COLORS.rarity] + '60' }]}>
                      <Text style={[styles.rarityName, { color: COLORS.rarity[rarity as keyof typeof COLORS.rarity] }]}>{rarity}</Text>
                      <Text style={styles.rarityCount}>{rarityCount[rarity] || 0}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Achievements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementsList}>
              <View style={[styles.achievementCard, user.login_days >= 7 && styles.achievementUnlocked]}>
                <Ionicons
                  name="trophy"
                  size={24}
                  color={user.login_days >= 7 ? COLORS.gold.primary : COLORS.navy.light}
                />
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>7 Day Warrior</Text>
                  <Text style={styles.achievementDesc}>Login for 7 days</Text>
                </View>
                {user.login_days >= 7 && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                )}
              </View>

              <View style={[styles.achievementCard, user.total_pulls >= 50 && styles.achievementUnlocked]}>
                <Ionicons
                  name="gift"
                  size={24}
                  color={user.total_pulls >= 50 ? COLORS.gold.primary : COLORS.navy.light}
                />
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>Gacha Enthusiast</Text>
                  <Text style={styles.achievementDesc}>Perform 50 summons</Text>
                </View>
                {user.total_pulls >= 50 && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                )}
              </View>

              <View style={[styles.achievementCard, userHeroes.length >= 10 && styles.achievementUnlocked]}>
                <Ionicons
                  name="people"
                  size={24}
                  color={userHeroes.length >= 10 ? COLORS.gold.primary : COLORS.navy.light}
                />
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>Collector</Text>
                  <Text style={styles.achievementDesc}>Collect 10 heroes</Text>
                </View>
                {userHeroes.length >= 10 && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                )}
              </View>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color={COLORS.cream.pure} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          {/* Version Info */}
          <Text style={styles.versionText}>Divine Heroes v1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { marginBottom: 12 },
  avatarGradient: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.gold.light },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.navy.darkest },
  username: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  dayBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  dayText: { color: COLORS.gold.primary, fontWeight: 'bold', fontSize: 14 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.light, marginBottom: 12 },
  resourceGrid: { flexDirection: 'row', gap: 12 },
  resourceCard: { flex: 1, backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  resourceValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  resourceLabel: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
  statsCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.navy.light + '30' },
  statLabel: { fontSize: 14, color: COLORS.cream.dark },
  statValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  rarityBreakdown: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginTop: 12, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  rarityTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  rarityGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rarityItem: { flex: 1, minWidth: 60, backgroundColor: COLORS.navy.dark, borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1 },
  rarityName: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
  rarityCount: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  achievementsList: { gap: 12 },
  achievementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, gap: 12, opacity: 0.5, borderWidth: 1, borderColor: COLORS.navy.light + '30' },
  achievementUnlocked: { opacity: 1, borderWidth: 2, borderColor: COLORS.success },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 2 },
  achievementDesc: { fontSize: 12, color: COLORS.cream.dark },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.error, borderRadius: 12, padding: 16, marginTop: 16, gap: 8 },
  logoutText: { color: COLORS.cream.pure, fontSize: 16, fontWeight: 'bold' },
  versionText: { textAlign: 'center', color: COLORS.navy.light, fontSize: 12, marginTop: 24, marginBottom: 16 },
  noUserText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
