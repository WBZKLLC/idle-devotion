// /app/frontend/components/gacha/BannerDetailsSheet.tsx
// Phase 3.35: Banner Details Sheet
//
// Shows:
// - Odds table
// - Pity rules
// - Duplicate → shards explanation
// Receipt-based, no recomputation.

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BannerInfo } from '../../lib/api/gacha';
import { track, Events } from '../../lib/telemetry/events';
import { haptic } from '../../lib/ui/interaction';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845' },
  gold: { dark: '#b8860b', primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0' },
};

const RARITY_COLORS: Record<string, string> = {
  'N': '#808080',
  'R': '#4a90d9',
  'SR': '#8b9dc3',
  'SSR': '#c9a227',
  'SSR+': '#b8860b',
  'UR': '#6b5b95',
  'UR+': '#9b4dca',
  'filler': '#808080',
  'crystal_8k': '#3498db',
  'crystal_5k': '#3498db',
  'crystal_3k': '#3498db',
};

// Shard conversion rates (from backend)
const SHARD_CONVERSION: Record<string, number> = {
  'SR': 10,
  'SSR': 20,
  'SSR+': 30,
  'UR': 50,
  'UR+': 100,
};

interface BannerDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  banner: BannerInfo | null;
}

export function BannerDetailsSheet({
  visible,
  onClose,
  banner,
}: BannerDetailsSheetProps) {
  useEffect(() => {
    if (visible && banner) {
      track(Events.GACHA_RATES_VIEWED, { bannerId: banner.id });
    }
  }, [visible, banner]);
  
  const handleClose = () => {
    haptic('selection');
    onClose();
  };
  
  if (!banner) return null;
  
  // Sort rates by probability (highest first)
  const sortedRates = Object.entries(banner.rates).sort((a, b) => b[1] - a[1]);
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{banner.name}</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={COLORS.cream.soft} />
            </Pressable>
          </View>
          
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Description */}
            <Text style={styles.description}>{banner.description}</Text>
            
            {/* Odds Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pull Rates</Text>
              <View style={styles.ratesTable}>
                {sortedRates.map(([rarity, rate]) => (
                  <View key={rarity} style={styles.rateRow}>
                    <View style={styles.rarityBadge}>
                      <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[rarity] || COLORS.gold.primary }]} />
                      <Text style={[styles.rarityText, { color: RARITY_COLORS[rarity] || COLORS.cream.soft }]}>
                        {formatRarityName(rarity)}
                      </Text>
                    </View>
                    <Text style={styles.rateValue}>{(rate * 100).toFixed(2)}%</Text>
                  </View>
                ))}
              </View>
            </View>
            
            {/* Pity Rules */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pity System</Text>
              <View style={styles.pityBox}>
                <View style={styles.pityRow}>
                  <Ionicons name="star" size={16} color={COLORS.gold.primary} />
                  <Text style={styles.pityText}>
                    Guaranteed <Text style={styles.highlight}>{banner.guaranteedRarity}</Text> at{' '}
                    <Text style={styles.highlight}>{banner.pityThreshold}</Text> pulls
                  </Text>
                </View>
                <Text style={styles.pityNote}>
                  Counter resets after getting a {banner.guaranteedRarity} or higher.
                </Text>
              </View>
            </View>
            
            {/* Duplicate → Shards */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Duplicate Conversion</Text>
              <Text style={styles.dupeDescription}>
                Pulling a duplicate hero converts to shards:
              </Text>
              <View style={styles.shardTable}>
                {Object.entries(SHARD_CONVERSION).map(([rarity, shards]) => (
                  <View key={rarity} style={styles.shardRow}>
                    <Text style={[styles.shardRarity, { color: RARITY_COLORS[rarity] }]}>
                      {rarity}
                    </Text>
                    <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.shardAmount}>+{shards} Shards</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.shardNote}>
                Shards are used for hero star promotion.
              </Text>
            </View>
            
            {/* Cost Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cost</Text>
              <View style={styles.costBox}>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Single Pull</Text>
                  <Text style={styles.costValue}>
                    {getCurrencyIcon(banner.currency)} {banner.costSingle.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>×10 Pull</Text>
                  <Text style={styles.costValue}>
                    {getCurrencyIcon(banner.currency)} {banner.costMulti.toLocaleString()}
                  </Text>
                </View>
                {banner.costMulti < banner.costSingle * 10 && (
                  <Text style={styles.discountNote}>
                    Save {((1 - banner.costMulti / (banner.costSingle * 10)) * 100).toFixed(0)}% with ×10!
                  </Text>
                )}
              </View>
            </View>
            
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatRarityName(rarity: string): string {
  if (rarity === 'filler') return 'Bonus Reward';
  if (rarity.startsWith('crystal_')) return `Crystal (${rarity.split('_')[1]})`;
  return rarity;
}

function getCurrencyIcon(currency: string): string {
  if (currency === 'coins') return '💰';
  if (currency === 'crystals') return '💎';
  if (currency === 'divine_essence') return '✨';
  return '💎';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: COLORS.navy.dark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream.pure,
  },
  content: {
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
    marginBottom: 8,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold.light,
    marginBottom: 12,
  },
  ratesTable: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rarityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rarityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rateValue: {
    fontSize: 14,
    color: COLORS.cream.soft,
    fontWeight: '500',
  },
  pityBox: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 12,
  },
  pityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pityText: {
    fontSize: 14,
    color: COLORS.cream.soft,
  },
  highlight: {
    color: COLORS.gold.primary,
    fontWeight: '700',
  },
  pityNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  dupeDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  shardTable: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  shardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shardRarity: {
    fontSize: 13,
    fontWeight: '600',
    width: 40,
  },
  shardAmount: {
    fontSize: 13,
    color: COLORS.gold.light,
    fontWeight: '500',
  },
  shardNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  costBox: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.cream.soft,
  },
  discountNote: {
    fontSize: 12,
    color: COLORS.gold.light,
    marginTop: 4,
  },
});

export default BannerDetailsSheet;
