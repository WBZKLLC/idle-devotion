import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { router, useLocalSearchParams } from 'expo-router';
import HeroCinematicModal from '../components/HeroCinematicModal';
import { getHeroCinematicVideo, heroNameToId, VIDEOS_AVAILABLE } from '../constants/heroCinematics';

// Feature flags (SINGLE SOURCE OF TRUTH)
import { isFeatureEnabled } from '../lib/features';

// Centralized tier logic (SINGLE SOURCE OF TRUTH)
import {
  DisplayTier,
  displayStars,
  unlockedTierForHero,
  effectiveTierForHero,
  resolveTierArt,
  TIER_LABELS,
  tierLabel,
} from '../lib/progression';

// Shared animated TierSelector component
import TierSelector from '../components/TierSelector';

// ✅ Shared 2Dlive shell (UI-only)
import {
  CenteredBackground,
  DivineOverlays,
  SanctumAtmosphere,
  GlassCard,
} from '../components/DivineShell';

const RARITY_COLORS: { [key: string]: string } = {
  'N': '#9e9e9e',
  'R': '#4caf50',
  'SR': '#2196f3',
  'SSR': '#9c27b0',
  'UR': '#ff9800',
  'UR+': '#f44336',
};

const CLASS_ICONS: { [key: string]: string } = {
  'Warrior': 'shield',
  'Mage': 'flame',
  'Archer': 'locate',
};

// Helper to convert tier art URL to Image source
function tierArtToSource(heroData: any, tier: DisplayTier) {
  const url = resolveTierArt(heroData, tier);
  if (url) return { uri: url };
  return require('../assets/backgrounds/sanctum_environment_01.jpg');
}

// Clamp tier param to valid range
function clampTier(n: any): DisplayTier {
  const t = Number(n);
  if (!Number.isFinite(t)) return 1;
  const v = Math.max(1, Math.min(6, Math.floor(t)));
  return v as DisplayTier;
}

export default function HeroDetailScreen() {
  const { id, tier } = useLocalSearchParams<{ id: string; tier?: string }>();
  // Single-hero ensure: selector first, then store's getUserHeroById (no full-list fetch)
  const { user, selectUserHeroById, getUserHeroById } = useGameStore();
  const hydrated = useHydration();
  const { width: screenW } = useWindowDimensions();
  
  const [hero, setHero] = useState<any>(null);
  const [heroData, setHeroData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'skills' | 'equip'>('stats');
  
  // 5+ Star Cinematic Modal State
  const [showCinematicModal, setShowCinematicModal] = useState(false);
  const [cinematicVideoSource, setCinematicVideoSource] = useState<any>(null);

  // Tier selection (DEFAULT = 1-star art)
  const [selectedTier, setSelectedTier] = useState<DisplayTier>(1);

  // Selected tier art URL (string, not {uri: ...} object)
  const tierArtUrl = useMemo(() => resolveTierArt(heroData, selectedTier), [heroData, selectedTier]);
  
  // Image source for tier art (properly wrapped)
  const tierArtSource = useMemo(() => {
    if (tierArtUrl) return { uri: tierArtUrl };
    return require('../assets/backgrounds/sanctum_environment_01.jpg');
  }, [tierArtUrl]);

  // Check if hero is at 5+ star (final ascension)
  const isFivePlusStar = useCallback(() => {
    if (!hero) return false;
    return unlockedTierForHero(hero) === 6;
  }, [hero]);

  // Check if hero is UR or UR+ (for preview button visibility)
  const isHighRarity = useCallback(() => {
    if (!heroData) return false;
    return heroData.rarity === 'UR' || heroData.rarity === 'UR+';
  }, [heroData]);

  // Handle tap on hero portrait for 5+ cinematic
  const handlePortraitTap = useCallback(() => {
    if (!heroData) return;
    
    if (!isFivePlusStar()) {
      return;
    }
    
    // Feature flag gate
    const cinematicsEnabled = isFeatureEnabled('HERO_CINEMATICS', { 
      stableId: user?.id ?? user?.username 
    });
    if (!cinematicsEnabled) {
      Alert.alert('Coming Soon', 'Hero cinematics are not yet available.');
      return;
    }
    
    const heroId = heroNameToId(heroData.name);
    const videoSource = getHeroCinematicVideo(heroId);
    
    if (videoSource) {
      setCinematicVideoSource(videoSource);
      setShowCinematicModal(true);
    } else {
      if (__DEV__) {
        console.log(`[HeroDetail] No cinematic video for ${heroId} at 5+ star`);
      }
    }
  }, [heroData, isFivePlusStar, user?.id, user?.username]);

  // Handle preview button tap (for UR/UR+ heroes not yet at 5+)
  const handlePreview5PlusCinematic = useCallback(() => {
    if (!heroData) return;
    
    // Feature flag gate
    const cinematicsEnabled = isFeatureEnabled('HERO_CINEMATICS', { 
      stableId: user?.id ?? user?.username 
    });
    if (!cinematicsEnabled) {
      Alert.alert('Coming Soon', 'Hero cinematics are not yet available.');
      return;
    }
    
    const heroId = heroNameToId(heroData.name);
    const videoSource = getHeroCinematicVideo(heroId);
    
    if (videoSource) {
      setCinematicVideoSource(videoSource);
      setShowCinematicModal(true);
    } else {
      if (__DEV__) {
        console.log(`[HeroDetail] Preview: No cinematic video available for ${heroId}`);
      }
    }
  }, [heroData, user?.id, user?.username]);

  // Close cinematic modal
  const handleCloseCinematic = useCallback(() => {
    setShowCinematicModal(false);
    setCinematicVideoSource(null);
  }, []);

  // Compute unlocked tier from hero stars/awakening (MUST be before early returns)
  // Use hero?.id in deps to avoid reference changes causing hooks mismatch
  const unlockedTier = useMemo(() => unlockedTierForHero(hero), [hero?.id, hero?.stars, hero?.awakening_level]);

  // Enforce tier gating reactively - if hero data changes, clamp selectedTier
  useEffect(() => {
    if (!hero) return;
    if (selectedTier > unlockedTier) setSelectedTier(unlockedTier);
  }, [unlockedTier, selectedTier]);

  const applyHero = useCallback(
    (userHero: any) => {
      setHero(userHero);
      setHeroData(userHero.hero_data);

      // Respect tier param from heroes.tsx, but never exceed this hero's unlocked tier
      const requestedTier = clampTier(tier ?? 1);
      const unlocked = unlockedTierForHero(userHero);
      const effective: DisplayTier = (requestedTier <= unlocked ? requestedTier : unlocked);
      setSelectedTier(effective);
    },
    [tier]
  );

  useEffect(() => {
    if (!hydrated || !user || !id) return;

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);

        // 1) Cache-first
        const cached = selectUserHeroById(id);
        if (cached) {
          if (!cancelled) applyHero(cached);
          return;
        }

        // 2) Single-hero ensure (store handles caching + API fallback)
        const fresh = await getUserHeroById(String(id));
        if (!cancelled) applyHero(fresh);
      } catch (error) {
        console.error('Failed to load hero:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, user, id, selectUserHeroById, getUserHeroById, applyHero]);

  const getRarityGradient = (rarity: string): [string, string] => {
    const color = RARITY_COLORS[rarity] || RARITY_COLORS['N'];
    return [color, `${color}88`];
  };

  // Loading state with 2Dlive shell
  if (!hydrated || isLoading) {
    return (
      <View style={styles.container}>
        <CenteredBackground 
          source={require('../assets/backgrounds/sanctum_environment_01.jpg')} 
          mode="contain" 
          zoom={1.04} 
        />
        <SanctumAtmosphere />
        <DivineOverlays vignette grain />
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </View>
    );
  }

  // Error state with 2Dlive shell
  if (!hero || !heroData) {
    return (
      <View style={styles.container}>
        <CenteredBackground 
          source={require('../assets/backgrounds/sanctum_environment_01.jpg')} 
          mode="contain" 
          zoom={1.04} 
        />
        <SanctumAtmosphere />
        <DivineOverlays vignette grain />
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.gold.primary} />
          <Text style={styles.errorText}>Hero not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const rarityColor = RARITY_COLORS[heroData.rarity] || RARITY_COLORS['N'];

  return (
    <View style={styles.container}>
      {/* 2Dlive Background: Tier-based Art centered */}
      <CenteredBackground 
        source={tierArtSource} 
        mode="contain" 
        zoom={1.06} 
        opacity={1}
        waitForSize={false}
      />
      
      {/* Atmosphere + Overlays */}
      <SanctumAtmosphere />
      <DivineOverlays vignette grain />

      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{heroData.name}</Text>
            <Text style={styles.rarityLabel}>{heroData.rarity} • {heroData.hero_class} • Idle Devotion</Text>
          </View>
          <View style={[styles.rarityBadgeHeader, { backgroundColor: rarityColor }]}>
            <Text style={styles.rarityBadgeText}>{heroData.rarity}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Portrait - Tappable for 5+ Star Cinematic */}
          <TouchableOpacity 
            style={styles.portraitContainer}
            onPress={handlePortraitTap}
            activeOpacity={isFivePlusStar() ? 0.8 : 1}
          >
            <GlassCard style={styles.portraitCard}>
              <LinearGradient
                colors={getRarityGradient(heroData.rarity)}
                style={styles.portraitGradient}
              >
                {/* Static glow overlay */}
                <View 
                  style={[
                    styles.glowOverlay,
                    { 
                      opacity: 0.3,
                      backgroundColor: rarityColor 
                    }
                  ]} 
                />
                
                {/* Hero image - Uses selected tier art */}
                <View style={styles.heroImageContainer}>
                  {tierArtUrl ? (
                    <Image
                      source={tierArtSource}
                      style={{ width: 180, height: 250 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Image
                        source={require('../assets/images/icon.png')}
                        style={{ width: 100, height: 100 }}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                </View>
                
                {/* 5+ Star Indicator */}
                {isFivePlusStar() && (
                  <View style={styles.fivePlusIndicator}>
                    <Ionicons name="play-circle" size={18} color={COLORS.cream.pure} />
                    <Text style={styles.fivePlusIndicatorText}>Tap for Cinematic</Text>
                  </View>
                )}
                
                {/* Star Level - shows 0 stars as 0 (no forced "1 star") */}
                <View style={styles.starsContainer}>
                  {displayStars(hero) > 0 &&
                    Array.from({ length: displayStars(hero) }).map((_, i) => (
                      <Ionicons key={i} name="star" size={14} color={COLORS.gold.primary} />
                    ))}
                  {unlockedTier === 6 && (
                    <Text style={styles.plusMark}>+</Text>
                  )}
                </View>
              </LinearGradient>
            </GlassCard>
          </TouchableOpacity>

          {/* Tier Selector (animated, gated per-hero) */}
          {hero && heroData && (
            <GlassCard style={{ marginBottom: 16 }}>
              <TierSelector
                value={selectedTier}
                maxUnlocked={unlockedTier}
                onChange={setSelectedTier}
                hint={false}
                compact
              />
              <Text style={styles.tierHint}>
                Unlocked: {tierLabel(unlockedTier)} • Stars: {displayStars(hero)} • Awakening: {hero?.awakening_level ?? 0}
              </Text>
            </GlassCard>
          )}

          {/* Level & XP - Glass Card */}
          <GlassCard style={styles.levelCardWrapper}>
            <View style={styles.levelCard}>
              <View style={styles.levelInfo}>
                <Text style={styles.levelLabel}>Level</Text>
                <Text style={styles.levelValue}>{hero.level || 1}</Text>
              </View>
              <View style={styles.xpBar}>
                <View style={[styles.xpFill, { width: `${((hero.level || 1) % 10) * 10}%` }]} />
              </View>
              <View style={styles.levelInfo}>
                <Text style={styles.levelLabel}>Rank</Text>
                <Text style={styles.levelValue}>{hero.rank || 1}</Text>
              </View>
            </View>
          </GlassCard>

          {/* Tab Navigation */}
          <View style={styles.tabBar}>
            {(['stats', 'skills', 'equip'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Ionicons 
                  name={tab === 'stats' ? 'stats-chart' : tab === 'skills' ? 'flash' : 'shield'} 
                  size={16} 
                  color={activeTab === tab ? COLORS.navy.darkest : COLORS.cream.soft} 
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content - Stats */}
          {activeTab === 'stats' && (
            <GlassCard>
              <Text style={styles.sectionTitle}>Combat Stats</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statRow}>
                  <Ionicons name="heart" size={18} color="#e74c3c" />
                  <Text style={styles.statLabel}>HP</Text>
                  <Text style={styles.statValue}>{hero.current_hp?.toLocaleString() || heroData.base_hp}</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="flash" size={18} color="#f39c12" />
                  <Text style={styles.statLabel}>ATK</Text>
                  <Text style={styles.statValue}>{hero.current_atk?.toLocaleString() || heroData.base_atk}</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="shield" size={18} color="#3498db" />
                  <Text style={styles.statLabel}>DEF</Text>
                  <Text style={styles.statValue}>{hero.current_def?.toLocaleString() || heroData.base_def}</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="speedometer" size={18} color="#9b59b6" />
                  <Text style={styles.statLabel}>SPD</Text>
                  <Text style={styles.statValue}>{heroData.base_speed || 100}</Text>
                </View>
              </View>
              <View style={styles.elementRow}>
                <Text style={styles.elementLabel}>Element</Text>
                <Text style={styles.elementValue}>{heroData.element}</Text>
              </View>
            </GlassCard>
          )}

          {/* Tab Content - Skills */}
          {activeTab === 'skills' && (
            <GlassCard>
              <Text style={styles.sectionTitle}>Divine Arts</Text>
              {(heroData.skills && heroData.skills.length > 0) ? heroData.skills.map((skill: any, idx: number) => (
                <View key={idx} style={styles.skillPill}>
                  <View style={styles.skillHeader}>
                    <Ionicons 
                      name={skill.skill_type === 'passive' ? 'sparkles' : 'flash'} 
                      size={16} 
                      color={skill.skill_type === 'passive' ? '#9b59b6' : COLORS.gold.primary} 
                    />
                    <Text style={styles.skillName}>{skill.name}</Text>
                    <View style={[styles.skillTypeBadge, skill.skill_type === 'passive' && styles.skillTypeBadgePassive]}>
                      <Text style={styles.skillTypeText}>{skill.skill_type?.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.skillDesc}>{skill.description}</Text>
                  {skill.damage_multiplier && skill.damage_multiplier > 0 && (
                    <Text style={styles.skillStat}>DMG: {(skill.damage_multiplier * 100).toFixed(0)}%</Text>
                  )}
                </View>
              )) : (
                <View style={styles.noSkillsContainer}>
                  <Ionicons name="flash-off" size={24} color={COLORS.navy.light} />
                  <Text style={styles.noSkillsText}>No skills data available</Text>
                </View>
              )}
            </GlassCard>
          )}

          {/* Tab Content - Equipment */}
          {activeTab === 'equip' && (
            <GlassCard>
              <Text style={styles.sectionTitle}>Equipment</Text>
              <View style={styles.equipGrid}>
                {['Weapon', 'Armor', 'Helmet', 'Boots', 'Ring', 'Amulet'].map((slot, idx) => (
                  <TouchableOpacity key={idx} style={styles.equipSlot}>
                    <Ionicons 
                      name={
                        slot === 'Weapon' ? 'hammer' :
                        slot === 'Armor' ? 'shirt' :
                        slot === 'Helmet' ? 'disc' :
                        slot === 'Boots' ? 'walk' :
                        slot === 'Ring' ? 'ellipse' : 'diamond'
                      } 
                      size={24} 
                      color={COLORS.cream.dark} 
                    />
                    <Text style={styles.equipSlotName}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>
          )}

          {/* Biography */}
          <GlassCard style={styles.descriptionCard}>
            <Text style={styles.sectionTitle}>Biography</Text>
            <Text style={styles.descriptionText}>
              {heroData.description || `A powerful ${heroData.hero_class} with the element of ${heroData.element}.`}
            </Text>
          </GlassCard>

          {/* Actions */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.upgradeButton}
              onPress={() => router.push(`/hero-upgrade?id=${id}`)}
            >
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.upgradeGradient}
              >
                <Ionicons name="arrow-up" size={18} color={COLORS.navy.darkest} />
                <Text style={styles.upgradeText}>Level Up</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.promoteButton}
              // id is UserHero.id (instance primary key) - correct for promote-star endpoint
              onPress={() => router.push(`/hero-progression?heroId=${id}`)}
            >
              <Ionicons name="star" size={18} color={COLORS.gold.primary} />
              <Text style={styles.promoteText}>Stars</Text>
            </TouchableOpacity>
          </View>

          {/* Preview 5+ Cinematic Button */}
          {isHighRarity() && !isFivePlusStar() && VIDEOS_AVAILABLE && (
            <TouchableOpacity 
              style={styles.preview5PlusButton}
              onPress={handlePreview5PlusCinematic}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#9c27b0', '#7b1fa2']}
                style={styles.preview5PlusGradient}
              >
                <Ionicons name="play-circle" size={18} color={COLORS.cream.pure} />
                <Text style={styles.preview5PlusText}>Preview 5+ Cinematic</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* 5+ Star Cinematic Modal */}
        <HeroCinematicModal
          visible={showCinematicModal}
          onClose={handleCloseCinematic}
          videoSource={cinematicVideoSource}
          heroName={heroData?.name || 'Hero'}
          heroKey={heroData ? heroNameToId(heroData.name) : 'unknown'}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060A' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingTop: Platform.select({ ios: 8, android: 8, default: 8 }),
    paddingBottom: 12,
    gap: 12,
  },
  backButton: { 
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleWrap: { flex: 1 },
  title: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.2,
  },
  rarityLabel: {
    fontSize: 12,
    color: 'rgba(255, 215, 140, 0.90)',
    fontWeight: '700',
    marginTop: 2,
  },
  rarityBadgeHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rarityBadgeText: { fontSize: 12, fontWeight: '900', color: COLORS.cream.pure },
  
  content: { padding: 16, paddingTop: 0, paddingBottom: 100 },
  
  // Portrait
  portraitContainer: { alignItems: 'center', marginBottom: 16 },
  portraitCard: { padding: 0 },
  portraitGradient: { 
    borderRadius: 20, 
    padding: 16, 
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowOverlay: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    borderRadius: 100,
  },
  heroImageContainer: { 
    width: 180, 
    height: 250, 
    alignItems: 'center', 
    justifyContent: 'center',
    zIndex: 1,
  },
  placeholderImage: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
  },
  starsContainer: { 
    flexDirection: 'row', 
    marginTop: 8,
    zIndex: 1,
    gap: 2,
    alignItems: 'center',
  },
  
  // Tier Selector
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tierChip: {
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tierChipActive: {
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
    borderColor: 'rgba(255, 215, 140, 0.92)',
  },
  tierChipLocked: {
    opacity: 0.55,
  },
  tierChipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '900',
  },
  tierChipTextActive: {
    color: '#0A0B10',
  },
  tierChipTextLocked: {
    color: 'rgba(255,255,255,0.62)',
  },
  tierHint: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11.5,
    fontWeight: '700',
  },
  plusMark: {
    marginLeft: 4,
    color: 'rgba(255, 215, 140, 0.95)',
    fontWeight: '900',
    fontSize: 14,
  },
  
  // Level Card
  levelCardWrapper: { marginBottom: 16 },
  levelCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
  },
  levelInfo: { alignItems: 'center', width: 60 },
  levelLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  levelValue: { fontSize: 22, fontWeight: '900', color: 'rgba(255, 215, 140, 0.95)' },
  xpBar: { 
    flex: 1, 
    height: 6, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 3, 
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', backgroundColor: COLORS.gold.primary, borderRadius: 3 },
  
  // Tabs
  tabBar: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.06)', 
    borderRadius: 14, 
    padding: 4, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: 10, 
    gap: 6 
  },
  tabActive: { backgroundColor: 'rgba(255, 215, 140, 0.92)' },
  tabText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: '#0A0B10' },
  
  // Stats
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  statsGrid: { gap: 8 },
  statRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: { 
    flex: 1, 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.7)', 
    marginLeft: 10,
    fontWeight: '600',
  },
  statValue: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: 'rgba(255,255,255,0.92)',
  },
  elementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 4,
  },
  elementLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  elementValue: { fontSize: 13, color: 'rgba(255, 215, 140, 0.95)', fontWeight: '800' },
  
  // Skills
  skillPill: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  skillHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  skillName: { flex: 1, fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.92)' },
  skillTypeBadge: { 
    backgroundColor: 'rgba(255, 215, 140, 0.25)', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6 
  },
  skillTypeBadgePassive: { backgroundColor: 'rgba(155, 89, 182, 0.25)' },
  skillTypeText: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  skillDesc: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  skillStat: { fontSize: 11, color: 'rgba(255, 215, 140, 0.9)', fontWeight: '700', marginTop: 6 },
  noSkillsContainer: { alignItems: 'center', paddingVertical: 20 },
  noSkillsText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  
  // Equipment
  equipGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10,
  },
  equipSlot: { 
    width: '30%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  equipSlotName: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  
  // Description
  descriptionCard: { marginTop: 16, marginBottom: 16 },
  descriptionText: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
  
  // Actions
  actionButtons: { flexDirection: 'row', gap: 12 },
  upgradeButton: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  upgradeGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 14, 
    gap: 8 
  },
  upgradeText: { fontSize: 14, fontWeight: '900', color: COLORS.navy.darkest },
  promoteButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, 
    paddingVertical: 14, 
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.4)',
  },
  promoteText: { fontSize: 13, fontWeight: '800', color: 'rgba(255, 215, 140, 0.95)' },
  
  // 5+ Star Indicators
  fivePlusIndicator: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginHorizontal: 20,
    gap: 6,
  },
  fivePlusIndicatorText: {
    color: COLORS.cream.pure,
    fontSize: 11,
    fontWeight: '700',
  },
  preview5PlusButton: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  preview5PlusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  preview5PlusText: {
    color: COLORS.cream.pure,
    fontWeight: '800',
    fontSize: 13,
  },
  
  // Error
  errorText: { color: COLORS.cream.pure, fontSize: 18, fontWeight: '700' },
  backBtn: { 
    backgroundColor: 'rgba(255, 215, 140, 0.92)', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 16,
    marginTop: 8,
  },
  backBtnText: { color: '#0A0B10', fontSize: 14, fontWeight: '900' },
});
