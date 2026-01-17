// /app/frontend/components/gacha/SummonResultsModal.tsx
// Phase 3.34: Full-screen Summon Results Modal
//
// Displays summon results with:
// - Full-screen overlay
// - Hero reveal cards with rarity frames
// - NEW vs DUPLICATE indicators
// - Shard conversion display from receipt
// - Single exit action
// - No timers, no auto-advance
//
// IMPORTANT: Uses canonical receipt data ONLY. No client-side RNG or recomputation.

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GachaPullResult, GachaReceipt } from '../../lib/types/receipt';
import { track, Events } from '../../lib/telemetry/events';
import { haptic } from '../../lib/ui/interaction';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
};

// Rarity color mapping
const RARITY_COLORS: Record<string, string> = {
  'N': '#808080',
  'R': '#4a90d9',
  'SR': '#8b9dc3',
  'SSR': '#c9a227',
  'SSR+': '#b8860b',
  'UR': '#6b5b95',
  'UR+': '#9b4dca',
};

// Rarity glow colors (for border/shadow effects)
const RARITY_GLOW: Record<string, string> = {
  'N': 'rgba(128, 128, 128, 0.3)',
  'R': 'rgba(74, 144, 217, 0.4)',
  'SR': 'rgba(139, 157, 195, 0.5)',
  'SSR': 'rgba(201, 162, 39, 0.6)',
  'SSR+': 'rgba(184, 134, 11, 0.7)',
  'UR': 'rgba(107, 91, 149, 0.7)',
  'UR+': 'rgba(155, 77, 202, 0.8)',
};

// Element color mapping
const ELEMENT_COLORS: Record<string, string> = {
  'Fire': '#e74c3c',
  'Water': '#3498db',
  'Earth': '#8b4513',
  'Wind': '#2ecc71',
  'Light': '#f1c40f',
  'Dark': '#9b59b6',
};

// =============================================================================
// TYPES
// =============================================================================

interface SummonResultsModalProps {
  visible: boolean;
  receipt: GachaReceipt | null;
  onClose: () => void;
  pityBefore: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SummonResultsModal({
  visible,
  receipt,
  onClose,
  pityBefore,
}: SummonResultsModalProps) {
  // Emit telemetry when results are viewed
  useEffect(() => {
    if (visible && receipt) {
      const newHeroes = receipt.results.filter(r => r.outcome === 'new' && !r.isFiller);
      const duplicates = receipt.results.filter(r => r.outcome === 'dupe' && !r.isFiller);
      
      // Emit GACHA_RESULTS_VIEWED once per view
      track(Events.GACHA_RESULTS_VIEWED, {
        bannerId: receipt.bannerId,
        pullCount: receipt.pullCount,
        newHeroCount: newHeroes.length,
        duplicateCount: duplicates.length,
        pityTriggered: receipt.pityTriggered,
      });
      
      // Emit GACHA_NEW_HERO_ACQUIRED if any new heroes
      if (newHeroes.length > 0) {
        track(Events.GACHA_NEW_HERO_ACQUIRED, {
          count: newHeroes.length,
          heroes: newHeroes.map(h => ({ id: h.heroDataId, rarity: h.rarity })),
        });
      }
      
      // Emit GACHA_DUPLICATE_CONVERTED if any duplicates
      if (duplicates.length > 0) {
        const totalShards = duplicates.reduce((sum, d) => sum + (d.shardsGranted || 0), 0);
        track(Events.GACHA_DUPLICATE_CONVERTED, {
          count: duplicates.length,
          totalShards,
        });
      }
    }
  }, [visible, receipt]);
  
  // Analyze results from receipt (read-only, no recomputation)
  const analysis = useMemo(() => {
    if (!receipt) return null;
    
    const heroes = receipt.results.filter(r => !r.isFiller);
    const fillers = receipt.results.filter(r => r.isFiller);
    const newHeroes = heroes.filter(h => h.outcome === 'new');
    const duplicates = heroes.filter(h => h.outcome === 'dupe');
    
    return {
      heroes,
      fillers,
      newHeroes,
      duplicates,
      totalShards: duplicates.reduce((sum, d) => sum + (d.shardsGranted || 0), 0),
      hasNewHero: newHeroes.length > 0,
      hasDuplicates: duplicates.length > 0,
    };
  }, [receipt]);
  
  const handleClose = () => {
    haptic('selection');
    onClose();
  };
  
  if (!receipt || !analysis) return null;
  
  const isMultiPull = receipt.pullCount > 1;
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <LinearGradient
        colors={[COLORS.navy.darkest, COLORS.navy.dark, COLORS.navy.primary]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isMultiPull ? 'Summon Results ×10' : 'Summon Result'}
            </Text>
            {receipt.pityTriggered && (
              <View style={styles.pityBadge}>
                <Ionicons name="star" size={14} color={COLORS.gold.primary} />
                <Text style={styles.pityBadgeText}>Pity Triggered!</Text>
              </View>
            )}
          </View>
          
          {/* Summary Strip */}
          <View style={styles.summaryStrip}>
            {analysis.hasNewHero && (
              <View style={styles.summaryItem}>
                <Ionicons name="sparkles" size={16} color={COLORS.gold.primary} />
                <Text style={styles.summaryText}>
                  {analysis.newHeroes.length === 1
                    ? 'New Hero Unlocked!'
                    : `${analysis.newHeroes.length} New Heroes!`}
                </Text>
              </View>
            )}
            {analysis.hasDuplicates && (
              <View style={styles.summaryItem}>
                <Ionicons name="layers" size={16} color={COLORS.gold.light} />
                <Text style={styles.summaryText}>
                  +{analysis.totalShards} Shards
                </Text>
              </View>
            )}
            <View style={styles.pityProgress}>
              <Text style={styles.pityLabel}>Pity:</Text>
              <Text style={styles.pityValue}>
                {pityBefore} → {receipt.pityAfter}
              </Text>
            </View>
          </View>
          
          {/* Results Grid/Scroll */}
          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.resultsGrid}>
              {receipt.results.map((result, index) => (
                <ResultCard key={index} result={result} index={index} />
              ))}
            </View>
          </ScrollView>
          
          {/* Shard Conversion Details (if any duplicates) */}
          {analysis.hasDuplicates && (
            <View style={styles.shardConversionBox}>
              <Text style={styles.shardConversionTitle}>Shard Conversions</Text>
              {analysis.duplicates.map((dupe, index) => (
                <View key={index} style={styles.shardConversionRow}>
                  <Text style={styles.shardConversionText}>
                    {dupe.heroName}
                  </Text>
                  <Text style={styles.shardConversionAmount}>
                    → +{dupe.shardsGranted} Shards
                  </Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Exit Button */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={handleClose}
            >
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.backButtonGradient}
              >
                <Ionicons name="arrow-back" size={20} color={COLORS.navy.darkest} />
                <Text style={styles.backButtonText}>Back to Banner</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

// =============================================================================
// RESULT CARD COMPONENT
// =============================================================================

interface ResultCardProps {
  result: GachaPullResult;
  index: number;
}

function ResultCard({ result, index }: ResultCardProps) {
  const rarityColor = RARITY_COLORS[result.rarity] || RARITY_COLORS['SR'];
  const glowColor = RARITY_GLOW[result.rarity] || RARITY_GLOW['SR'];
  const elementColor = result.element ? ELEMENT_COLORS[result.element] : null;
  
  // Handle filler rewards
  if (result.isFiller) {
    return (
      <View style={[styles.resultCard, { borderColor: COLORS.gold.light }]}>
        <View style={styles.cardInner}>
          <View style={[styles.rarityBadge, { backgroundColor: COLORS.gold.dark }]}>
            <Text style={styles.rarityText}>BONUS</Text>
          </View>
          <View style={styles.fillerIconContainer}>
            <Text style={styles.fillerIcon}>
              {getFillerIcon(result.fillerType)}
            </Text>
          </View>
          <Text style={styles.cardName} numberOfLines={2}>
            {result.heroName || 'Bonus Reward'}
          </Text>
          {result.fillerAmount && (
            <Text style={styles.fillerAmount}>+{result.fillerAmount.toLocaleString()}</Text>
          )}
        </View>
      </View>
    );
  }
  
  // Hero card
  const isNew = result.outcome === 'new';
  const isDupe = result.outcome === 'dupe';
  
  return (
    <View
      style={[
        styles.resultCard,
        { borderColor: rarityColor },
        isNew && { shadowColor: glowColor, shadowOpacity: 0.8, shadowRadius: 12 },
      ]}
    >
      <View style={styles.cardInner}>
        {/* Rarity Badge */}
        <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
          <Text style={styles.rarityText}>{result.rarity}</Text>
        </View>
        
        {/* NEW Badge */}
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
        
        {/* DUPE Badge */}
        {isDupe && (
          <View style={styles.dupeBadge}>
            <Text style={styles.dupeBadgeText}>DUPE</Text>
          </View>
        )}
        
        {/* Pity Star */}
        {result.isPityReward && (
          <View style={styles.pityStarBadge}>
            <Ionicons name="star" size={12} color={COLORS.gold.primary} />
          </View>
        )}
        
        {/* Hero Portrait */}
        {result.imageUrl ? (
          <Image
            source={{ uri: result.imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: rarityColor + '20' }]}>
            <Ionicons name="person" size={36} color={rarityColor} />
          </View>
        )}
        
        {/* Hero Name */}
        <Text style={styles.cardName} numberOfLines={2}>
          {result.heroName || 'Unknown Hero'}
        </Text>
        
        {/* Element */}
        {elementColor && (
          <Text style={[styles.elementText, { color: elementColor }]}>
            {result.element}
          </Text>
        )}
        
        {/* Shard Conversion (for duplicates) */}
        {isDupe && result.shardsGranted && (
          <View style={styles.shardLine}>
            <Ionicons name="layers" size={12} color={COLORS.gold.light} />
            <Text style={styles.shardLineText}>+{result.shardsGranted}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getFillerIcon(type?: string | null): string {
  if (!type) return '🎁';
  if (type.includes('crystal')) return '💎';
  if (type.includes('gold')) return '🪙';
  if (type.includes('coin')) return '💰';
  if (type.includes('shard')) return '⭐';
  if (type.includes('essence')) return '✨';
  return '🎁';
}

// =============================================================================
// STYLES
// =============================================================================

const CARD_WIDTH = (SCREEN_WIDTH - 48 - 16) / 2; // 2 columns with padding

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.cream.pure,
    textAlign: 'center',
  },
  pityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold.primary + '30',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  pityBadgeText: {
    color: COLORS.gold.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  summaryText: {
    color: COLORS.cream.soft,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  pityProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pityLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  pityValue: {
    color: COLORS.cream.soft,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  resultCard: {
    width: CARD_WIDTH,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: COLORS.navy.dark,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 10,
    alignItems: 'center',
  },
  rarityBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  rarityText: {
    color: COLORS.cream.pure,
    fontSize: 10,
    fontWeight: '700',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#2ecc71',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  newBadgeText: {
    color: COLORS.cream.pure,
    fontSize: 9,
    fontWeight: '700',
  },
  dupeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.gold.dark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  dupeBadgeText: {
    color: COLORS.cream.pure,
    fontSize: 9,
    fontWeight: '700',
  },
  pityStarBadge: {
    position: 'absolute',
    top: 26,
    right: 6,
    zIndex: 10,
  },
  heroImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: 20,
    marginBottom: 8,
  },
  heroPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: 20,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    color: COLORS.cream.soft,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  elementText: {
    fontSize: 11,
    fontWeight: '500',
  },
  shardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: COLORS.gold.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  shardLineText: {
    color: COLORS.gold.light,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  fillerIconContainer: {
    width: 64,
    height: 64,
    marginTop: 20,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fillerIcon: {
    fontSize: 36,
  },
  fillerAmount: {
    color: COLORS.gold.light,
    fontSize: 12,
    fontWeight: '600',
  },
  shardConversionBox: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 12,
  },
  shardConversionTitle: {
    color: COLORS.cream.soft,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  shardConversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  shardConversionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  shardConversionAmount: {
    color: COLORS.gold.light,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  backButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: COLORS.navy.darkest,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default SummonResultsModal;
