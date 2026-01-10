import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Platform,
  Pressable,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Centralized tier logic (SINGLE SOURCE OF TRUTH)
import {
  DisplayTier,
  displayStars,
  unlockedTierForHero,
  computeUserMaxUnlockedTier,
  TIER_LABELS,
  labelForStars,
} from '../lib/progression';

// ✅ Shared 2Dlive shell (UI-only)
import {
  CenteredBackground,
  DivineOverlays,
  SummonAtmosphere,
  GlassCard,
} from '../components/DivineShell';

const RARITY_COLORS: { [key: string]: string } = {
  'SR': '#4CAF50',
  'SSR': '#9C27B0',
  'UR': '#FF9800',
  'UR+': '#F44336',
};

/**
 * GACHA / SUMMON — 2Dlive UI shell
 * - ALL original logic preserved (pullGacha, pity, currency, modal)
 * - UI wrap only using DivineShell components
 * - NEW: Tier unlock detection + celebration on summon
 */
export default function GachaScreen() {
  // ----------------------------
  // EXISTING LOGIC (UNTOUCHED)
  // ----------------------------
  const { user, pullGacha, isLoading, userHeroes, refreshHeroesAfterGacha } = useGameStore();
  const [showResult, setShowResult] = useState(false);
  const [gachaResult, setGachaResult] = useState<any>(null);
  
  // ----------------------------
  // TIER UNLOCK TRACKING
  // ----------------------------
  const [maxTierBefore, setMaxTierBefore] = useState<DisplayTier>(1);
  const [newTierUnlocked, setNewTierUnlocked] = useState<DisplayTier | null>(null);

  // Compute current max unlocked tier from all heroes
  const currentMaxTier = useMemo(() => computeUserMaxUnlockedTier(userHeroes), [userHeroes]);

  const handlePull = async (pullType: 'single' | 'multi', currencyType: 'gems' | 'coins') => {
    if (!user) return;

    const cost = pullType === 'single' 
      ? (currencyType === 'gems' ? 100 : 1000)
      : (currencyType === 'gems' ? 900 : 9000);

    const currency = currencyType === 'gems' ? user.gems : user.coins;

    if (currency < cost) {
      Alert.alert('Insufficient Funds', `You need ${cost} ${currencyType} to pull`);
      return;
    }

    // Capture tier state BEFORE pull
    setMaxTierBefore(currentMaxTier);
    setNewTierUnlocked(null);

    try {
      const result = await pullGacha(pullType, currencyType);
      setGachaResult(result);
      
      // Refresh heroes to get updated tier info
      await fetchUserHeroes();
      
      setShowResult(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to pull gacha');
    }
  };

  // Check for new tier unlock when result shows
  useEffect(() => {
    if (showResult && gachaResult) {
      const newMax = computeUserMaxUnlockedTier(userHeroes);
      if (newMax > maxTierBefore) {
        setNewTierUnlocked(newMax);
      }
    }
  }, [showResult, gachaResult, userHeroes, maxTierBefore]);

  const closeResult = () => {
    setShowResult(false);
    setGachaResult(null);
    setNewTierUnlocked(null);
  };

  const goToHeroes = () => {
    closeResult();
    router.push('/heroes');
  };

  const handleBack = () => {
    router.back();
  };

  // ----------------------------
  // BACKGROUND (Summon Stage)
  // ----------------------------
  const SUMMON_STAGE_BG = useMemo(() => {
    return require('../assets/backgrounds/summon_stage_01.jpg');
  }, []);

  // ----------------------------
  // NO USER STATE
  // ----------------------------
  if (!user) {
    return (
      <View style={styles.root}>
        <CenteredBackground source={SUMMON_STAGE_BG} mode="contain" zoom={1.05} opacity={1} />
        <SummonAtmosphere />
        <DivineOverlays vignette rays grain />
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle" size={48} color="rgba(255, 215, 140, 0.9)" />
          <Text style={styles.noUserText}>Please login first</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 2Dlive Background: Summon Stage */}
      <CenteredBackground source={SUMMON_STAGE_BG} mode="contain" zoom={1.05} opacity={1} />

      {/* Summon screens can have a touch more drama than dashboard */}
      <SanctumAtmosphere />
      <DivineOverlays vignette rays grain />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>

        <View style={styles.topTitles}>
          <Text style={styles.title}>Divine Summon</Text>
          <Text style={styles.subtitle}>Call upon legendary heroes</Text>
        </View>

        <View style={styles.currencyMini}>
          <Text style={styles.currencyText}>💎 {user.gems.toLocaleString()}</Text>
          <Text style={styles.currencyText}>🪙 {user.coins.toLocaleString()}</Text>
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pity Counter */}
        <GlassCard>
          <Text style={styles.sectionTitle}>Omen</Text>
          <Text style={styles.sectionHint}>Each pull leaves a mark. The sanctum remembers.</Text>
          
          <View style={styles.pityContainer}>
            <View style={styles.pityHeader}>
              <Text style={styles.pityLabel}>Pity Counter</Text>
              <Text style={styles.pityValue}>{user.pity_counter} / 50</Text>
            </View>
            <View style={styles.pityBar}>
              <View style={[styles.pityFill, { width: `${(user.pity_counter / 50) * 100}%` }]} />
            </View>
            <Text style={styles.pityHint}>{50 - user.pity_counter} pulls until guaranteed SSR!</Text>
          </View>
        </GlassCard>

        <View style={{ height: 12 }} />

        {/* Premium Summon (Gems) */}
        <GlassCard>
          <Text style={styles.sectionTitle}>Premium Summon</Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillKey}>Currency</Text>
              <Text style={styles.pillVal}>💎 Gems</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillKey}>Rate</Text>
              <Text style={styles.pillVal}>UR+ Focus</Text>
            </View>
          </View>

          <View style={{ height: 12 }} />

          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => handlePull('single', 'gems')}
              disabled={isLoading}
            >
              <Ionicons name="diamond" size={20} color="#FF6B9D" />
              <Text style={styles.actionText}>Summon x1</Text>
              <Text style={styles.actionCost}>100 Gems</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtnPrimary} 
              onPress={() => handlePull('multi', 'gems')}
              disabled={isLoading}
            >
              <Ionicons name="diamond" size={20} color="#0A0B10" />
              <Text style={styles.actionTextPrimary}>Summon x10</Text>
              <Text style={styles.actionCostPrimary}>900 Gems</Text>
              <Text style={styles.discountBadge}>SAVE 100!</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <View style={{ height: 12 }} />

        {/* Standard Summon (Coins) */}
        <GlassCard>
          <Text style={styles.sectionTitle}>Standard Summon</Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillKey}>Currency</Text>
              <Text style={styles.pillVal}>🪙 Coins</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillKey}>Rate</Text>
              <Text style={styles.pillVal}>Standard</Text>
            </View>
          </View>

          <View style={{ height: 12 }} />

          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => handlePull('single', 'coins')}
              disabled={isLoading}
            >
              <Ionicons name="cash" size={20} color="#FFD700" />
              <Text style={styles.actionText}>Summon x1</Text>
              <Text style={styles.actionCost}>1,000 Coins</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtnPrimary} 
              onPress={() => handlePull('multi', 'coins')}
              disabled={isLoading}
            >
              <Ionicons name="cash" size={20} color="#0A0B10" />
              <Text style={styles.actionTextPrimary}>Summon x10</Text>
              <Text style={styles.actionCostPrimary}>9,000 Coins</Text>
              <Text style={styles.discountBadge}>SAVE 1K!</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <View style={{ height: 12 }} />

        {/* Drop Rates */}
        <GlassCard>
          <Text style={styles.sectionTitle}>Drop Rates</Text>
          <Text style={styles.sectionHint}>Pledge your pull to the covenant—mercy is not guaranteed.</Text>
          
          <View style={{ height: 10 }} />
          
          <View style={styles.ratesGrid}>
            <View style={styles.rateRow}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['SR'] }]} />
              <Text style={styles.rateText}>SR (Rare)</Text>
              <Text style={styles.ratePercent}>60%</Text>
            </View>
            <View style={styles.rateRow}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['SSR'] }]} />
              <Text style={styles.rateText}>SSR (Epic)</Text>
              <Text style={styles.ratePercent}>30%</Text>
            </View>
            <View style={styles.rateRow}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['UR'] }]} />
              <Text style={styles.rateText}>UR (Legendary)</Text>
              <Text style={styles.ratePercent}>9%</Text>
            </View>
            <View style={styles.rateRow}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['UR+'] }]} />
              <Text style={styles.rateText}>UR+ (God-like)</Text>
              <Text style={styles.ratePercent}>1%</Text>
            </View>
          </View>
        </GlassCard>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#FF6B9D" />
            <Text style={styles.loadingText}>Summoning...</Text>
          </View>
        </View>
      )}

      {/* Result Modal */}
      <Modal
        visible={showResult}
        transparent
        animationType="fade"
        onRequestClose={closeResult}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Summon Results!</Text>
              <Text style={styles.modalSubtitle}>Heroes have answered your call</Text>
            </View>
            
            {/* NEW TIER UNLOCKED BANNER */}
            {newTierUnlocked && (
              <View style={styles.tierUnlockBanner}>
                <Ionicons name="sparkles" size={20} color="#FFD700" />
                <View style={styles.tierUnlockText}>
                  <Text style={styles.tierUnlockTitle}>NEW TIER UNLOCKED!</Text>
                  <Text style={styles.tierUnlockSubtitle}>
                    You can now view {TIER_LABELS[newTierUnlocked]} ascension art
                  </Text>
                </View>
                <Ionicons name="sparkles" size={20} color="#FFD700" />
              </View>
            )}
            
            <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
              {gachaResult?.heroes.map((hero: any, index: number) => {
                // Show star count and shard info for each pulled hero
                const heroStars = displayStars(hero);
                const heroTier = unlockedTierForHero(hero);
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.heroResultCard,
                      { borderColor: RARITY_COLORS[hero.hero_data?.rarity || 'SR'] },
                    ]}
                  >
                    <Image
                      source={{ uri: hero.hero_data?.image_url }}
                      style={styles.heroResultImage}
                    />
                    <View style={styles.heroResultInfo}>
                      <Text style={styles.heroResultName}>{hero.hero_data?.name}</Text>
                      <Text
                        style={[
                          styles.heroResultRarity,
                          { color: RARITY_COLORS[hero.hero_data?.rarity || 'SR'] },
                        ]}
                      >
                        {hero.hero_data?.rarity}
                      </Text>
                      
                      {/* Tier indicator */}
                      <View style={styles.tierIndicator}>
                        <Text style={styles.tierIndicatorText}>
                          {labelForStars(heroStars)} · Tier {TIER_LABELS[heroTier]}
                        </Text>
                      </View>
                      
                      {hero.duplicates > 0 && (
                        <View style={styles.duplicateBadge}>
                          <Text style={styles.duplicateText}>+{hero.duplicates} Shard</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              {newTierUnlocked && (
                <TouchableOpacity style={styles.heroesButton} onPress={goToHeroes}>
                  <Ionicons name="people" size={18} color="#0A0B10" />
                  <Text style={styles.heroesButtonText}>View in Heroes</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.closeButton} onPress={closeResult}>
                <Text style={styles.closeButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060A' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noUserText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700' },
  loginBtn: { 
    backgroundColor: 'rgba(255, 215, 140, 0.92)', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 14,
    marginTop: 8,
  },
  loginBtnText: { color: '#0A0B10', fontSize: 14, fontWeight: '900' },

  // Top Bar
  topBar: {
    paddingTop: Platform.select({ ios: 54, android: 34, default: 34 }),
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  backBtnText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 24,
    fontWeight: '900',
    marginTop: -2,
  },

  topTitles: { flex: 1 },
  title: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12.5,
    fontWeight: '700',
  },

  currencyMini: {
    alignItems: 'flex-end',
    gap: 4,
  },
  currencyText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12.5,
    fontWeight: '800',
  },

  // Content
  scrollArea: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  sectionTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sectionHint: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12.5,
    lineHeight: 18,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillKey: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pillVal: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 12.5,
    fontWeight: '900',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  actionBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
  },
  actionText: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  actionCost: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '800',
  },
  actionTextPrimary: {
    color: '#0A0B10',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  actionCostPrimary: {
    marginTop: 4,
    color: 'rgba(10,11,16,0.75)',
    fontSize: 11,
    fontWeight: '900',
  },
  discountBadge: {
    marginTop: 4,
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '900',
  },

  // Pity
  pityContainer: { marginTop: 12 },
  pityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pityLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  pityValue: { color: 'rgba(255, 215, 140, 0.95)', fontSize: 16, fontWeight: '900' },
  pityBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  pityFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 215, 140, 0.95)',
    borderRadius: 4,
  },
  pityHint: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
  },

  // Rates
  ratesGrid: { gap: 8 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  rarityDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  rateText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12.5,
    fontWeight: '700',
  },
  ratePercent: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    fontWeight: '900',
  },

  // Loading
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: 'rgba(10, 12, 18, 0.95)',
    borderRadius: 22,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.3)',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'rgba(10, 12, 18, 0.98)',
    borderRadius: 22,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 140, 0.4)',
  },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(255, 215, 140, 0.95)',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontWeight: '600',
  },
  resultScroll: {
    maxHeight: 380,
  },
  heroResultCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
  },
  heroResultImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroResultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  heroResultName: {
    fontSize: 15,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.2,
  },
  heroResultRarity: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  duplicateBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  duplicateText: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: '800',
  },
  
  // Tier Indicator (in result card)
  tierIndicator: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  tierIndicatorText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '800',
  },
  
  // Tier Unlock Banner
  tierUnlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  tierUnlockText: {
    alignItems: 'center',
    flex: 1,
  },
  tierUnlockTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 0.8,
  },
  tierUnlockSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 215, 0, 0.8)',
    fontWeight: '700',
    marginTop: 2,
  },
  
  // Modal Actions
  modalActions: {
    marginTop: 16,
    gap: 10,
  },
  heroesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  heroesButtonText: {
    color: '#0A0B10',
    fontSize: 14,
    fontWeight: '900',
  },
  
  closeButton: {
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#0A0B10',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
