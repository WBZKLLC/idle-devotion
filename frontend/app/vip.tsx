/**
 * VIP Comparison Screen
 * 
 * Shows VIP tier ladder, current progress, and benefit comparison.
 * VIP affects convenience/cosmetics, NOT combat stats.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/stores/gameStore';
import COLORS from '@/theme/colors';
import { track, Events } from '@/lib/telemetry/events';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Alias for TELEMETRY_EVENTS used in this file
const TELEMETRY_EVENTS = Events;

// VIP Tier Data (matches backend VIP_TIERS)
const VIP_TIERS = [
  { tier: 0, name: 'Free', spend: 0, idleHours: 8, idleRate: '5%', instantCollect: false, frame: 'default' },
  { tier: 1, name: 'Bronze', spend: 10, idleHours: 10, idleRate: '5%', instantCollect: true, frame: 'bronze' },
  { tier: 2, name: 'Bronze+', spend: 25, idleHours: 12, idleRate: '5%', instantCollect: true, frame: 'bronze' },
  { tier: 3, name: 'Silver', spend: 50, idleHours: 14, idleRate: '5%', instantCollect: true, frame: 'silver' },
  { tier: 4, name: 'Silver+', spend: 100, idleHours: 16, idleRate: '5%', instantCollect: true, frame: 'silver' },
  { tier: 5, name: 'Gold', spend: 250, idleHours: 18, idleRate: '5%', instantCollect: true, frame: 'gold' },
  { tier: 6, name: 'Gold+', spend: 500, idleHours: 20, idleRate: '5%', instantCollect: true, frame: 'gold' },
  { tier: 7, name: 'Platinum', spend: 1000, idleHours: 22, idleRate: '15%', instantCollect: true, frame: 'platinum' },
  { tier: 8, name: 'Platinum+', spend: 2000, idleHours: 24, idleRate: '20%', instantCollect: true, frame: 'platinum' },
  { tier: 9, name: 'Diamond', spend: 3500, idleHours: 30, idleRate: '25%', instantCollect: true, frame: 'diamond' },
  { tier: 10, name: 'Diamond+', spend: 5000, idleHours: 36, idleRate: '30%', instantCollect: true, frame: 'diamond' },
  { tier: 11, name: 'Ruby', spend: 7500, idleHours: 48, idleRate: '35%', instantCollect: true, frame: 'ruby' },
  { tier: 12, name: 'Ruby+', spend: 10000, idleHours: 60, idleRate: '40%', instantCollect: true, frame: 'ruby' },
  { tier: 13, name: 'Divine', spend: 15000, idleHours: 72, idleRate: '45%', instantCollect: true, frame: 'divine' },
  { tier: 14, name: 'Divine+', spend: 20000, idleHours: 96, idleRate: '50%', instantCollect: true, frame: 'divine' },
  { tier: 15, name: 'Celestial', spend: 25000, idleHours: 168, idleRate: '55%', instantCollect: true, frame: 'celestial' },
];

// Extended benefits by tier
const EXTENDED_BENEFITS: Record<number, string[]> = {
  0: ['Base experience', 'Manual idle claim only'],
  1: ['Instant Collect (2hr worth)', '+2hr idle cap'],
  2: ['+4hr idle cap total'],
  3: ['+6hr idle cap total', 'Silver frame'],
  4: ['+8hr idle cap (over 24h possible)'],
  5: ['Extra daily rewards', 'Gold frame'],
  6: ['+1 idle claim/day'],
  7: ['Streak protection (1 miss/week)', '15% idle rate', 'Platinum frame'],
  8: ['+1 pity buffer on gacha', '20% idle rate'],
  9: ['+5% dupe shard bonus', '25% idle rate', 'Diamond frame', 'Emerald chat bubble'],
  10: ['Tribute cost -10%', '+1 daily tribute limit', '30% idle rate'],
  11: ['5% shop discount', 'Free daily pack (Basic)', 'Ruby frame'],
  12: ['+2 event tickets', 'Free daily pack (Standard)', '40% idle rate'],
  13: ['PvE sweep unlock', 'Free daily pack (Premium)', 'Divine frame'],
  14: ['+1 PvP retry/day', '+3 event tickets', '50% idle rate'],
  15: ['All benefits maxed', 'Unlimited idle claims', 'Animated Celestial frame', 'All chat bubbles', '55% idle rate'],
};

interface TierDetailsSheetProps {
  tier: typeof VIP_TIERS[0];
  currentTier: number;
  onClose: () => void;
}

function TierDetailsSheet({ tier, currentTier, onClose }: TierDetailsSheetProps) {
  const isCurrentTier = tier.tier === currentTier;
  const isUnlocked = tier.tier <= currentTier;
  
  useEffect(() => {
    track(TELEMETRY_EVENTS.VIP_BENEFITS_SHEET_OPENED, {
      viewedTier: tier.tier,
      currentTier,
      isUnlocked,
    });
  }, []);
  
  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheetContainer}>
        <LinearGradient
          colors={[COLORS.navy.dark, COLORS.navy.darkest]}
          style={styles.sheetGradient}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTierName}>VIP {tier.tier} — {tier.name}</Text>
              {isCurrentTier && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>YOU ARE HERE</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.cream.soft} />
            </TouchableOpacity>
          </View>
          
          {/* Unlock Threshold */}
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>Unlocked at:</Text>
            <Text style={styles.thresholdValue}>
              {tier.spend === 0 ? 'Free' : `$${tier.spend.toLocaleString()} total spend`}
            </Text>
          </View>
          
          {/* Key Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{tier.idleHours}h</Text>
              <Text style={styles.statLabel}>Idle Cap</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{tier.idleRate}</Text>
              <Text style={styles.statLabel}>Idle Rate</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: tier.instantCollect ? COLORS.success : COLORS.cream.dark }]}>
                {tier.instantCollect ? '✓' : '—'}
              </Text>
              <Text style={styles.statLabel}>Instant Collect</Text>
            </View>
          </View>
          
          {/* Benefits List */}
          <Text style={styles.benefitsTitle}>Benefits</Text>
          <ScrollView style={styles.benefitsList}>
            {(EXTENDED_BENEFITS[tier.tier] || []).map((benefit, idx) => (
              <View key={idx} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.gold.primary} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </ScrollView>
          
          {/* Ethics Banner */}
          <View style={styles.ethicsBanner}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.cream.dark} />
            <Text style={styles.ethicsText}>
              VIP affects convenience & cosmetics, not combat stats.
            </Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

export default function VIPScreen() {
  const router = useRouter();
  const { user } = useGameStore();
  const [selectedTier, setSelectedTier] = useState<typeof VIP_TIERS[0] | null>(null);
  
  // Calculate current VIP level from total_spent
  const totalSpent = user?.total_spent || 0;
  const currentVipLevel = VIP_TIERS.reduce((level, tier) => {
    return totalSpent >= tier.spend ? tier.tier : level;
  }, 0);
  
  const currentTier = VIP_TIERS[currentVipLevel];
  const nextTier = VIP_TIERS[currentVipLevel + 1];
  const progressToNext = nextTier 
    ? Math.min(100, ((totalSpent - currentTier.spend) / (nextTier.spend - currentTier.spend)) * 100)
    : 100;
  
  useEffect(() => {
    track(TELEMETRY_EVENTS.VIP_VIEWED, {
      currentVipLevel,
      totalSpent,
    });
  }, []);
  
  const handleTierSelect = useCallback((tier: typeof VIP_TIERS[0]) => {
    track(TELEMETRY_EVENTS.VIP_TIER_SELECTED, {
      selectedTier: tier.tier,
      currentVip: currentVipLevel,
    });
    setSelectedTier(tier);
  }, [currentVipLevel]);
  
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loginPrompt}>Please log in to view VIP status</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.navy.darkest, COLORS.navy.dark]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.soft} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>VIP Benefits</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Current VIP Summary Card */}
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={[COLORS.gold.dark + '40', COLORS.navy.medium]}
              style={styles.summaryGradient}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.vipBadge}>
                  <Ionicons name="star" size={24} color={COLORS.gold.primary} />
                  <Text style={styles.vipLevel}>VIP {currentVipLevel}</Text>
                </View>
                <Text style={styles.vipName}>{currentTier.name}</Text>
              </View>
              
              {/* Progress to Next */}
              {nextTier && (
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Progress to VIP {nextTier.tier}</Text>
                    <Text style={styles.progressValue}>
                      ${totalSpent.toLocaleString()} / ${nextTier.spend.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progressToNext}%` }]} />
                  </View>
                </View>
              )}
              
              {/* Current Perks */}
              <View style={styles.currentPerks}>
                <View style={styles.perkChip}>
                  <Ionicons name="time" size={14} color={COLORS.cream.soft} />
                  <Text style={styles.perkText}>{currentTier.idleHours}h Idle Cap</Text>
                </View>
                <View style={styles.perkChip}>
                  <Ionicons name="trending-up" size={14} color={COLORS.cream.soft} />
                  <Text style={styles.perkText}>{currentTier.idleRate} Rate</Text>
                </View>
                {currentTier.instantCollect && (
                  <View style={styles.perkChip}>
                    <Ionicons name="flash" size={14} color={COLORS.gold.primary} />
                    <Text style={styles.perkText}>Instant Collect</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
          
          {/* Tier Comparison Table */}
          <Text style={styles.sectionTitle}>All VIP Tiers</Text>
          
          <View style={styles.tierTable}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Tier</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Cap</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Rate</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>IC</Text>
            </View>
            
            {/* Table Rows */}
            {VIP_TIERS.map((tier) => {
              const isCurrentRow = tier.tier === currentVipLevel;
              const isUnlocked = tier.tier <= currentVipLevel;
              
              return (
                <TouchableOpacity
                  key={tier.tier}
                  style={[
                    styles.tableRow,
                    isCurrentRow && styles.currentRow,
                    !isUnlocked && styles.lockedRow,
                  ]}
                  onPress={() => handleTierSelect(tier)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.tableCell, { flex: 1.2 }]}>
                    <Text style={[
                      styles.tierText,
                      isCurrentRow && styles.currentTierText,
                    ]}>
                      VIP {tier.tier}
                    </Text>
                    <Text style={styles.tierNameSmall}>{tier.name}</Text>
                  </View>
                  <Text style={[styles.tableCell, styles.cellText, { flex: 0.8 }]}>
                    {tier.idleHours}h
                  </Text>
                  <Text style={[styles.tableCell, styles.cellText, { flex: 0.8 }]}>
                    {tier.idleRate}
                  </Text>
                  <View style={[styles.tableCell, { flex: 0.6, alignItems: 'center' }]}>
                    <Ionicons 
                      name={tier.instantCollect ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={tier.instantCollect ? COLORS.success : COLORS.cream.dark}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Ethics Banner */}
          <View style={styles.ethicsBannerLarge}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.gold.primary} />
            <Text style={styles.ethicsTextLarge}>
              VIP affects convenience and cosmetics only.{"\n"}
              Combat stats are never modified by VIP level.
            </Text>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
        
        {/* Details Sheet */}
        {selectedTier && (
          <TierDetailsSheet
            tier={selectedTier}
            currentTier={currentVipLevel}
            onClose={() => setSelectedTier(null)}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy.darkest },
  gradient: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginPrompt: { color: COLORS.cream.soft, fontSize: 16, marginBottom: 20 },
  loginButton: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginButtonText: { color: COLORS.navy.darkest, fontWeight: '700' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: COLORS.cream.pure, fontSize: 20, fontWeight: '700' },
  
  scrollView: { flex: 1, paddingHorizontal: 16 },
  
  summaryCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  summaryGradient: { padding: 20, borderWidth: 1, borderColor: COLORS.gold.primary + '40', borderRadius: 16 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  vipBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vipLevel: { color: COLORS.gold.primary, fontSize: 24, fontWeight: '800' },
  vipName: { color: COLORS.cream.soft, fontSize: 16, fontWeight: '600' },
  
  progressSection: { marginBottom: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: COLORS.cream.dark, fontSize: 13 },
  progressValue: { color: COLORS.cream.soft, fontSize: 13, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: COLORS.navy.light, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.gold.primary, borderRadius: 4 },
  
  currentPerks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perkChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.navy.medium, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  perkText: { color: COLORS.cream.soft, fontSize: 12, fontWeight: '500' },
  
  sectionTitle: { color: COLORS.cream.pure, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  
  tierTable: { backgroundColor: COLORS.navy.medium + '60', borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.navy.dark, paddingVertical: 10, paddingHorizontal: 12 },
  tableHeaderCell: { color: COLORS.cream.dark, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.navy.light + '30' },
  currentRow: { backgroundColor: COLORS.gold.primary + '20' },
  lockedRow: { opacity: 0.6 },
  tableCell: { justifyContent: 'center' },
  cellText: { color: COLORS.cream.soft, fontSize: 14 },
  tierText: { color: COLORS.cream.soft, fontSize: 14, fontWeight: '600' },
  currentTierText: { color: COLORS.gold.primary },
  tierNameSmall: { color: COLORS.cream.dark, fontSize: 11 },
  
  ethicsBannerLarge: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.navy.medium + '80', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gold.primary + '30' },
  ethicsTextLarge: { flex: 1, color: COLORS.cream.soft, fontSize: 13, lineHeight: 20 },
  
  // Sheet styles
  sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetGradient: { padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetTierName: { color: COLORS.gold.primary, fontSize: 22, fontWeight: '700' },
  closeButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  currentBadge: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  currentBadgeText: { color: COLORS.navy.darkest, fontSize: 10, fontWeight: '700' },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  thresholdLabel: { color: COLORS.cream.dark, fontSize: 14 },
  thresholdValue: { color: COLORS.cream.soft, fontSize: 14, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: COLORS.navy.light + '40', padding: 12, borderRadius: 10, alignItems: 'center' },
  statValue: { color: COLORS.cream.pure, fontSize: 20, fontWeight: '700' },
  statLabel: { color: COLORS.cream.dark, fontSize: 11, marginTop: 4 },
  benefitsTitle: { color: COLORS.cream.pure, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  benefitsList: { maxHeight: 150 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  benefitText: { color: COLORS.cream.soft, fontSize: 14, flex: 1 },
  ethicsBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.navy.light + '40' },
  ethicsText: { color: COLORS.cream.dark, fontSize: 12, flex: 1 },
});
