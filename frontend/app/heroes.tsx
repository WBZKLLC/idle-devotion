import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../theme/colors';

// Centralized tier logic (SINGLE SOURCE OF TRUTH)
import {
  DisplayTier,
  displayStars,
  unlockedTierForHero,
  effectiveTierForHero,
  resolveTierArt,
  computeUserMaxUnlockedTier,
  TIER_LABELS,
} from '../lib/tier';

// 2Dlive shell (UI-only)
import {
  CenteredBackground,
  DivineOverlays,
  SanctumAtmosphere,
  GlassCard,
} from '../components/DivineShell';

// Sanctum background (matches your existing setup)
const SANCTUM_BG = require('../assets/backgrounds/sanctum_environment_01.jpg');

// Helper to convert tier art to Image source
function tierArtToSource(heroData: any, tier: DisplayTier) {
  const url = resolveTierArt(heroData, tier);
  if (url) return { uri: url };
  return null;
}

export default function HeroesScreen() {
  const router = useRouter();
  const { user, userHeroes, fetchUserHeroes, isLoading } = useGameStore();
  const hydrated = useHydration();

  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'level' | 'rarity' | 'power'>('rarity');

  // Global display tier (what art tier we *prefer* to show)
  // UI-side default is 1★ (this does NOT change backend grant tier)
  const [displayTier, setDisplayTier] = useState<DisplayTier>(1);

  useEffect(() => {
    if (hydrated && user) fetchUserHeroes();
  }, [hydrated, user?.username]);

  const getRarityColor = (rarity: string) => {
    return COLORS.rarity[rarity as keyof typeof COLORS.rarity] || COLORS.cream.dark;
  };

  const getRarityOrder = (rarity: string) => {
    const order = { N: 0, R: 1, SR: 2, SSR: 3, 'SSR+': 4, UR: 5, 'UR+': 6 };
    return order[rarity as keyof typeof order] || 0;
  };

  const getClassIcon = (heroClass: string) => {
    switch (heroClass) {
      case 'Warrior': return 'shield';
      case 'Mage': return 'flame';
      case 'Archer': return 'locate';
      default: return 'person';
    }
  };

  // UI display stars: show EXACT backend value (0..6)
  const displayStars = (hero: any) => {
    const s = Number(hero?.stars ?? 0);
    if (!isFinite(s)) return 0;
    return Math.max(0, Math.min(6, s));
  };

  // Tier unlock mapping (UI-only):
  // - Tier 1 is ALWAYS available (even if stars=0)
  // - stars=0 -> unlock tier 1
  // - stars=1 -> unlock tier 2
  // - stars=2 -> unlock tier 3
  // - stars=3 -> unlock tier 4
  // - stars=4 -> unlock tier 5
  // - stars>=5 OR awakening>0 -> unlock tier 6 (5★+)
  const unlockedTierForHero = (hero: any): DisplayTier => {
    const stars = displayStars(hero);
    const awaken = Number(hero?.awakening_level ?? 0);

    if (awaken > 0 || stars >= 5) return 6;

    // Map 0..4 stars -> tier 1..5
    const tier = (stars + 1) as DisplayTier;
    return (Math.max(1, Math.min(5, tier)) as DisplayTier);
  };

  // How far the user can set the GLOBAL display tier
  // (Must not allow them to select tiers they haven't unlocked on ANY hero)
  // If you'd rather make this per-hero only, tell me — but global is clean UX.
  const userMaxUnlockedTier: DisplayTier = useMemo(() => {
    if (!userHeroes || userHeroes.length === 0) return 1;
    let max: DisplayTier = 1;
    for (const h of userHeroes) {
      const t = unlockedTierForHero(h);
      if (t > max) max = t;
    }
    return max;
  }, [userHeroes]);

  // Clamp display tier if user loses access (edge case)
  useEffect(() => {
    if (displayTier > userMaxUnlockedTier) setDisplayTier(userMaxUnlockedTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMaxUnlockedTier]);

  const calculatePower = (hero: any) => {
    const heroData = hero.hero_data;
    if (!heroData) return 0;

    const levelMult = 1 + (hero.level - 1) * 0.05;

    const starMult = 1 + displayStars(hero) * 0.1; // stars=0 => no bonus

    const awakenMult = 1 + (hero.awakening_level || 0) * 0.2;

    return Math.floor(
      (heroData.base_hp + heroData.base_atk * 3 + heroData.base_def * 2) *
        levelMult *
        starMult *
        awakenMult
    );
  };

  const filteredAndSortedHeroes = userHeroes
    .filter((hero: any) => {
      if (filterRarity && hero.hero_data?.rarity !== filterRarity) return false;
      if (filterClass && hero.hero_data?.hero_class !== filterClass) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'level') return b.level - a.level;
      if (sortBy === 'power') return calculatePower(b) - calculatePower(a);
      if (sortBy === 'rarity') {
        const rarityDiff = getRarityOrder(b.hero_data?.rarity) - getRarityOrder(a.hero_data?.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        return b.level - a.level;
      }
      return 0;
    });

  const RARITIES = ['SR', 'SSR', 'SSR+', 'UR', 'UR+'];
  const CLASSES = ['Warrior', 'Mage', 'Archer'];

  // Display tier buttons
  const TIER_LABELS: { tier: DisplayTier; label: string }[] = [
    { tier: 1, label: '1★' },
    { tier: 2, label: '2★' },
    { tier: 3, label: '3★' },
    { tier: 4, label: '4★' },
    { tier: 5, label: '5★' },
    { tier: 6, label: '5★+' },
  ];

  if (!user) {
    return (
      <View style={styles.root}>
        <CenteredBackground source={SANCTUM_BG} mode="contain" zoom={1.03} opacity={1} />
        <SanctumAtmosphere />
        <DivineOverlays vignette rays={false} grain />

        <SafeAreaView style={styles.centerContainer}>
          <GlassCard style={{ width: '100%', maxWidth: 420 }}>
            <Text style={styles.errorTitle}>Please log in first</Text>
            <Text style={styles.errorSub}>The Sanctum only opens to the sworn.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push('/')}>
              <Text style={styles.primaryBtnText}>Go to Login</Text>
            </Pressable>
          </GlassCard>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CenteredBackground source={SANCTUM_BG} mode="contain" zoom={1.03} opacity={1} />
      <SanctumAtmosphere />
      <DivineOverlays vignette rays={false} grain />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Idle Devotion</Text>
            <Text style={styles.subtitle}>A Soul Bound Fantasy • {userHeroes.length} Heroes</Text>
          </View>

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
        </View>

        {/* Display Tier Selector (gated by unlock) */}
        <View style={styles.tierRowWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierRow}>
            <Text style={styles.tierLabel}>Display Tier</Text>

            {TIER_LABELS.map(({ tier, label }) => {
              const locked = tier > userMaxUnlockedTier;
              const active = displayTier === tier;

              return (
                <Pressable
                  key={tier}
                  onPress={() => !locked && setDisplayTier(tier)}
                  style={[
                    styles.tierChip,
                    active && styles.tierChipActive,
                    locked && styles.tierChipLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.tierChipText,
                      active && styles.tierChipTextActive,
                      locked && styles.tierChipTextLocked,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.tierHint}>
            Unlocked up to: {TIER_LABELS.find(t => t.tier === userMaxUnlockedTier)?.label}
          </Text>
        </View>

        {/* Filter Bar */}
        <View style={styles.blockPad}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              style={[styles.filterChip, !filterRarity && styles.filterChipActive]}
              onPress={() => setFilterRarity(null)}
            >
              <Text style={[styles.filterText, !filterRarity && styles.filterTextActive]}>All</Text>
            </Pressable>

            {RARITIES.map(rarity => (
              <Pressable
                key={rarity}
                style={[
                  styles.filterChip,
                  filterRarity === rarity && styles.filterChipActive,
                  { borderColor: getRarityColor(rarity) },
                ]}
                onPress={() => setFilterRarity(filterRarity === rarity ? null : rarity)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filterRarity === rarity && styles.filterTextActive,
                    { color: filterRarity === rarity ? '#0A0B10' : getRarityColor(rarity) },
                  ]}
                >
                  {rarity}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Class Filter */}
        <View style={styles.blockPad}>
          <View style={styles.classRow}>
            {CLASSES.map(cls => {
              const active = filterClass === cls;
              return (
                <Pressable
                  key={cls}
                  style={[styles.classChip, active && styles.classChipActive]}
                  onPress={() => setFilterClass(active ? null : cls)}
                >
                  <Ionicons
                    name={getClassIcon(cls) as any}
                    size={16}
                    color={active ? '#0A0B10' : 'rgba(255, 215, 140, 0.9)'}
                  />
                  <Text style={[styles.classText, active && styles.classTextActive]}>{cls}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sort Options */}
        <View style={styles.blockPad}>
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort</Text>
            {(['rarity', 'level', 'power'] as const).map(option => {
              const active = sortBy === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                  onPress={() => setSortBy(option)}
                >
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Grid */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="rgba(255, 215, 140, 0.92)" />
            <Text style={styles.loadingText}>Loading heroes...</Text>
          </View>
        ) : (
          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContent}>
            <View style={styles.grid}>
              {filteredAndSortedHeroes.map((hero: any) => {
                const heroData = hero.hero_data;
                const power = calculatePower(hero);

                const unlockedTier = unlockedTierForHero(hero);
                const effectiveTier: DisplayTier = (displayTier <= unlockedTier ? displayTier : unlockedTier);

                const tierSource = resolveTierArt(heroData, effectiveTier);

                return (
                  <Pressable
                    key={hero.id}
                    style={styles.heroCardOuter}
                    onPress={() => {
                      router.push(`/hero-detail?id=${hero.id}&tier=${effectiveTier}`);
                    }}
                  >
                    <View style={styles.heroCardInner}>
                      {/* Premium rarity wash */}
                      <View style={[styles.heroCardWash, { borderColor: getRarityColor(heroData?.rarity) }]} />

                      {tierSource ? (
                        <Image source={tierSource} style={styles.heroImage} />
                      ) : (
                        <View style={styles.heroImageFallback} />
                      )}

                      {/* Rarity */}
                      <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(heroData?.rarity) }]}>
                        <Text style={styles.rarityText}>{heroData?.rarity}</Text>
                      </View>

                      {/* Class */}
                      <View style={styles.classIcon}>
                        <Ionicons
                          name={getClassIcon(heroData?.hero_class) as any}
                          size={14}
                          color="rgba(255, 215, 140, 0.92)"
                        />
                      </View>

                      {/* Tier display (shows what tier is being displayed, and whether limited) */}
                      <View style={styles.tierBadge}>
                        <Text style={styles.tierBadgeText}>
                          {effectiveTier === 6 ? '5★+' : `${effectiveTier}★`}
                          {effectiveTier < displayTier ? ' (LOCKED)' : ''}
                        </Text>
                      </View>

                      {/* Stars (0 stars = no stars shown) */}
                      <View style={styles.starsContainer}>
                        {displayStars(hero) > 0 &&
                          Array.from({ length: Math.min(5, displayStars(hero)) }).map((_, i) => (
                            <Ionicons key={i} name="star" size={10} color="rgba(255, 215, 140, 0.92)" />
                          ))}

                        {unlockedTier === 6 && <Text style={styles.plusMark}>+</Text>}
                      </View>

                      {/* Awakening */}
                      {(hero.awakening_level || 0) > 0 && (
                        <View style={styles.awakenBadge}>
                          <Text style={styles.awakenText}>⚡{hero.awakening_level}</Text>
                        </View>
                      )}

                      <View style={styles.heroInfo}>
                        <Text style={[styles.heroName, { color: getRarityColor(heroData?.rarity) }]} numberOfLines={1}>
                          {heroData?.name?.split(' ')[0]}
                        </Text>
                        <View style={styles.heroStats}>
                          <Text style={styles.levelText}>Lv.{hero.level}</Text>
                          <Text style={styles.powerText}>{power.toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {filteredAndSortedHeroes.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={48} color="rgba(255,255,255,0.25)" />
                <Text style={styles.emptyText}>No heroes match your filters</Text>
                <Pressable onPress={() => { setFilterRarity(null); setFilterClass(null); }}>
                  <Text style={styles.clearFilters}>Clear Filters</Text>
                </Pressable>
              </View>
            )}

            <View style={{ height: 140 }} />
          </ScrollView>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable style={styles.quickActionOuter} onPress={() => router.push('/team-builder')}>
            <View style={styles.quickActionInner}>
              <Ionicons name="people" size={20} color="#0A0B10" />
              <Text style={styles.quickActionTextDark}>Team Builder</Text>
            </View>
          </Pressable>

          <Pressable style={styles.quickActionOuterAlt} onPress={() => router.push('/summon-hub')}>
            <View style={styles.quickActionInnerAlt}>
              <Ionicons name="sparkles" size={20} color="rgba(255,255,255,0.92)" />
              <Text style={styles.quickActionTextLight}>Summon</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060A' },
  safe: { flex: 1 },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },

  header: {
    paddingTop: Platform.select({ ios: 54, android: 34, default: 34 }),
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitles: { alignItems: 'center', flex: 1 },
  title: { fontSize: 30, fontWeight: '900', color: 'rgba(255,255,255,0.94)' },
  subtitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.60)', marginTop: 4 },

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
  backBtnText: { color: 'rgba(255,255,255,0.92)', fontSize: 24, fontWeight: '900', marginTop: -2 },

  tierRowWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  tierRow: { alignItems: 'center', gap: 8, paddingRight: 10 },
  tierLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '800', marginRight: 4 },

  tierChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tierChipActive: {
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
    borderColor: 'rgba(255, 215, 140, 0.92)',
  },
  tierChipLocked: { opacity: 0.35 },
  tierChipText: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '900' },
  tierChipTextActive: { color: '#0A0B10' },
  tierChipTextLocked: { color: 'rgba(255,255,255,0.55)' },

  tierHint: { marginTop: 6, color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },

  blockPad: { paddingHorizontal: 16, marginTop: 8 },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
    borderColor: 'rgba(255, 215, 140, 0.92)',
  },
  filterText: { fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.70)' },
  filterTextActive: { color: '#0A0B10' },

  classRow: { flexDirection: 'row', gap: 10 },
  classChip: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.22)',
  },
  classChipActive: { backgroundColor: 'rgba(255, 215, 140, 0.92)' },
  classText: { fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.72)' },
  classTextActive: { color: '#0A0B10' },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.55)' },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(255, 215, 140, 0.24)',
    borderColor: 'rgba(255, 215, 140, 0.35)',
  },
  sortText: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.70)' },
  sortTextActive: { color: 'rgba(255, 215, 140, 0.92)' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.70)', marginTop: 12, fontSize: 14, fontWeight: '700' },

  gridScroll: { flex: 1, marginTop: 10 },
  gridContent: { paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  heroCardOuter: {
    width: '31%',
    aspectRatio: 0.76,
    marginBottom: 12,
    borderRadius: 14,
    padding: 1.2,
    backgroundColor: 'rgba(255, 215, 140, 0.18)', // subtle gold stroke
  },
  heroCardInner: {
    flex: 1,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 12, 18, 0.70)',
    padding: 6,
  },
  heroCardWash: {
    position: 'absolute',
    inset: 0,
    borderWidth: 1,
    borderRadius: 13,
    opacity: 0.45,
  },

  heroImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroImageFallback: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  rarityBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  rarityText: { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.95)' },

  classIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  tierBadge: {
    position: 'absolute',
    top: 34,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tierBadgeText: { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.85)' },

  starsContainer: { position: 'absolute', top: 54, left: 10, flexDirection: 'row', gap: 1, alignItems: 'center' },
  plusMark: { marginLeft: 2, color: 'rgba(255, 215, 140, 0.92)', fontSize: 10, fontWeight: '900' },

  awakenBadge: {
    position: 'absolute',
    bottom: 40,
    right: 10,
    backgroundColor: 'rgba(255, 90, 140, 0.95)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
  },
  awakenText: { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.95)' },

  heroInfo: { marginTop: 6 },
  heroName: { fontSize: 11, fontWeight: '900', marginBottom: 2 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelText: { fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: '900' },
  powerText: { fontSize: 9, color: 'rgba(255, 215, 140, 0.85)', fontWeight: '900' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.60)', marginTop: 12, fontWeight: '800' },
  clearFilters: { fontSize: 14, color: 'rgba(255, 215, 140, 0.92)', marginTop: 8, fontWeight: '900' },

  quickActions: { position: 'absolute', bottom: 80, left: 16, right: 16, flexDirection: 'row', gap: 12 },

  quickActionOuter: {
    flex: 1,
    borderRadius: 16,
    padding: 1.2,
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
  },
  quickActionInner: {
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
  },
  quickActionTextDark: { fontSize: 14, fontWeight: '900', color: '#0A0B10' },

  quickActionOuterAlt: {
    flex: 1,
    borderRadius: 16,
    padding: 1.2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  quickActionInnerAlt: {
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 12, 18, 0.72)',
  },
  quickActionTextLight: { fontSize: 14, fontWeight: '900', color: 'rgba(255,255,255,0.92)' },

  errorTitle: { fontSize: 18, fontWeight: '900', color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  errorSub: { marginTop: 6, fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.62)', textAlign: 'center' },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0A0B10', fontWeight: '900', fontSize: 14 },
});
