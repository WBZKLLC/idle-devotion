// /app/frontend/components/hero/PromotionModal.tsx
// Phase 3.40: Hero Star Promotion Modal
//
// Shows:
// - Current star → next star
// - Shard cost
// - Disabled when insufficient shards
// - Uses ReceiptViewer for results
// - NO STAT RECOMPUTATION

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { promoteHero, generatePromotionSourceId, PromotionReceipt, isInsufficientShardsError } from '../../lib/api/heroProgression';
import { track, Events } from '../../lib/telemetry/events';
import { haptic } from '../../lib/ui/interaction';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845' },
  gold: { dark: '#b8860b', primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0' },
  green: { primary: '#2ecc71' },
  red: { primary: '#e74c3c' },
};

interface PromotionModalProps {
  visible: boolean;
  onClose: () => void;
  heroId: string;
  heroName: string;
  currentStar: number;
  nextStar: number;
  shardCost: number;
  currentShards: number;
  maxStarReached: boolean;
  onSuccess: (receipt: PromotionReceipt) => void;
}

export function PromotionModal({
  visible,
  onClose,
  heroId,
  heroName,
  currentStar,
  nextStar,
  shardCost,
  currentShards,
  maxStarReached,
  onSuccess,
}: PromotionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const hasEnoughShards = currentShards >= shardCost;
  const canPromote = hasEnoughShards && !maxStarReached && !loading;
  
  React.useEffect(() => {
    if (visible) {
      track(Events.HERO_PROMOTION_VIEWED, { heroId, currentStar });
    }
  }, [visible, heroId, currentStar]);
  
  const handlePromote = async () => {
    if (!canPromote) return;
    
    setLoading(true);
    setError(null);
    haptic('selection');
    
    try {
      const sourceId = generatePromotionSourceId(heroId);
      const receipt = await promoteHero(heroId, sourceId);
      
      haptic('success');
      onSuccess(receipt);
      onClose();
    } catch (err: any) {
      if (isInsufficientShardsError(err)) {
        setError(`Need ${err.deficit} more shards`);
      } else {
        setError(err.message || 'Promotion failed');
      }
      haptic('error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    haptic('selection');
    setError(null);
    onClose();
  };
  
  const renderStars = (count: number, filled: boolean) => {
    return Array.from({ length: count }).map((_, i) => (
      <Ionicons
        key={i}
        name={filled ? 'star' : 'star-outline'}
        size={20}
        color={filled ? COLORS.gold.primary : 'rgba(255,255,255,0.3)'}
      />
    ));
  };
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Promote Hero</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={COLORS.cream.soft} />
            </Pressable>
          </View>
          
          <Text style={styles.heroName}>{heroName}</Text>
          
          {maxStarReached ? (
            <View style={styles.maxStarBox}>
              <Ionicons name="trophy" size={32} color={COLORS.gold.primary} />
              <Text style={styles.maxStarText}>Maximum Star Reached!</Text>
              <View style={styles.starRow}>
                {renderStars(6, true)}
              </View>
            </View>
          ) : (
            <>
              {/* Star Preview */}
              <View style={styles.starPreview}>
                <View style={styles.starColumn}>
                  <Text style={styles.starLabel}>Current</Text>
                  <View style={styles.starRow}>
                    {renderStars(currentStar, true)}
                    {renderStars(6 - currentStar, false)}
                  </View>
                </View>
                
                <Ionicons name="arrow-forward" size={24} color={COLORS.gold.light} />
                
                <View style={styles.starColumn}>
                  <Text style={styles.starLabel}>After</Text>
                  <View style={styles.starRow}>
                    {renderStars(nextStar, true)}
                    {renderStars(6 - nextStar, false)}
                  </View>
                </View>
              </View>
              
              {/* Cost */}
              <View style={styles.costBox}>
                <Text style={styles.costLabel}>Cost</Text>
                <View style={styles.costRow}>
                  <Ionicons name="layers" size={18} color={COLORS.gold.light} />
                  <Text style={styles.costValue}>{shardCost} Shards</Text>
                </View>
                <View style={styles.shardBalance}>
                  <Text style={[styles.shardBalanceText, !hasEnoughShards && styles.insufficientText]}>
                    You have: {currentShards} / {shardCost}
                  </Text>
                  {!hasEnoughShards && (
                    <Text style={styles.deficitText}>Need {shardCost - currentShards} more</Text>
                  )}
                </View>
              </View>
              
              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.red.primary} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              
              {/* Actions */}
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.promoteButton,
                    !canPromote && styles.disabledButton,
                    pressed && canPromote && styles.buttonPressed,
                  ]}
                  onPress={handlePromote}
                  disabled={!canPromote}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.navy.darkest} />
                  ) : (
                    <LinearGradient
                      colors={canPromote ? [COLORS.gold.primary, COLORS.gold.dark] : ['#555', '#444']}
                      style={styles.promoteButtonGradient}
                    >
                      <Ionicons name="star" size={18} color={canPromote ? COLORS.navy.darkest : '#888'} />
                      <Text style={[styles.promoteButtonText, !canPromote && styles.disabledButtonText]}>
                        Promote
                      </Text>
                    </LinearGradient>
                  )}
                </Pressable>
                
                <Pressable style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '30',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream.pure,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gold.light,
    textAlign: 'center',
    marginBottom: 16,
  },
  maxStarBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  maxStarText: {
    fontSize: 14,
    color: COLORS.gold.primary,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  starPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  starColumn: {
    alignItems: 'center',
  },
  starLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  costBox: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  costLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  costValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream.soft,
  },
  shardBalance: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  shardBalanceText: {
    fontSize: 13,
    color: COLORS.green.primary,
  },
  insufficientText: {
    color: COLORS.red.primary,
  },
  deficitText: {
    fontSize: 12,
    color: COLORS.red.primary,
    marginTop: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.red.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.red.primary,
  },
  actions: {
    gap: 10,
  },
  promoteButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  promoteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  promoteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#888',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default PromotionModal;
