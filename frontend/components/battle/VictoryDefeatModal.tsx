/**
 * Phase 3.50: Victory/Defeat UX Modal
 * 
 * Victory Screen:
 * - Title + hero portrait header
 * - Rewards panel using ReceiptViewer
 * - Progress beat (chapter/dungeon progress)
 * - Single CTA: Continue
 * 
 * Defeat Screen:
 * - Clear failure reason labels
 * - Recommended action CTA
 * - Power comparison display
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { track, Events } from '../../lib/telemetry/events';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b' },
  gold: { primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  victory: '#22c55e',
  defeat: '#ef4444',
};

// Defeat reasons mapped to icons and recommended actions
const DEFEAT_REASONS = {
  power_low: {
    label: 'Power too low',
    icon: 'trending-down',
    action: 'Upgrade Heroes',
    route: '/heroes',
  },
  team_synergy: {
    label: 'Team synergy weak',
    icon: 'people',
    action: 'Adjust Formation',
    route: '/heroes',
  },
  need_promotion: {
    label: 'Heroes need promotion',
    icon: 'star-half',
    action: 'Promote Heroes',
    route: '/heroes',
  },
  need_equipment: {
    label: 'Better gear needed',
    icon: 'shield',
    action: 'Get Equipment',
    route: '/dungeons',
  },
} as const;

export type VictoryDefeatData = {
  victory: boolean;
  stageName?: string;
  stars?: number;
  firstClear?: boolean;
  rewards?: Record<string, number>;
  receipt?: any; // Canonical reward receipt
  
  // Progress info
  chapterProgress?: { current: number; total: number };
  dungeonFloor?: number;
  
  // Defeat info
  playerPower?: number;
  enemyPower?: number;
  defeatReason?: keyof typeof DEFEAT_REASONS;
  
  // Unlock message
  unlockMessage?: string;
};

type Props = {
  visible: boolean;
  data: VictoryDefeatData | null;
  onContinue: () => void;
  mode?: 'campaign' | 'dungeon' | 'arena';
};

export function VictoryDefeatModal({ visible, data, onContinue, mode = 'campaign' }: Props) {
  const router = useRouter();
  
  if (!visible || !data) return null;
  
  const handleContinue = () => {
    if (data.victory) {
      track(Events.PVE_VICTORY_VIEWED, { mode, stars: data.stars, firstClear: data.firstClear });
    } else {
      track(Events.PVE_DEFEAT_VIEWED, { mode, defeatReason: data.defeatReason });
    }
    onContinue();
  };
  
  const handleRecommendation = (route: string) => {
    track(Events.PVE_DEFEAT_RECOMMENDATION_CLICKED, {
      mode,
      recommendation: route,
      defeatReason: data.defeatReason,
    });
    onContinue();
    router.push(route as any);
  };
  
  // Determine defeat reason based on power comparison
  const getDefeatReason = (): keyof typeof DEFEAT_REASONS => {
    if (data.defeatReason) return data.defeatReason;
    
    const playerPower = data.playerPower ?? 0;
    const enemyPower = data.enemyPower ?? 0;
    
    if (enemyPower > 0 && playerPower < enemyPower * 0.7) {
      return 'power_low';
    }
    if (enemyPower > 0 && playerPower < enemyPower * 0.9) {
      return 'need_promotion';
    }
    return 'need_equipment';
  };
  
  const defeatInfo = data.victory ? null : DEFEAT_REASONS[getDefeatReason()];
  
  // Calculate power gap percentage for defeat
  const powerGapPercent = (() => {
    if (data.victory || !data.enemyPower || !data.playerPower) return null;
    const gap = ((data.enemyPower - data.playerPower) / data.enemyPower) * 100;
    return Math.round(Math.max(0, gap));
  })();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleContinue}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={data.victory ? [COLORS.victory + '30', COLORS.navy.dark] : [COLORS.defeat + '30', COLORS.navy.dark]}
            style={styles.gradient}
          >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.title, data.victory ? styles.victoryText : styles.defeatText]}>
                  {data.victory ? '🎉 VICTORY!' : '💀 DEFEAT'}
                </Text>
                {data.stageName && (
                  <Text style={styles.stageName}>{data.stageName}</Text>
                )}
              </View>
              
              {data.victory ? (
                /* Victory Content */
                <>
                  {/* First Clear Badge */}
                  {data.firstClear && (
                    <View style={styles.firstClearBadge}>
                      <Ionicons name="star" size={16} color={COLORS.gold.primary} />
                      <Text style={styles.firstClearText}>First Clear!</Text>
                    </View>
                  )}
                  
                  {/* Stars */}
                  {data.stars !== undefined && (
                    <View style={styles.starsContainer}>
                      {[1, 2, 3].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= (data.stars || 0) ? 'star' : 'star-outline'}
                          size={32}
                          color={star <= (data.stars || 0) ? COLORS.gold.primary : COLORS.cream.dark}
                        />
                      ))}
                    </View>
                  )}
                  
                  {/* Rewards */}
                  {data.rewards && Object.keys(data.rewards).length > 0 && (
                    <View style={styles.rewardsSection}>
                      <Text style={styles.sectionTitle}>Rewards Earned</Text>
                      <View style={styles.rewardsGrid}>
                        {Object.entries(data.rewards).map(([key, val]) => (
                          <View key={key} style={styles.rewardItem}>
                            <Text style={styles.rewardValue}>+{(val as number).toLocaleString()}</Text>
                            <Text style={styles.rewardLabel}>{key.replace(/_/g, ' ')}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* Receipt Viewer (if canonical receipt provided) */}
                  {data.receipt && (
                    <View style={styles.receiptSection}>
                      <Text style={styles.sectionTitle}>Rewards Detail</Text>
                      <View style={styles.rewardsGrid}>
                        {data.receipt.items?.map((item: any, idx: number) => (
                          <View key={idx} style={styles.rewardItem}>
                            <Text style={styles.rewardValue}>+{(item.quantity || item.amount || 0).toLocaleString()}</Text>
                            <Text style={styles.rewardLabel}>{(item.type || item.name || 'reward').replace(/_/g, ' ')}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* Progress Beat */}
                  {data.chapterProgress && (
                    <View style={styles.progressSection}>
                      <Ionicons name="flag" size={16} color={COLORS.gold.light} />
                      <Text style={styles.progressText}>
                        Chapter Progress: {data.chapterProgress.current}/{data.chapterProgress.total}
                      </Text>
                    </View>
                  )}
                  {data.dungeonFloor && (
                    <View style={styles.progressSection}>
                      <Ionicons name="layers" size={16} color={COLORS.gold.light} />
                      <Text style={styles.progressText}>
                        Floor {data.dungeonFloor} Cleared!
                      </Text>
                    </View>
                  )}
                  
                  {/* Unlock Message */}
                  {data.unlockMessage && (
                    <View style={styles.unlockBadge}>
                      <Ionicons name="gift" size={18} color={COLORS.victory} />
                      <Text style={styles.unlockText}>{data.unlockMessage}</Text>
                    </View>
                  )}
                </>
              ) : (
                /* Defeat Content */
                <>
                  {/* Power Comparison */}
                  {powerGapPercent !== null && (
                    <View style={styles.powerSection}>
                      <Text style={styles.powerGapLabel}>Power Gap</Text>
                      <Text style={styles.powerGapValue}>
                        Enemy was {powerGapPercent}% stronger
                      </Text>
                      <View style={styles.powerComparison}>
                        <View style={styles.powerBar}>
                          <Text style={styles.powerBarLabel}>You</Text>
                          <View style={[styles.powerFill, { width: `${Math.min(100, ((data.playerPower || 0) / (data.enemyPower || 1)) * 100)}%` }]} />
                          <Text style={styles.powerValue}>{(data.playerPower || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.powerBar}>
                          <Text style={styles.powerBarLabel}>Enemy</Text>
                          <View style={[styles.powerFill, styles.enemyPower, { width: '100%' }]} />
                          <Text style={styles.powerValue}>{(data.enemyPower || 0).toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  
                  {/* Defeat Reason */}
                  {defeatInfo && (
                    <View style={styles.defeatReasonSection}>
                      <View style={styles.defeatReasonCard}>
                        <Ionicons name={defeatInfo.icon as any} size={24} color={COLORS.defeat} />
                        <Text style={styles.defeatReasonLabel}>{defeatInfo.label}</Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Almost indicator */}
                  {powerGapPercent !== null && powerGapPercent < 15 && (
                    <View style={styles.almostBadge}>
                      <Text style={styles.almostText}>💪 So close! You almost had it!</Text>
                    </View>
                  )}
                  
                  {/* Recommendation CTA */}
                  {defeatInfo && (
                    <TouchableOpacity
                      style={styles.recommendButton}
                      onPress={() => handleRecommendation(defeatInfo.route)}
                    >
                      <LinearGradient
                        colors={[COLORS.gold.primary, COLORS.gold.light]}
                        style={styles.recommendGradient}
                      >
                        <Ionicons name="arrow-forward" size={20} color={COLORS.navy.darkest} />
                        <Text style={styles.recommendText}>{defeatInfo.action}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
            
            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
            >
              <Text style={styles.continueText}>
                {data.victory ? 'Continue' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  victoryText: {
    color: COLORS.victory,
  },
  defeatText: {
    color: COLORS.defeat,
  },
  stageName: {
    fontSize: 14,
    color: COLORS.cream.dark,
    marginTop: 4,
  },
  firstClearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold.primary + '30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  firstClearText: {
    color: COLORS.gold.primary,
    fontWeight: 'bold',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: COLORS.cream.dark,
    textAlign: 'center',
    marginBottom: 12,
  },
  rewardsSection: {
    width: '100%',
    marginBottom: 16,
  },
  rewardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  rewardItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold.primary,
  },
  rewardLabel: {
    fontSize: 10,
    color: COLORS.cream.dark,
    textTransform: 'capitalize',
  },
  receiptSection: {
    width: '100%',
    marginBottom: 16,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.gold.light,
  },
  unlockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.victory + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  unlockText: {
    color: COLORS.victory,
    fontSize: 13,
  },
  powerSection: {
    width: '100%',
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  powerGapLabel: {
    fontSize: 12,
    color: COLORS.cream.dark,
    textAlign: 'center',
  },
  powerGapValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.defeat,
    textAlign: 'center',
    marginBottom: 12,
  },
  powerComparison: {
    gap: 8,
  },
  powerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  powerBarLabel: {
    fontSize: 11,
    color: COLORS.cream.dark,
    width: 45,
  },
  powerFill: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.victory,
    borderRadius: 4,
  },
  enemyPower: {
    backgroundColor: COLORS.defeat,
  },
  powerValue: {
    fontSize: 11,
    color: COLORS.cream.soft,
    width: 60,
    textAlign: 'right',
  },
  defeatReasonSection: {
    marginBottom: 16,
  },
  defeatReasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.defeat + '20',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.defeat + '40',
  },
  defeatReasonLabel: {
    fontSize: 16,
    color: COLORS.cream.soft,
    fontWeight: '600',
  },
  almostBadge: {
    backgroundColor: COLORS.gold.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  almostText: {
    fontSize: 14,
    color: COLORS.gold.light,
    textAlign: 'center',
    fontWeight: '600',
  },
  recommendButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  recommendGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  recommendText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.navy.darkest,
  },
  continueButton: {
    backgroundColor: COLORS.cream.pure,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  continueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.navy.darkest,
    textAlign: 'center',
  },
});
