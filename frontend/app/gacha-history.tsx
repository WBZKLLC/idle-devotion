// /app/frontend/app/gacha-history.tsx
// Phase 3.35: Gacha History Screen
//
// Simple list grouped by date.
// Tap expands details.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getGachaHistory, GachaHistoryItem } from '../lib/api/gacha';
import { track, Events } from '../lib/telemetry/events';
import { haptic } from '../lib/ui/interaction';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845' },
  gold: { dark: '#b8860b', primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0' },
};

const RARITY_COLORS: Record<string, string> = {
  'SR': '#8b9dc3',
  'SSR': '#c9a227',
  'SSR+': '#b8860b',
  'UR': '#6b5b95',
  'UR+': '#9b4dca',
};

export default function GachaHistoryScreen() {
  const [history, setHistory] = useState<GachaHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const fetchHistory = useCallback(async () => {
    try {
      const data = await getGachaHistory(50);
      setHistory(data.history);
    } catch (err) {
      console.error('Failed to fetch gacha history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    track(Events.GACHA_HISTORY_VIEWED, {});
    fetchHistory();
  }, [fetchHistory]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);
  
  const handleBack = () => {
    haptic('selection');
    router.back();
  };
  
  const toggleExpand = (id: string) => {
    haptic('selection');
    setExpandedId(expandedId === id ? null : id);
  };
  
  // Group history by date
  const groupedHistory = history.reduce((groups, item) => {
    const date = item.at ? new Date(item.at).toLocaleDateString() : 'Unknown';
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
    return groups;
  }, {} as Record<string, GachaHistoryItem[]>);
  
  const sortedDates = Object.keys(groupedHistory).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  return (
    <LinearGradient
      colors={[COLORS.navy.darkest, COLORS.navy.dark, COLORS.navy.primary]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.soft} />
          </Pressable>
          <Text style={styles.title}>Summon History</Text>
          <View style={{ width: 24 }} />
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold.primary} />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>No summon history yet</Text>
            <Pressable
              style={styles.goSummonButton}
              onPress={() => router.push('/summon-hub')}
            >
              <Text style={styles.goSummonText}>Go Summon!</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.gold.primary}
              />
            }
          >
            {sortedDates.map(date => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateHeader}>{date}</Text>
                {groupedHistory[date].map(item => (
                  <HistoryCard
                    key={item.sourceId}
                    item={item}
                    expanded={expandedId === item.sourceId}
                    onToggle={() => toggleExpand(item.sourceId)}
                  />
                ))}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

interface HistoryCardProps {
  item: GachaHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}

function HistoryCard({ item, expanded, onToggle }: HistoryCardProps) {
  const time = item.at ? new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  
  const getBannerName = (id: string) => {
    if (id === 'standard') return 'Coin Summon';
    if (id === 'premium') return 'Crystal Summon';
    if (id === 'divine') return 'Divine Summon';
    return id;
  };
  
  return (
    <Pressable onPress={onToggle} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.bannerName}>{getBannerName(item.bannerId)}</Text>
          <Text style={styles.cardTime}>{time}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={styles.pullCount}>×{item.pullCount}</Text>
          {item.pityTriggered && (
            <Ionicons name="star" size={14} color={COLORS.gold.primary} />
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="rgba(255,255,255,0.5)"
          />
        </View>
      </View>
      
      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        {item.summary.newHeroes > 0 && (
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>+{item.summary.newHeroes} New</Text>
          </View>
        )}
        {item.summary.duplicates > 0 && (
          <View style={[styles.summaryBadge, styles.dupeBadge]}>
            <Text style={styles.summaryBadgeText}>{item.summary.duplicates} Dupe</Text>
          </View>
        )}
        {Object.entries(item.summary.rarities)
          .filter(([rarity]) => !['filler', 'crystal_8k', 'crystal_5k', 'crystal_3k'].includes(rarity))
          .map(([rarity, count]) => (
            <View key={rarity} style={[styles.rarityTag, { borderColor: RARITY_COLORS[rarity] || COLORS.gold.primary }]}>
              <Text style={[styles.rarityTagText, { color: RARITY_COLORS[rarity] || COLORS.cream.soft }]}>
                {rarity}×{count}
              </Text>
            </View>
          ))
        }
      </View>
      
      {/* Expanded Details */}
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.divider} />
          <Text style={styles.resultsTitle}>Results</Text>
          {item.results.map((result, idx) => (
            <View key={idx} style={styles.resultRow}>
              <View style={[styles.resultDot, { backgroundColor: RARITY_COLORS[result.rarity] || COLORS.gold.primary }]} />
              <Text style={styles.resultName} numberOfLines={1}>
                {result.heroName || (result.isFiller ? 'Bonus' : 'Hero')}
              </Text>
              <Text style={[styles.resultRarity, { color: RARITY_COLORS[result.rarity] || COLORS.cream.soft }]}>
                {result.rarity}
              </Text>
              {result.outcome === 'new' && !result.isFiller && (
                <View style={styles.newTag}>
                  <Text style={styles.newTagText}>NEW</Text>
                </View>
              )}
              {result.outcome === 'dupe' && (
                <View style={styles.dupeTag}>
                  <Text style={styles.dupeTagText}>DUPE</Text>
                </View>
              )}
            </View>
          ))}
          <View style={styles.pityRow}>
            <Text style={styles.pityLabel}>Pity:</Text>
            <Text style={styles.pityValue}>{item.pityBefore} → {item.pityAfter}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream.pure,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
    marginBottom: 24,
  },
  goSummonButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.gold.primary,
    borderRadius: 8,
  },
  goSummonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy.darkest,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.cream.soft,
  },
  cardTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pullCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold.light,
  },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  summaryBadge: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dupeBadge: {
    backgroundColor: COLORS.gold.dark,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.cream.pure,
  },
  rarityTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rarityTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
  },
  resultsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  resultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.cream.soft,
  },
  resultRarity: {
    fontSize: 12,
    fontWeight: '600',
  },
  newTag: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.cream.pure,
  },
  dupeTag: {
    backgroundColor: COLORS.gold.dark,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dupeTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.cream.pure,
  },
  pityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  pityLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  pityValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.cream.soft,
  },
});
