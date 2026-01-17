// /app/frontend/app/mail.tsx
// Phase 3.23.1: Mail Screen with Auth Gate
// Phase 3.23.3: Mail Screen MVP
//
// Consolidates all "claimable" content:
// - Daily login rewards
// - System messages
// - Gifts from friends/system
//
// Tone: "Your inbox is quiet. Only what matters."

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';
import { haptic, PRESS } from '../lib/ui/interaction';
import { useGameStore, useHydration } from '../stores/gameStore';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { ListRow } from '../components/ui/ListRow';
import { toast } from '../components/ui/Toast';
// Phase 3.23.2: API layer
import { getMailSummary, getMailRewards, getMailMessages, getMailGifts, claimMailReward, claimMailGift } from '../lib/api/mail';
import { triggerBadgeRefresh } from '../lib/ui/badges';

type MailTab = 'rewards' | 'messages' | 'gifts';

type MailSummary = {
  rewardsAvailable: number;
  unreadMessages: number;
  giftsAvailable: number;
};

type RewardItem = {
  id: string;
  type: 'daily' | 'achievement' | 'event';
  title: string;
  subtitle: string;
  claimed: boolean;
  icon: string;
};

type MessageItem = {
  id: string;
  sender: string;
  snippet: string;
  timestamp: string;
  read: boolean;
};

type GiftItem = {
  id: string;
  sender: string;
  item: string;
  quantity: number;
  claimed: boolean;
};

export default function MailScreen() {
  const { user } = useGameStore();
  const hydrated = useHydration();
  
  const [activeTab, setActiveTab] = useState<MailTab>('rewards');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<MailSummary>({ rewardsAvailable: 0, unreadMessages: 0, giftsAvailable: 0 });
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  
  const loadData = useCallback(async () => {
    if (!user?.username) return;
    
    try {
      const [summaryData, rewardsData, messagesData, giftsData] = await Promise.all([
        getMailSummary(user.username).catch(() => ({ rewardsAvailable: 1, unreadMessages: 0, giftsAvailable: 0 })),
        getMailRewards(user.username).catch(() => []),
        getMailMessages(user.username).catch(() => []),
        getMailGifts(user.username).catch(() => []),
      ]);
      
      setSummary(summaryData);
      setRewards(rewardsData);
      setMessages(messagesData);
      setGifts(giftsData);
    } catch {
      // Graceful degradation - use defaults
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.username]);
  
  useEffect(() => {
    if (hydrated && user) {
      loadData();
    } else if (hydrated && !user) {
      setLoading(false);
    }
  }, [hydrated, user, loadData]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);
  
  // Loading state
  if (!hydrated || (loading && user)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Auth gate
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.authGate}>
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.authGateTitle}>Sign in required</Text>
          <Text style={styles.authGateSubtitle}>Your mail awaits.</Text>
          <View style={styles.authGateButton}>
            <PrimaryButton 
              title="Go to Login" 
              onPress={() => router.push('/')} 
              variant="gold" 
              size="md" 
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => { haptic('light'); router.back(); }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
        </Pressable>
        <Text style={styles.headerTitle}>Mail</Text>
        <View style={styles.headerRight} />
      </View>
      
      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton 
          label="Rewards" 
          active={activeTab === 'rewards'} 
          onPress={() => setActiveTab('rewards')} 
          badge={summary.rewardsAvailable}
        />
        <TabButton 
          label="Messages" 
          active={activeTab === 'messages'} 
          onPress={() => setActiveTab('messages')} 
          badge={summary.unreadMessages}
        />
        <TabButton 
          label="Gifts" 
          active={activeTab === 'gifts'} 
          onPress={() => setActiveTab('gifts')} 
          badge={summary.giftsAvailable}
        />
      </View>
      
      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold.primary}
          />
        }
      >
        {activeTab === 'rewards' && (
          <RewardsTab 
            rewards={rewards} 
            username={user.username}
            onClaim={loadData}
          />
        )}
        {activeTab === 'messages' && <MessagesTab messages={messages} />}
        {activeTab === 'gifts' && (
          <GiftsTab 
            gifts={gifts} 
            username={user.username}
            onClaim={loadData}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress, badge }: { 
  label: string; 
  active: boolean; 
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tab, 
        active && styles.tabActive,
        pressed && styles.pressed,
      ]}
      onPress={() => { haptic('light'); onPress(); }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function RewardsTab({ rewards, username, onClaim }: { 
  rewards: RewardItem[]; 
  username: string;
  onClaim: () => void;
}) {
  const [claiming, setClaiming] = useState<string | null>(null);
  
  const handleClaim = async (id: string) => {
    setClaiming(id);
    try {
      const result = await claimMailReward(username, id);
      if (result.alreadyClaimed) {
        toast.success('Already claimed.');
      } else {
        toast.success('Claimed.');
      }
      triggerBadgeRefresh(); // Update side rail badge
      onClaim();
    } catch {
      toast.error('Not now.');
    } finally {
      setClaiming(null);
    }
  };
  
  // Always show daily login rewards shortcut
  const hasDaily = true;
  
  if (rewards.length === 0 && !hasDaily) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="gift-outline" size={48} color={COLORS.cream.dark} />
        <Text style={styles.emptyTitle}>Nothing waiting</Text>
        <Text style={styles.emptySubtitle}>Not yet.</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.section}>
      {/* Daily Login Rewards shortcut */}
      <Pressable 
        style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
        onPress={() => { haptic('light'); router.push('/login-rewards'); }}
      >
        <View style={[styles.listRowIcon, { backgroundColor: COLORS.gold.dark + '30' }]}>
          <Ionicons name="calendar" size={22} color={COLORS.gold.primary} />
        </View>
        <View style={styles.listRowContent}>
          <Text style={styles.listRowTitle}>Daily Login Rewards</Text>
          <Text style={styles.listRowSubtitle}>Claim your daily rewards</Text>
        </View>
        <View style={styles.listRowBadge}>
          <Text style={styles.listRowBadgeText}>1</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.cream.dark} />
      </Pressable>
      
      {/* Other rewards */}
      {rewards.filter(r => !r.claimed).map((reward) => (
        <Pressable 
          key={reward.id}
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => handleClaim(reward.id)}
          disabled={claiming === reward.id}
        >
          <View style={[styles.listRowIcon, { backgroundColor: COLORS.navy.dark }]}>
            <Ionicons name={reward.icon as any || 'gift'} size={22} color={COLORS.cream.soft} />
          </View>
          <View style={styles.listRowContent}>
            <Text style={styles.listRowTitle}>{reward.title}</Text>
            <Text style={styles.listRowSubtitle}>{reward.subtitle}</Text>
          </View>
          {claiming === reward.id ? (
            <ActivityIndicator size="small" color={COLORS.gold.primary} />
          ) : (
            <View style={styles.claimButton}>
              <Text style={styles.claimButtonText}>Claim</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function MessagesTab({ messages }: { messages: MessageItem[] }) {
  if (messages.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="mail-outline" size={48} color={COLORS.cream.dark} />
        <Text style={styles.emptyTitle}>No Messages</Text>
        <Text style={styles.emptySubtitle}>Nothing waiting. Not yet.</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.section}>
      {messages.map((msg) => (
        <Pressable 
          key={msg.id}
          style={({ pressed }) => [
            styles.listRow, 
            !msg.read && styles.listRowUnread,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.listRowIcon, { backgroundColor: COLORS.navy.dark }]}>
            <Ionicons name="person" size={22} color={COLORS.cream.soft} />
          </View>
          <View style={styles.listRowContent}>
            <Text style={[styles.listRowTitle, !msg.read && styles.textBold]}>{msg.sender}</Text>
            <Text style={styles.listRowSubtitle} numberOfLines={1}>{msg.snippet}</Text>
          </View>
          <Text style={styles.timestamp}>{msg.timestamp}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function GiftsTab({ gifts, username, onClaim }: { 
  gifts: GiftItem[]; 
  username: string;
  onClaim: () => void;
}) {
  const [claiming, setClaiming] = useState<string | null>(null);
  
  const handleAccept = async (id: string) => {
    setClaiming(id);
    try {
      const result = await claimMailGift(username, id);
      if (result.alreadyClaimed) {
        toast.success('Already accepted.');
      } else {
        toast.success('Accepted.');
      }
      triggerBadgeRefresh(); // Update side rail badge
      onClaim();
    } catch {
      toast.error('Not now.');
    } finally {
      setClaiming(null);
    }
  };
  
  const pendingGifts = gifts.filter(g => !g.claimed);
  
  if (pendingGifts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="gift-outline" size={48} color={COLORS.cream.dark} />
        <Text style={styles.emptyTitle}>No Gifts</Text>
        <Text style={styles.emptySubtitle}>Nothing waiting. Not yet.</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.section}>
      {pendingGifts.map((gift) => (
        <Pressable 
          key={gift.id}
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => handleAccept(gift.id)}
          disabled={claiming === gift.id}
        >
          <View style={[styles.listRowIcon, { backgroundColor: COLORS.gold.dark + '20' }]}>
            <Ionicons name="gift" size={22} color={COLORS.gold.light} />
          </View>
          <View style={styles.listRowContent}>
            <Text style={styles.listRowTitle}>{gift.item} x{gift.quantity}</Text>
            <Text style={styles.listRowSubtitle}>From {gift.sender}</Text>
          </View>
          {claiming === gift.id ? (
            <ActivityIndicator size="small" color={COLORS.gold.primary} />
          ) : (
            <View style={styles.acceptButton}>
              <Text style={styles.acceptButtonText}>Accept</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    gap: 12,
  },
  authGateTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginTop: 8,
  },
  authGateSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  authGateButton: {
    marginTop: 16,
    width: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '08',
  },
  backButton: {
    padding: 4,
    borderRadius: RADIUS.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    letterSpacing: 0.5,
  },
  headerRight: {
    width: 32,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.navy.dark,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.gold.dark + '30',
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '40',
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.dark,
  },
  tabTextActive: {
    color: COLORS.gold.light,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: LAYOUT.SCREEN_PADDING,
    paddingBottom: LAYOUT.TAB_BAR_HEIGHT + LAYOUT.BOTTOM_GUTTER,
  },
  section: {
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    textAlign: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 12,
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '08',
  },
  listRowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold.primary,
  },
  listRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowContent: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
    marginBottom: 2,
  },
  listRowSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  listRowBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  listRowBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  textBold: {
    fontWeight: FONT_WEIGHT.semibold,
  },
  timestamp: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.cream.dark,
  },
  claimButton: {
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  claimButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.navy.darkest,
  },
  acceptButton: {
    backgroundColor: COLORS.gold.dark + '40',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold.dark,
  },
  acceptButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gold.light,
  },
  pressed: {
    opacity: PRESS.OPACITY,
    transform: [{ scale: PRESS.SCALE }],
  },
});
