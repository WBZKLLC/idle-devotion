// /app/frontend/app/friends.tsx
// Phase 3.22.12.R2: Friends / Social screen
//
// Social hub for:
// - Friend requests
// - Friends list
// - Player search
//
// "Your companions await."

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';
import { haptic } from '../lib/ui/interaction';
import { useGameStore } from '../stores/gameStore';

type FriendTab = 'requests' | 'friends' | 'search';

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<FriendTab>('friends');
  const { user } = useGameStore();
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton} 
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
          badge={0}
        />
        <TabButton 
          label="Friends" 
          active={activeTab === 'friends'} 
          onPress={() => setActiveTab('friends')} 
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
      >
        {activeTab === 'requests' && <RequestsTab />}
        {activeTab === 'friends' && <FriendsTab />}
        {activeTab === 'search' && <SearchTab />}
      </ScrollView>
      
      {/* Guild shortcut */}
      <View style={styles.footer}>
        <Pressable 
          style={styles.guildButton}
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
      style={[styles.tab, active && styles.tabActive]}
      onPress={() => { haptic('light'); onPress(); }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function RequestsTab() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="person-add-outline" size={48} color={COLORS.cream.dark} />
      <Text style={styles.emptyTitle}>No Requests</Text>
      <Text style={styles.emptySubtitle}>Friend requests will appear here</Text>
    </View>
  );
}

function FriendsTab() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={48} color={COLORS.cream.dark} />
      <Text style={styles.emptyTitle}>No Friends Yet</Text>
      <Text style={styles.emptySubtitle}>Search for players to add as friends</Text>
      <Pressable 
        style={styles.addButton}
        onPress={() => haptic('light')}
      >
        <Ionicons name="search" size={16} color={COLORS.navy.darkest} />
        <Text style={styles.addButtonText}>Find Players</Text>
      </Pressable>
    </View>
  );
}

function SearchTab() {
  const [query, setQuery] = useState('');
  
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
            Enter a username to find players
          </Text>
        </View>
      )}
      
      {query.length > 0 && (
        <View style={styles.searchResults}>
          <Text style={styles.searchResultsText}>
            No players found matching "{query}"
          </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '10',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    letterSpacing: 0.3,
  },
  headerRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  fpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.navy.dark,
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
    paddingBottom: LAYOUT.BOTTOM_GUTTER,
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
  searchResults: {
    alignItems: 'center',
    paddingTop: 40,
  },
  searchResultsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
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
});
