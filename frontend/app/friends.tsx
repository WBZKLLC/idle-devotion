// /app/frontend/app/friends.tsx
// Phase 3.23.1: Friends Screen with Auth Gate
// Phase 3.23.4: Friends Screen MVP
//
// Social hub for:
// - Friend requests (accept/decline)
// - Friends list with status
// - Player search with debounce
//
// Tone: "Your companions await."

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';
import { haptic, PRESS } from '../lib/ui/interaction';
import { useGameStore, useHydration } from '../stores/gameStore';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { toast } from '../components/ui/Toast';
// Phase 3.23.2: API layer
import { 
  getFriendsSummary, 
  getFriendsList, 
  getFriendRequests, 
  acceptFriendRequest, 
  declineFriendRequest,
  searchPlayers,
  sendFriendRequest,
  // Phase 3.28: Gift functions
  sendFriendGift,
  getFriendGiftStatus,
  GiftType,
  GiftStatus,
} from '../lib/api/friends';
import { triggerBadgeRefresh } from '../lib/ui/badges';
// Phase 3.28: Telemetry
import { track, Events } from '../lib/telemetry/events';

type FriendTab = 'requests' | 'friends' | 'search';

type FriendRequest = {
  id: string;
  fromUsername: string;
  timestamp: string;
};

type Friend = {
  id: string;
  username: string;
  lastOnline: string;
  status: 'online' | 'offline' | 'away';
  affinity?: number;
};

type SearchResult = {
  id: string;
  username: string;
  level: number;
  isFriend: boolean;
  hasPendingRequest: boolean;
};

export default function FriendsScreen() {
  const { user } = useGameStore();
  const hydrated = useHydration();
  
  const [activeTab, setActiveTab] = useState<FriendTab>('friends');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({ pendingRequests: 0, totalFriends: 0 });
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  const loadData = useCallback(async () => {
    if (!user?.username) return;
    
    try {
      const [summaryData, requestsData, friendsData] = await Promise.all([
        getFriendsSummary(user.username).catch(() => ({ pendingRequests: 0, totalFriends: 0 })),
        getFriendRequests(user.username).catch(() => []),
        getFriendsList(user.username).catch(() => []),
      ]);
      
      setSummary(summaryData);
      setRequests(requestsData);
      setFriends(friendsData);
    } catch {
      // Graceful degradation
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
          <Text style={styles.authGateSubtitle}>Your companions await.</Text>
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
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerRight}>
          <View style={styles.fpBadge}>
            <Ionicons name="heart" size={14} color={COLORS.gold.primary} />
            <Text style={styles.fpText}>{user?.friendship_points || 0}</Text>
          </View>
        </View>
      </View>
      
      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton 
          label="Requests" 
          active={activeTab === 'requests'} 
          onPress={() => setActiveTab('requests')} 
          badge={summary.pendingRequests}
        />
        <TabButton 
          label="Friends" 
          active={activeTab === 'friends'} 
          onPress={() => setActiveTab('friends')} 
          badge={summary.totalFriends > 0 ? undefined : undefined}
        />
        <TabButton 
          label="Search" 
          active={activeTab === 'search'} 
          onPress={() => setActiveTab('search')} 
        />
      </View>
      
      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          activeTab !== 'search' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.gold.primary}
            />
          ) : undefined
        }
      >
        {activeTab === 'requests' && (
          <RequestsTab 
            requests={requests} 
            username={user.username}
            onUpdate={loadData}
          />
        )}
        {activeTab === 'friends' && (
          <FriendsTab 
            friends={friends}
            onSwitchToSearch={() => setActiveTab('search')}
          />
        )}
        {activeTab === 'search' && (
          <SearchTab username={user.username} onUpdate={loadData} />
        )}
      </ScrollView>
      
      {/* Guild shortcut */}
      <View style={styles.footer}>
        <Pressable 
          style={({ pressed }) => [styles.guildButton, pressed && styles.pressed]}
          onPress={() => { haptic('light'); router.push('/guild'); }}
        >
          <Ionicons name="shield" size={18} color={COLORS.gold.light} />
          <Text style={styles.guildButtonText}>Visit Guild Hall</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.cream.dark} />
        </Pressable>
      </View>
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

function RequestsTab({ requests, username, onUpdate }: { 
  requests: FriendRequest[]; 
  username: string;
  onUpdate: () => void;
}) {
  const [processing, setProcessing] = useState<string | null>(null);
  
  const handleAccept = async (id: string) => {
    setProcessing(id);
    try {
      const result = await acceptFriendRequest(username, id);
      if (result.alreadyAccepted) {
        toast.success('Already accepted.');
      } else {
        toast.success('Accepted.');
      }
      triggerBadgeRefresh(); // Update side rail badge
      onUpdate();
    } catch {
      toast.error('Not now.');
    } finally {
      setProcessing(null);
    }
  };
  
  const handleDecline = async (id: string) => {
    setProcessing(id);
    try {
      const result = await declineFriendRequest(username, id);
      if (result.alreadyDeclined) {
        toast.info('Already declined.');
      } else {
        toast.info('Declined.');
      }
      triggerBadgeRefresh(); // Update side rail badge
      onUpdate();
    } catch {
      toast.error('Not now.');
    } finally {
      setProcessing(null);
    }
  };
  
  if (requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="person-add-outline" size={48} color={COLORS.cream.dark} />
        <Text style={styles.emptyTitle}>No Requests</Text>
        <Text style={styles.emptySubtitle}>No one new. For now.</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.section}>
      {requests.map((req) => (
        <View key={req.id} style={styles.requestRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={COLORS.cream.soft} />
          </View>
          <View style={styles.requestContent}>
            <Text style={styles.requestName}>{req.fromUsername}</Text>
            <Text style={styles.requestTime}>{req.timestamp}</Text>
          </View>
          {processing === req.id ? (
            <ActivityIndicator size="small" color={COLORS.gold.primary} />
          ) : (
            <View style={styles.requestActions}>
              <Pressable 
                style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
                onPress={() => handleAccept(req.id)}
              >
                <Ionicons name="checkmark" size={18} color={COLORS.navy.darkest} />
              </Pressable>
              <Pressable 
                style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
                onPress={() => handleDecline(req.id)}
              >
                <Ionicons name="close" size={18} color={COLORS.cream.dark} />
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function FriendsTab({ friends, onSwitchToSearch }: { 
  friends: Friend[];
  onSwitchToSearch: () => void;
}) {
  if (friends.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={48} color={COLORS.cream.dark} />
        <Text style={styles.emptyTitle}>No Friends Yet</Text>
        <Text style={styles.emptySubtitle}>Search for players to add as friends</Text>
        <Pressable 
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => { haptic('light'); onSwitchToSearch(); }}
        >
          <Ionicons name="search" size={16} color={COLORS.navy.darkest} />
          <Text style={styles.addButtonText}>Find Players</Text>
        </Pressable>
      </View>
    );
  }
  
  return (
    <View style={styles.section}>
      {friends.map((friend) => (
        <Pressable 
          key={friend.id}
          style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={COLORS.cream.soft} />
            <View style={[
              styles.statusDot,
              friend.status === 'online' && styles.statusOnline,
              friend.status === 'away' && styles.statusAway,
            ]} />
          </View>
          <View style={styles.friendContent}>
            <Text style={styles.friendName}>{friend.username}</Text>
            <Text style={styles.friendStatus}>
              {friend.status === 'online' ? 'Online' : `Last seen ${friend.lastOnline}`}
            </Text>
          </View>
          {friend.affinity !== undefined && (
            <View style={styles.affinityBadge}>
              <Ionicons name="heart" size={12} color={COLORS.gold.primary} />
              <Text style={styles.affinityText}>{friend.affinity}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function SearchTab({ username, onUpdate }: { username: string; onUpdate: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0); // Track request version to ignore stale responses
  
  // Debounced search with stale request cancellation
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Minimum 3 characters for search
    if (query.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    
    debounceRef.current = setTimeout(async () => {
      const currentRequestId = ++requestIdRef.current;
      setSearching(true);
      try {
        const data = await searchPlayers(query, username);
        // Ignore stale responses
        if (currentRequestId === requestIdRef.current) {
          setResults(data);
        }
      } catch {
        if (currentRequestId === requestIdRef.current) {
          setResults([]);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setSearching(false);
        }
      }
    }, 400); // 400ms debounce
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, username]);
  
  const handleSendRequest = async (toUsername: string) => {
    setSending(toUsername);
    try {
      await sendFriendRequest(username, toUsername);
      toast.success('Request sent.');
      triggerBadgeRefresh(); // Update side rail badge
      onUpdate();
      // Update local state
      setResults(prev => prev.map(r => 
        r.username === toUsername ? { ...r, hasPendingRequest: true } : r
      ));
    } catch {
      toast.error('Not now.');
    } finally {
      setSending(null);
    }
  };
  
  return (
    <View style={styles.searchSection}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.cream.dark} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username..."
          placeholderTextColor={COLORS.cream.dark}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.cream.dark} />
          </Pressable>
        )}
      </View>
      
      {query.length === 0 && (
        <View style={styles.searchHint}>
          <Text style={styles.searchHintText}>
            Enter at least 3 characters to find players
          </Text>
        </View>
      )}
      
      {query.length > 0 && query.length < 3 && (
        <View style={styles.searchHint}>
          <Text style={styles.searchHintText}>
            Keep typing... ({3 - query.length} more characters)
          </Text>
        </View>
      )}
      
      {searching && (
        <View style={styles.searchHint}>
          <ActivityIndicator size="small" color={COLORS.gold.primary} />
        </View>
      )}
      
      {query.length >= 3 && !searching && results.length === 0 && (
        <View style={styles.searchHint}>
          <Text style={styles.searchHintText}>
            No players found matching "{query}"
          </Text>
        </View>
      )}
      
      {results.length > 0 && (
        <View style={styles.section}>
          {results.map((player) => (
            <View key={player.id} style={styles.searchResultRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={COLORS.cream.soft} />
              </View>
              <View style={styles.searchResultContent}>
                <Text style={styles.searchResultName}>{player.username}</Text>
                <Text style={styles.searchResultLevel}>Level {player.level}</Text>
              </View>
              {player.isFriend ? (
                <Text style={styles.friendLabel}>Friend</Text>
              ) : player.hasPendingRequest ? (
                <Text style={styles.pendingLabel}>Pending</Text>
              ) : sending === player.username ? (
                <ActivityIndicator size="small" color={COLORS.gold.primary} />
              ) : (
                <Pressable 
                  style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]}
                  onPress={() => handleSendRequest(player.username)}
                >
                  <Ionicons name="person-add" size={16} color={COLORS.navy.darkest} />
                  <Text style={styles.inviteBtnText}>Add</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
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
    minWidth: 60,
    alignItems: 'flex-end',
  },
  fpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.navy.dark + '80',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fpText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.light,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.navy.dark + '80',
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.gold.dark + '20',
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '30',
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
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: 12,
  },
  addButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.navy.darkest,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 12,
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '06',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.navy.darkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.cream.dark,
    borderWidth: 2,
    borderColor: COLORS.navy.dark,
  },
  statusOnline: {
    backgroundColor: '#22c55e',
  },
  statusAway: {
    backgroundColor: '#f59e0b',
  },
  requestContent: {
    flex: 1,
  },
  requestName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginBottom: 2,
  },
  requestTime: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.navy.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '20',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 12,
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '08',
  },
  friendContent: {
    flex: 1,
  },
  friendName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
    marginBottom: 2,
  },
  friendStatus: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  affinityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold.dark + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  affinityText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.light,
  },
  searchSection: {
    gap: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.pure,
  },
  searchHint: {
    alignItems: 'center',
    paddingTop: 40,
  },
  searchHintText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 12,
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '08',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
    marginBottom: 2,
  },
  searchResultLevel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  friendLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold.light,
    fontWeight: FONT_WEIGHT.medium,
  },
  pendingLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  inviteBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.navy.darkest,
  },
  footer: {
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.cream.pure + '10',
  },
  guildButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navy.dark,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '25',
  },
  guildButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
  },
  pressed: {
    opacity: PRESS.OPACITY,
    transform: [{ scale: PRESS.SCALE }],
  },
});
