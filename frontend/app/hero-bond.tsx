// /app/frontend/app/hero-bond.tsx
// Phase 3.26: Bond Screen with Tier Ladder + Unlock Disclosure
//
// Shows affinity tier progression and unlock information.
// Uses centralized tier table from lib/hero/motion.ts (no hardcoded thresholds).

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

// Store
import { useGameStore, useHydration } from '../stores/gameStore';

// Theme
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';

// Hero motion (SINGLE SOURCE OF TRUTH for tiers)
import {
  getTierTable,
  getTierInfo,
  getNextTierInfo,
  resolveMotionTier,
  MotionTier,
  TierInfo,
} from '../lib/hero/motion';

// Telemetry
import { track, Events } from '../lib/telemetry/events';

// Haptics
import { haptic } from '../lib/ui/interaction';

export default function HeroBondScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hydrated = useHydration();
  const { user, getUserHeroById } = useGameStore();
  
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState<any>(null);
  const [heroData, setHeroData] = useState<any>(null);
  const hasEmittedView = useRef(false);
  
  // Load hero data
  useEffect(() => {
    if (!hydrated || !user || !id) return;
    
    const loadHero = async () => {
      setLoading(true);
      try {
        const userHero = await getUserHeroById(id);
        if (userHero) {
          setHero(userHero);
          setHeroData(userHero.hero_data);
        }
      } catch (err) {
        console.error('[HeroBond] Failed to load hero:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadHero();
  }, [hydrated, user, id, getUserHeroById]);
  
  // Emit view telemetry once
  useEffect(() => {
    if (heroData && !hasEmittedView.current) {
      hasEmittedView.current = true;
      track(Events.BOND_VIEWED, { heroDataId: heroData.id });
      track(Events.BOND_TIER_LADDER_VIEWED, { heroDataId: heroData.id });
    }
  }, [heroData]);
  
  // Current tier and next unlock
  const affinityLevel = hero?.affinity_level || 0;
  const currentTier = resolveMotionTier(affinityLevel);
  const currentTierInfo = getTierInfo(currentTier);
  const nextTierInfo = getNextTierInfo(currentTier);
  const tierTable = getTierTable();
  
  // Emit next unlock view
  useEffect(() => {
    if (nextTierInfo && heroData) {
      track(Events.BOND_NEXT_UNLOCK_VIEWED, {
        heroDataId: heroData.id,
        nextTier: nextTierInfo.tier,
        affinityRequired: nextTierInfo.affinityRequired,
      });
    }
  }, [nextTierInfo, heroData]);
  
  const handleBack = () => {
    haptic('light');
    router.back();
  };
  
  // Loading state
  if (!hydrated || loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.navy.darkest, COLORS.navy.dark]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }
  
  // Error state
  if (!hero || !heroData) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.navy.darkest, COLORS.navy.dark]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.cream.dark} />
          <Text style={styles.errorText}>Hero not found</Text>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.navy.darkest, COLORS.navy.dark]}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
          </Pressable>
          <Text style={styles.headerTitle}>Bond</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Info Card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroName}>{heroData.name}</Text>
            <View style={styles.affinityRow}>
              <Ionicons name="heart" size={20} color={COLORS.gold.primary} />
              <Text style={styles.affinityValue}>{affinityLevel}</Text>
              <Text style={styles.affinityLabel}>Affinity</Text>
            </View>
            <Text style={styles.currentTierText}>
              Tier {currentTier}: {currentTierInfo.unlockSummary}
            </Text>
          </View>
          
          {/* Next Unlock Card */}
          {nextTierInfo && (
            <View style={styles.nextUnlockCard}>
              <View style={styles.nextUnlockHeader}>
                <Ionicons name="lock-open-outline" size={18} color={COLORS.gold.light} />
                <Text style={styles.nextUnlockTitle}>Next Unlock</Text>
              </View>
              <Text style={styles.nextUnlockAffinity}>
                at Affinity {nextTierInfo.affinityRequired}
              </Text>
              <Text style={styles.nextUnlockSummary}>
                {nextTierInfo.unlockSummary}
              </Text>
              <View style={styles.nextUnlockDetails}>
                <Text style={styles.detailLabel}>Camera: {nextTierInfo.cameraLabel}</Text>
                <Text style={styles.detailLabel}>Motion: {nextTierInfo.motionLabel}</Text>
                <Text style={styles.detailLabel}>Parallax: {nextTierInfo.parallaxLabel}</Text>
              </View>
            </View>
          )}
          
          {/* Tier Ladder */}
          <View style={styles.ladderSection}>
            <Text style={styles.ladderTitle}>Tier Progression</Text>
            {tierTable.map((tier) => (
              <TierRow
                key={tier.tier}
                tier={tier}
                isCurrent={tier.tier === currentTier}
                isUnlocked={affinityLevel >= tier.affinityRequired}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Tier Row Component
function TierRow({ tier, isCurrent, isUnlocked }: {
  tier: TierInfo;
  isCurrent: boolean;
  isUnlocked: boolean;
}) {
  return (
    <View style={[
      styles.tierRow,
      isCurrent && styles.tierRowCurrent,
      !isUnlocked && styles.tierRowLocked,
    ]}>
      <View style={styles.tierBadge}>
        <Text style={[
          styles.tierNumber,
          isCurrent && styles.tierNumberCurrent,
          !isUnlocked && styles.tierNumberLocked,
        ]}>
          {tier.tier}
        </Text>
      </View>
      
      <View style={styles.tierInfo}>
        <Text style={[
          styles.tierSummary,
          !isUnlocked && styles.tierTextLocked,
        ]}>
          {tier.unlockSummary}
        </Text>
        <Text style={[
          styles.tierDetails,
          !isUnlocked && styles.tierTextLocked,
        ]}>
          {tier.cameraLabel} • {tier.motionLabel}
        </Text>
      </View>
      
      <View style={styles.tierStatus}>
        {isUnlocked ? (
          <Ionicons 
            name={isCurrent ? "checkmark-circle" : "checkmark"} 
            size={20} 
            color={isCurrent ? COLORS.gold.primary : COLORS.cream.dark} 
          />
        ) : (
          <View style={styles.affinityReq}>
            <Ionicons name="heart-outline" size={12} color={COLORS.cream.dark} />
            <Text style={styles.affinityReqText}>{tier.affinityRequired}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  safeArea: {
    flex: 1,
  },
  
  // Loading/Error
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.cream.dark,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.pure,
    fontWeight: FONT_WEIGHT.medium,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.cream.pure,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: LAYOUT.SCREEN_PADDING,
    gap: 16,
  },
  
  // Hero Card
  heroCard: {
    backgroundColor: COLORS.navy.dark + 'D0',
    borderRadius: RADIUS.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  heroName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.cream.pure,
    marginBottom: 12,
  },
  affinityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  affinityValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gold.primary,
  },
  affinityLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
  },
  currentTierText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.soft,
  },
  
  // Next Unlock Card
  nextUnlockCard: {
    backgroundColor: COLORS.gold.primary + '15',
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '30',
  },
  nextUnlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nextUnlockTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.light,
  },
  nextUnlockAffinity: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.pure,
    marginBottom: 4,
  },
  nextUnlockSummary: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
    marginBottom: 12,
  },
  nextUnlockDetails: {
    gap: 4,
  },
  detailLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.soft,
  },
  
  // Tier Ladder
  ladderSection: {
    marginTop: 8,
  },
  ladderTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginBottom: 12,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark + '80',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  tierRowCurrent: {
    backgroundColor: COLORS.gold.primary + '20',
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '40',
  },
  tierRowLocked: {
    opacity: 0.6,
  },
  tierBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.navy.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierNumber: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.cream.pure,
  },
  tierNumberCurrent: {
    color: COLORS.gold.primary,
  },
  tierNumberLocked: {
    color: COLORS.cream.dark,
  },
  tierInfo: {
    flex: 1,
  },
  tierSummary: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
  },
  tierDetails: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    marginTop: 2,
  },
  tierTextLocked: {
    color: COLORS.cream.dark,
  },
  tierStatus: {
    width: 40,
    alignItems: 'center',
  },
  affinityReq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  affinityReqText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
});
