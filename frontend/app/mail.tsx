// /app/frontend/app/mail.tsx
// Phase 3.22.12.R2: Mail / Inbox screen
//
// Consolidates all "claimable" content:
// - Login rewards (existing)
// - System messages (placeholder)
// - Gift codes (placeholder)
//
// "Your inbox is quiet. Only what matters."

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';
import { haptic } from '../lib/ui/interaction';

type MailTab = 'rewards' | 'messages' | 'gifts';

export default function MailScreen() {
  const [activeTab, setActiveTab] = useState<MailTab>('rewards');
  
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
        <Text style={styles.headerTitle}>Mail</Text>
        <View style={styles.headerRight} />
      </View>
      
      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton 
          label="Rewards" 
          active={activeTab === 'rewards'} 
          onPress={() => setActiveTab('rewards')} 
          badge={1}
        />
        <TabButton 
          label="Messages" 
          active={activeTab === 'messages'} 
          onPress={() => setActiveTab('messages')} 
        />
        <TabButton 
          label="Gifts" 
          active={activeTab === 'gifts'} 
          onPress={() => setActiveTab('gifts')} 
        />
      </View>
      
      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'rewards' && <RewardsTab />}
        {activeTab === 'messages' && <MessagesTab />}
        {activeTab === 'gifts' && <GiftsTab />}
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
      style={[styles.tab, active && styles.tabActive]}
      onPress={() => { haptic('light'); onPress(); }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge && badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function RewardsTab() {
  return (
    <View style={styles.section}>
      <Pressable 
        style={styles.mailItem}
        onPress={() => { haptic('light'); router.push('/login-rewards'); }}
      >
        <View style={styles.mailIcon}>
          <Ionicons name="calendar" size={24} color={COLORS.gold.primary} />
        </View>
        <View style={styles.mailContent}>
          <Text style={styles.mailTitle}>Daily Login Rewards</Text>
          <Text style={styles.mailSubtitle}>Claim your daily rewards</Text>
        </View>
        <View style={styles.mailBadge}>
          <Text style={styles.mailBadgeText}>1</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.cream.dark} />
      </Pressable>
      
      <Pressable style={[styles.mailItem, styles.mailItemMuted]}>
        <View style={styles.mailIcon}>
          <Ionicons name="trophy" size={24} color={COLORS.cream.dark} />
        </View>
        <View style={styles.mailContent}>
          <Text style={[styles.mailTitle, styles.textMuted]}>Achievement Rewards</Text>
          <Text style={styles.mailSubtitle}>No unclaimed rewards</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.cream.dark} />
      </Pressable>
    </View>
  );
}

function MessagesTab() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="mail-outline" size={48} color={COLORS.cream.dark} />
      <Text style={styles.emptyTitle}>No Messages</Text>
      <Text style={styles.emptySubtitle}>System messages will appear here</Text>
    </View>
  );
}

function GiftsTab() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="gift-outline" size={48} color={COLORS.cream.dark} />
      <Text style={styles.emptyTitle}>No Gifts</Text>
      <Text style={styles.emptySubtitle}>Gift codes and rewards will appear here</Text>
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
    paddingBottom: LAYOUT.BOTTOM_GUTTER,
  },
  section: {
    gap: 8,
  },
  mailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 12,
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '08',
  },
  mailItemMuted: {
    opacity: 0.6,
  },
  mailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.navy.darkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailContent: {
    flex: 1,
  },
  mailTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginBottom: 2,
  },
  mailSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  mailBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  mailBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  textMuted: {
    color: COLORS.cream.dark,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
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
});
