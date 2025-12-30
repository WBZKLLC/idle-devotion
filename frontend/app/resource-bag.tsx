import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
};

const API_BASE = '/api';

interface ResourceBagData {
  resource_bag: {
    coins_collected: number;
    gold_collected: number;
    crystals_collected: number;
    exp_collected: number;
    materials_collected: number;
    last_updated: string | null;
  };
  vip_level: number;
  vip_bonus_percent: number;
  daily_limits: {
    coins: number;
    gold: number;
    exp: number;
  };
  current_totals: {
    coins: number;
    gold: number;
    crystals: number;
    divine_essence: number;
  };
}

export default function ResourceBagScreen() {
  const router = useRouter();
  const { user } = useGameStore();
  const hydrated = useHydration();
  const [loading, setLoading] = useState(true);
  const [resourceData, setResourceData] = useState<ResourceBagData | null>(null);

  useEffect(() => {
    if (hydrated && user) {
      fetchResourceBag();
    }
  }, [hydrated, user?.username]);

  const fetchResourceBag = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/resource-bag/${user.username}`);
      setResourceData(response.data);
    } catch (error) {
      console.error('Error fetching resource bag:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetBag = async () => {
    if (!user) return;
    try {
      await axios.post(`${API_BASE}/resource-bag/${user.username}/reset`);
      fetchResourceBag();
    } catch (error) {
      console.error('Error resetting resource bag:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getProgressPercent = (collected: number, limit: number) => {
    return Math.min((collected / limit) * 100, 100);
  };

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>Please log in first</Text>
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
          <Text style={styles.headerTitle}>📦 Resource Bag</Text>
          <TouchableOpacity onPress={resetBag} style={styles.resetButton}>
            <Ionicons name="refresh" size={20} color={COLORS.cream.pure} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold.primary} />
            <Text style={styles.loadingText}>Loading resources...</Text>
          </View>
        ) : resourceData ? (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* VIP Status */}
            <View style={styles.vipCard}>
              <View style={styles.vipHeader}>
                <Text style={styles.vipTitle}>👑 VIP {resourceData.vip_level}</Text>
                <Text style={styles.vipBonus}>+{resourceData.vip_bonus_percent}% Bonus</Text>
              </View>
              <Text style={styles.vipDesc}>
                Higher VIP levels increase your daily farming limits!
              </Text>
            </View>

            {/* Current Totals */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Current Balance</Text>
              <View style={styles.totalsGrid}>
                <View style={styles.totalItem}>
                  <Ionicons name="logo-bitcoin" size={24} color="#FFD700" />
                  <Text style={styles.totalValue}>{formatNumber(resourceData.current_totals.coins)}</Text>
                  <Text style={styles.totalLabel}>Coins</Text>
                </View>
                <View style={styles.totalItem}>
                  <Ionicons name="diamond" size={24} color="#9b59b6" />
                  <Text style={styles.totalValue}>{formatNumber(resourceData.current_totals.gold)}</Text>
                  <Text style={styles.totalLabel}>Gold</Text>
                </View>
                <View style={styles.totalItem}>
                  <Ionicons name="sparkles" size={24} color="#3498db" />
                  <Text style={styles.totalValue}>{formatNumber(resourceData.current_totals.crystals)}</Text>
                  <Text style={styles.totalLabel}>Crystals</Text>
                </View>
                <View style={styles.totalItem}>
                  <Ionicons name="star" size={24} color="#e74c3c" />
                  <Text style={styles.totalValue}>{formatNumber(resourceData.current_totals.divine_essence)}</Text>
                  <Text style={styles.totalLabel}>Divine</Text>
                </View>
              </View>
            </View>

            {/* Daily Collection Tracker */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Today's Collection</Text>
              
              {/* Coins Progress */}
              <View style={styles.resourceRow}>
                <View style={styles.resourceInfo}>
                  <Ionicons name="logo-bitcoin" size={20} color="#FFD700" />
                  <Text style={styles.resourceName}>Coins</Text>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${getProgressPercent(resourceData.resource_bag.coins_collected, resourceData.daily_limits.coins)}%`,
                          backgroundColor: '#FFD700'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {formatNumber(resourceData.resource_bag.coins_collected)} / {formatNumber(resourceData.daily_limits.coins)}
                  </Text>
                </View>
              </View>

              {/* Gold Progress */}
              <View style={styles.resourceRow}>
                <View style={styles.resourceInfo}>
                  <Ionicons name="diamond" size={20} color="#9b59b6" />
                  <Text style={styles.resourceName}>Gold</Text>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${getProgressPercent(resourceData.resource_bag.gold_collected, resourceData.daily_limits.gold)}%`,
                          backgroundColor: '#9b59b6'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {formatNumber(resourceData.resource_bag.gold_collected)} / {formatNumber(resourceData.daily_limits.gold)}
                  </Text>
                </View>
              </View>

              {/* EXP Progress */}
              <View style={styles.resourceRow}>
                <View style={styles.resourceInfo}>
                  <Ionicons name="flash" size={20} color="#2ecc71" />
                  <Text style={styles.resourceName}>EXP</Text>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${getProgressPercent(resourceData.resource_bag.exp_collected, resourceData.daily_limits.exp)}%`,
                          backgroundColor: '#2ecc71'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {formatNumber(resourceData.resource_bag.exp_collected)} / {formatNumber(resourceData.daily_limits.exp)}
                  </Text>
                </View>
              </View>

              {/* Crystals & Materials */}
              <View style={styles.extraStats}>
                <View style={styles.extraStatItem}>
                  <Ionicons name="sparkles" size={18} color="#3498db" />
                  <Text style={styles.extraStatValue}>{formatNumber(resourceData.resource_bag.crystals_collected)}</Text>
                  <Text style={styles.extraStatLabel}>Crystals Today</Text>
                </View>
                <View style={styles.extraStatItem}>
                  <Ionicons name="cube" size={18} color="#e67e22" />
                  <Text style={styles.extraStatValue}>{formatNumber(resourceData.resource_bag.materials_collected)}</Text>
                  <Text style={styles.extraStatLabel}>Materials Today</Text>
                </View>
              </View>
            </View>

            {/* Last Updated */}
            {resourceData.resource_bag.last_updated && (
              <Text style={styles.lastUpdated}>
                Last updated: {new Date(resourceData.resource_bag.last_updated).toLocaleString()}
              </Text>
            )}

            {/* Tips */}
            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>💡 Farming Tips</Text>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.gold.primary} />
                <Text style={styles.tipText}>Complete daily quests for bonus resources</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.gold.primary} />
                <Text style={styles.tipText}>Idle collection rewards increase with VIP level</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.gold.primary} />
                <Text style={styles.tipText}>Guild donations give guild points</Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={COLORS.cream.dark} />
            <Text style={styles.errorText}>Failed to load resource data</Text>
            <TouchableOpacity onPress={fetchResourceBag} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navy.medium,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  resetButton: { 
    padding: 8, 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 8 
  },
  scrollView: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.cream.dark, fontSize: 16, marginTop: 12 },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.gold.primary,
    borderRadius: 8,
  },
  retryText: { color: COLORS.navy.darkest, fontWeight: 'bold' },
  
  // VIP Card
  vipCard: {
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.gold.dark,
  },
  vipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vipTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary },
  vipBonus: { 
    fontSize: 14, 
    color: COLORS.gold.light, 
    backgroundColor: COLORS.gold.dark + '40',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  vipDesc: { fontSize: 12, color: COLORS.cream.dark },
  
  // Section
  section: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  
  // Totals Grid
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  totalItem: {
    width: '48%',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 4 },
  totalLabel: { fontSize: 12, color: COLORS.cream.dark, marginTop: 2 },
  
  // Resource Row
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resourceInfo: { flexDirection: 'row', alignItems: 'center', width: 80 },
  resourceName: { fontSize: 14, color: COLORS.cream.pure, marginLeft: 8 },
  progressContainer: { flex: 1, marginLeft: 12 },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.navy.dark,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 11, color: COLORS.cream.dark, marginTop: 4, textAlign: 'right' },
  
  // Extra Stats
  extraStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.navy.medium,
  },
  extraStatItem: { alignItems: 'center' },
  extraStatValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 4 },
  extraStatLabel: { fontSize: 10, color: COLORS.cream.dark, marginTop: 2 },
  
  // Last Updated
  lastUpdated: { 
    fontSize: 11, 
    color: COLORS.cream.dark, 
    textAlign: 'center', 
    marginBottom: 16 
  },
  
  // Tips
  tipsSection: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  tipsTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  tipItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipText: { fontSize: 12, color: COLORS.cream.soft, marginLeft: 8 },
});
