import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { isErrorHandledGlobally } from '../lib/api';
import { getEventBanners, pullEventBanner } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
// Phase 3.18.7: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';
// Phase 3.22.3: Canonical button
import { PrimaryButton } from '../components/ui/PrimaryButton';
// Phase 3.19.11: Confirm modal hook
import { useConfirmModal } from '../components/ui/useConfirmModal';
// Phase 3.22.4: Micro-interaction utilities
import { PRESS, haptic } from '../lib/ui/interaction';
import { LAYOUT } from '../components/ui/tokens';
// Phase 3.29: Canonical receipt system
import { track, Events as TelemetryEvents } from '../lib/telemetry/events';
import { RewardReceipt, isValidReceipt, formatReceiptItems } from '../lib/types/receipt';
import { triggerBadgeRefresh } from '../lib/ui/badges';
import { loadAuthToken } from '../lib/authStorage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// Phase 3.29: Auth header helper
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await loadAuthToken();
  if (!token) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Phase 3.29: Quest event type from new API
interface QuestEvent {
  id: string;
  title: string;
  description: string;
  type: 'one_time' | 'daily';
  rewards_preview: string[];
  is_claimable: boolean;
  ends_at: string | null;
}

// Phase 3.29: API functions for new events system
async function getActiveQuests(): Promise<{ events: QuestEvent[]; claimable_count: number }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/events/active`, { headers });
    if (!res.ok) return { events: [], claimable_count: 0 };
    return await res.json();
  } catch {
    return { events: [], claimable_count: 0 };
  }
}

async function claimQuestReward(eventId: string): Promise<RewardReceipt> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/events/${eventId}/claim`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Failed to claim');
  return await res.json();
}

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
  const [eventBanners, setEventBanners] = useState<EventBanner[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'limited' | 'daily'>('all');
  const [isPulling, setIsPulling] = useState(false);
  // Phase 3.29: Quest events state
  const [questEvents, setQuestEvents] = useState<QuestEvent[]>([]);
  const [questClaimable, setQuestClaimable] = useState(0);
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null);
  
  // Phase 3.19.11: Confirm modal hook
  const { openConfirm, confirmNode } = useConfirmModal();

  useEffect(() => {
    if (hydrated && user) {
      loadEvents();
    }
  }, [hydrated, user?.username]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Fetch real event banners from backend
      const data = await getEventBanners();
      const banners = data.banners || [];
      setEventBanners(banners);
      
      // Phase 3.29: Fetch quest events
      const questData = await getActiveQuests();
      setQuestEvents(questData.events);
      setQuestClaimable(questData.claimable_count);
      
      // Emit telemetry
      track(TelemetryEvents.EVENTS_VIEWED, {
        eventCount: questData.events.length,
        claimableCount: questData.claimable_count,
      });
      
      // Convert banners to event format
      const bannerEvents: Event[] = banners.map((banner: EventBanner) => ({
        id: banner.id,
        name: banner.name,
        description: banner.description,
        type: 'limited' as const,
        rewards: [{ type: 'featured_hero', amount: 1 }],
        start_date: banner.start_date || '2025-01-01',
        end_date: banner.end_date || '2025-12-31',
        claimed: false,
      }));
      
      // Add daily login event
      const dailyEvent: Event = {
        id: 'daily_login',
        name: '📅 Daily Check-In',
        description: 'Visit the Login Rewards page to claim your daily rewards!',
        type: 'login',
        rewards: [{ type: 'gems', amount: 100 }],
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      };
      
      setEvents([dailyEvent, ...bannerEvents]);
    } catch (error) {
      console.error('Error loading events:', error);
      // Fallback to empty if API fails
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Phase 3.29: Handle quest claim with canonical receipt
  const handleQuestClaim = useCallback(async (questId: string) => {
    setClaimingQuest(questId);
    
    track(TelemetryEvents.EVENT_CLAIM_SUBMITTED, { eventId: questId });
    
    try {
      const receipt = await claimQuestReward(questId);
      
      if (isValidReceipt(receipt)) {
        if (receipt.alreadyClaimed) {
          track(TelemetryEvents.EVENT_CLAIM_ALREADY_CLAIMED, { eventId: questId });
          toast.info('Already claimed.');
        } else {
          track(TelemetryEvents.EVENT_CLAIM_SUCCESS, { 
            eventId: questId,
            itemCount: receipt.items.length,
          });
          toast.success(`Claimed: ${formatReceiptItems(receipt)}`);
          await fetchUser();
        }
      } else {
        toast.success('Claimed!');
      }
      
      triggerBadgeRefresh();
      loadEvents(); // Refresh events list
    } catch (error) {
      track(TelemetryEvents.EVENT_CLAIM_ERROR, { 
        eventId: questId,
        error: String(error),
      });
      toast.error('Not now.');
    } finally {
      setClaimingQuest(null);
    }
  }, [fetchUser]);

  const performEventPull = async (bannerId: string, isMulti: boolean) => {
    if (!user || isPulling) return;
    
    setIsPulling(true);
    try {
      const result = await pullEventBanner(user.username, bannerId, isMulti);
      
      if (result.heroes && result.heroes.length > 0) {
        const heroNames = result.heroes.map((h: any) => `${h.name} (${h.rarity})`).slice(0, 3).join(', ');
        toast.success(`Summoned: ${heroNames}${result.heroes.length > 3 ? '...' : ''}`);
        await fetchUser();
      }
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        toast.error(error?.response?.data?.detail || 'Failed to perform summon');
      }
    } finally {
      setIsPulling(false);
    }
  };

  const claimReward = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    // Handle daily login - navigate to login rewards page
    if (event.type === 'login') {
      router.push('/login-rewards');
      return;
    }
    
    // Handle limited event banners - show summon options
    if (event.type === 'limited') {
      const banner = eventBanners.find(b => b.id === eventId);
      if (banner) {
        openConfirm({
          title: `🎰 ${banner.name}`,
          message: `Featured: ${banner.featured_heroes.slice(0, 3).join(', ')}\n\nWould you like to summon on this banner?`,
          tone: 'premium',
          confirmText: 'Go to Summon',
          cancelText: 'Cancel',
          icon: 'sparkles-outline',
          onConfirm: () => router.push('/summon-hub'),
        });
      }
      return;
    }
    
    // Handle regular claimable events
    if (event.claimed) return;
    
    if (event.progress !== undefined && event.target !== undefined) {
      if (event.progress < event.target) {
        toast.warning(`Complete the objective first! (${event.progress}/${event.target})`);
        return;
      }
    }

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, claimed: true } : e));
    
    const rewardText = event.rewards.map(r => `${r.amount} ${r.type.replace('_', ' ')}`).join(', ');
    toast.success(`Claimed: ${rewardText}`);
  };

  const getEventTypeColor = (type: string): readonly [string, string] => {
    switch (type) {
      case 'login': return ['#22c55e', '#16a34a'] as const;
      case 'limited': return ['#ef4444', '#dc2626'] as const;
      case 'milestone': return ['#f59e0b', '#d97706'] as const;
      case 'special': return ['#8b5cf6', '#7c3aed'] as const;
      default: return [COLORS.navy.medium, COLORS.navy.primary] as const;
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
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.errorText}>Please log in first</Text>
          <View style={{ marginTop: 16, width: '60%' }}>
            <PrimaryButton title="Go to Login" onPress={() => router.push('/')} variant="gold" size="md" />
          </View>
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
            <Pressable
              key={tab}
              style={({ pressed }) => [
                styles.tab,
                activeTab === tab && styles.tabActive,
                pressed && styles.pressedFeedback,
              ]}
              onPress={() => {
                haptic('selection');
                setActiveTab(tab);
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
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
                      event.progress !== undefined && event.target !== undefined && event.progress < event.target && styles.claimButtonLocked,
                      isPulling && styles.claimButtonLocked
                    ]}
                    onPress={() => claimReward(event.id)}
                    disabled={event.claimed || isPulling}
                  >
                    {isPulling && event.type === 'limited' ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.claimButtonText}>
                        {event.claimed 
                          ? '✓ Claimed' 
                          : event.type === 'limited' 
                            ? '🎰 Summon' 
                            : event.type === 'login'
                              ? '📅 Check In'
                              : 'Claim'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ))
          )}
        </ScrollView>
        
        {/* Phase 3.19.11: Confirm Modal via hook */}
        {confirmNode}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gold.primary + '30' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.navy.medium, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.gold.primary },
  tabText: { color: COLORS.cream.dark, fontWeight: '600' },
  tabTextActive: { color: COLORS.navy.darkest },
  // Phase 3.22.4: Pressed-state feedback
  pressedFeedback: { opacity: PRESS.OPACITY, transform: [{ scale: PRESS.SCALE }] },

  eventsList: { flex: 1, padding: 16, paddingBottom: LAYOUT.BOTTOM_GUTTER },
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