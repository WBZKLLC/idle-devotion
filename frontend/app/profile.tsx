import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const { user, userHeroes, fetchUserHeroes } = useGameStore();

  useEffect(() => {
    if (user) {
      fetchUserHeroes();
    }
  }, [user]);

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
            await AsyncStorage.removeItem('username');
            useGameStore.getState().setUser(null);
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.noUserText}>Please login first</Text>
      </View>
    );
  }

  // Calculate collection stats
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={80} color="#FF6B9D" />
          </View>
          <Text style={styles.username}>{user.username}</Text>
          <View style={styles.dayBadge}>
            <Ionicons name="calendar" size={16} color="#FFD700" />
            <Text style={styles.dayText}>Day {user.login_days}</Text>
          </View>
        </View>

        {/* Currency Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <View style={styles.resourceGrid}>
            <View style={styles.resourceCard}>
              <Ionicons name="diamond" size={32} color="#FF6B9D" />
              <Text style={styles.resourceValue}>{user.gems}</Text>
              <Text style={styles.resourceLabel}>Gems</Text>
            </View>
            <View style={styles.resourceCard}>
              <Ionicons name="cash" size={32} color="#FFD700" />
              <Text style={styles.resourceValue}>{user.coins}</Text>
              <Text style={styles.resourceLabel}>Coins</Text>
            </View>
            <View style={styles.resourceCard}>
              <Ionicons name="star" size={32} color="#FFA500" />
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
              <Text style={styles.statLabel}>Pity Counter</Text>
              <Text style={styles.statValue}>{user.pity_counter} / 50</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Daily Summons Claimed</Text>
              <Text style={styles.statValue}>{user.daily_summons_claimed}</Text>
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

          {/* Rarity Breakdown */}
          {Object.keys(rarityCount).length > 0 && (
            <View style={styles.rarityBreakdown}>
              <Text style={styles.rarityTitle}>By Rarity</Text>
              <View style={styles.rarityGrid}>
                {['SR', 'SSR', 'UR', 'UR+'].map((rarity) => (
                  <View key={rarity} style={styles.rarityItem}>
                    <Text style={styles.rarityName}>{rarity}</Text>
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
                color={user.login_days >= 7 ? '#FFD700' : '#666'}
              />
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementName}>7 Day Warrior</Text>
                <Text style={styles.achievementDesc}>Login for 7 days</Text>
              </View>
              {user.login_days >= 7 && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </View>

            <View style={[styles.achievementCard, user.total_pulls >= 50 && styles.achievementUnlocked]}>
              <Ionicons
                name="gift"
                size={24}
                color={user.total_pulls >= 50 ? '#FFD700' : '#666'}
              />
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementName}>Gacha Enthusiast</Text>
                <Text style={styles.achievementDesc}>Perform 50 summons</Text>
              </View>
              {user.total_pulls >= 50 && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </View>

            <View style={[styles.achievementCard, userHeroes.length >= 10 && styles.achievementUnlocked]}>
              <Ionicons
                name="people"
                size={24}
                color={userHeroes.length >= 10 ? '#FFD700' : '#666'}
              />
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementName}>Collector</Text>
                <Text style={styles.achievementDesc}>Collect 10 heroes</Text>
              </View>
              {userHeroes.length >= 10 && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={24} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <Text style={styles.versionText}>Divine Heroes v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  username: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  dayText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginBottom: 12,
  },
  resourceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  resourceCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resourceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  resourceLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  rarityBreakdown: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  rarityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  rarityGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  rarityItem: {
    flex: 1,
    backgroundColor: '#0f0f1e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  rarityName: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  rarityCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  achievementsList: {
    gap: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    opacity: 0.5,
  },
  achievementUnlocked: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  achievementDesc: {
    fontSize: 12,
    color: '#999',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  noUserText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});
