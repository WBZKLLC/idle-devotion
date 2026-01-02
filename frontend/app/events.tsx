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
  RefreshControl,
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

interface Event {
  id: string;
  name: string;
  description: string;
  type: 'login' | 'milestone' | 'limited' | 'special';
  rewards: { type: string; amount: number }[];
  start_date: string;
  end_date: string;
  progress?: number;
  target?: number;
  claimed?: boolean;
}

const MOCK_EVENTS: Event[] = [];

// Real event banners loaded from backend
interface EventBanner {
  id: string;
  name: string;
  description: string;
  banner_type: string;
  featured_heroes: string[];
  is_active: boolean;
  start_date?: string;
  end_date?: string;
}

export default function EventsScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'limited' | 'daily'>('all');

  useEffect(() => {
    if (hydrated && user) {
      loadEvents();
    }
  }, [hydrated, user?.username]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      await new Promise(r => setTimeout(r, 500));
      setEvents(MOCK_EVENTS);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const claimReward = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event || event.claimed) return;
    
    if (event.progress !== undefined && event.target !== undefined) {
      if (event.progress < event.target) {
        Alert.alert('Not Yet', `Complete the objective first! (${event.progress}/${event.target})`);
        return;
      }
    }

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, claimed: true } : e));
    
    const rewardText = event.rewards.map(r => `${r.amount} ${r.type.replace('_', ' ')}`).join(', ');
    Alert.alert('Claimed!', `You received: ${rewardText}`);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'login': return ['#22c55e', '#16a34a'];
      case 'limited': return ['#ef4444', '#dc2626'];
      case 'milestone': return ['#f59e0b', '#d97706'];
      case 'special': return ['#8b5cf6', '#7c3aed'];
      default: return [COLORS.navy.medium, COLORS.navy.primary];
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'gems': return '💎';
      case 'gold': return '⭐';
      case 'coins': return '🪙';
      case 'crystals': return '🔮';
      case 'hero_ticket': return '🎫';
      case 'selene_shards': return '⏳';
      case 'enhancement_stones': return '🔶';
      default: return '🎁';
    }
  };

  const filteredEvents = events.filter(event => {
    if (activeTab === 'all') return true;
    if (activeTab === 'limited') return event.type === 'limited' || event.type === 'special';
    if (activeTab === 'daily') return event.type === 'login';
    return true;
  });

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading Events...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
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
          <Text style={styles.headerTitle}>✨ Events</Text>
          <TouchableOpacity onPress={loadEvents}>
            <Ionicons name="refresh" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['all', 'limited', 'daily'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Events List */}
        <ScrollView
          style={styles.eventsList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEvents(); }} tintColor={COLORS.gold.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.cream.dark} />
              <Text style={styles.emptyText}>No events in this category</Text>
            </View>
          ) : (
            filteredEvents.map(event => (
              <View key={event.id} style={styles.eventCard}>
                <LinearGradient colors={getEventTypeColor(event.type)} style={styles.eventGradient}>
                  {/* Event Header */}
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventName}>{event.name}</Text>
                    <View style={styles.eventTimer}>
                      <Ionicons name="time" size={12} color="#fff" />
                      <Text style={styles.eventTimerText}>{getTimeRemaining(event.end_date)}</Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text style={styles.eventDesc}>{event.description}</Text>

                  {/* Progress Bar (if applicable) */}
                  {event.progress !== undefined && event.target !== undefined && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, (event.progress / event.target) * 100)}%` }]} />
                      </View>
                      <Text style={styles.progressText}>
                        {event.progress.toLocaleString()} / {event.target.toLocaleString()}
                      </Text>
                    </View>
                  )}

                  {/* Rewards */}
                  <View style={styles.rewardsRow}>
                    <Text style={styles.rewardsLabel}>Rewards:</Text>
                    <View style={styles.rewardsList}>
                      {event.rewards.map((reward, idx) => (
                        <View key={idx} style={styles.rewardItem}>
                          <Text style={styles.rewardIcon}>{getRewardIcon(reward.type)}</Text>
                          <Text style={styles.rewardAmount}>{reward.amount}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Claim Button */}
                  <TouchableOpacity
                    style={[
                      styles.claimButton,
                      event.claimed && styles.claimButtonClaimed,
                      event.progress !== undefined && event.target !== undefined && event.progress < event.target && styles.claimButtonLocked
                    ]}
                    onPress={() => claimReward(event.id)}
                    disabled={event.claimed}
                  >
                    <Text style={styles.claimButtonText}>
                      {event.claimed ? '✓ Claimed' : event.type === 'limited' ? 'Go to Event' : 'Claim'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  loginBtn: { marginTop: 16, backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: COLORS.navy.darkest, fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gold.primary + '30' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.navy.medium, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.gold.primary },
  tabText: { color: COLORS.cream.dark, fontWeight: '600' },
  tabTextActive: { color: COLORS.navy.darkest },

  eventsList: { flex: 1, padding: 16 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.cream.dark, marginTop: 12 },

  eventCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  eventGradient: { padding: 16 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eventName: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1 },
  eventTimer: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  eventTimerText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  eventDesc: { fontSize: 13, color: '#ffffffcc', marginBottom: 12 },

  progressContainer: { marginBottom: 12 },
  progressBar: { height: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  progressText: { fontSize: 11, color: '#ffffffaa', marginTop: 4, textAlign: 'right' },

  rewardsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rewardsLabel: { fontSize: 12, color: '#ffffffaa', marginRight: 8 },
  rewardsList: { flexDirection: 'row', gap: 12 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardIcon: { fontSize: 16 },
  rewardAmount: { fontSize: 13, color: '#fff', fontWeight: '600' },

  claimButton: { backgroundColor: '#fff', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  claimButtonClaimed: { backgroundColor: 'rgba(255,255,255,0.3)' },
  claimButtonLocked: { backgroundColor: 'rgba(255,255,255,0.5)' },
  claimButtonText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
});