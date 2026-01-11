// /app/frontend/app/hero-progression.tsx
// Adds BOTH:
// 1) Rarity Ascension section (UI-only, gracefully tries common endpoints; shows "server not wired" if none exist)
// 2) "How to earn shards" hint (links to Summon Hub)
//
// Tier art + unlock mapping uses CENTRALIZED lib/tier.ts:
// - resolveTierArt(heroData, tier) for art resolution
// - unlockedTierForHero(hero) for tier gating
// - promote-star endpoint: POST /api/hero/{user_hero_id}/promote-star?username=...

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router as Router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { useGameStore, useHydration } from '../stores/gameStore';
import { useEntitlementStore } from '../stores/entitlementStore';

// Feature flags (SINGLE SOURCE OF TRUTH)
import { isFeatureEnabled } from '../lib/features';

// CANONICAL combat stats and power helpers
import { computeCombatStats } from '../lib/combatStats';
import { computePowerWithMultipliers } from '../lib/power';

// Centralized API calls (SINGLE SOURCE OF TRUTH for endpoints)
// getHeroProgression + promoteHeroStar + getUserHeroById - all hero endpoints live in lib/api.ts
import { getHeroProgression, promoteHeroStar, getUserHeroById } from '../lib/api';

// Centralized tier logic (SINGLE SOURCE OF TRUTH)
import {
  DisplayTier,
  displayStars,
  unlockedTierForHero,
  resolveTierArt,
  TIER_LABELS,
  MAX_STAR_TIER,
  nextBackendStar,
  isAtMaxStars,
  starsToTierIndex,
  tierLabel,
  labelForTier,
  tierSelectorOptions,
  labelForTierDisplay,
} from '../lib/progression';

// 2Dlive shell (UI-only)
import {
  CenteredBackground,
  DivineOverlays,
  SanctumAtmosphere,
  GlassCard,
} from '../components/DivineShell';

const SANCTUM_BG = require('../assets/backgrounds/sanctum_environment_01.jpg');

const STAR_SHARD_COSTS: Record<number, number> = { 1: 10, 2: 20, 3: 40, 4: 80, 5: 160, 6: 320 };

const clampInt = (n: any, min: number, max: number) => {
  const v = Number(n);
  if (!isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
};

const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'SSR+', 'UR', 'UR+'] as const;
type Rarity = (typeof RARITY_ORDER)[number];

const nextRarity = (r: string): Rarity | null => {
  const idx = RARITY_ORDER.indexOf((r as any) ?? 'SR');
  if (idx < 0) return null;
  if (idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
};

export default function HeroProgressionScreen() {
  const hydrated = useHydration();
  // IMPORTANT: heroId must be UserHero.id (the instance primary key), NOT hero_id (base hero template).
  // The promote-star endpoint expects user_hero_id.
  const { heroId } = useLocalSearchParams<{ heroId: string }>();
  const { user, fetchUser, fetchUserHeroes, userHeroes, getUserHeroById, selectUserHeroById } = useGameStore();

  const [isLoading, setIsLoading] = useState(true);

  // Store-derived hero (cache-first, O(1) lookup)
  const storeHero = selectUserHeroById(heroId ? String(heroId) : undefined);
  
  // Local copy for optimistic updates (initialized from store, updated optimistically)
  const [localHeroOverride, setLocalHeroOverride] = useState<any>(null);
  
  // Effective hero: use local override if set (optimistic), else store
  const hero = localHeroOverride ?? storeHero ?? null;
  const heroData = hero?.hero_data ?? null;

  // Check if store has "caught up" to the optimistic override
  // Used to safely clear override without UI flicker
  const isOverrideCaughtUp =
    !!localHeroOverride &&
    !!storeHero &&
    String(localHeroOverride.id) === String(storeHero.id) &&
    (storeHero.stars ?? 0) >= (localHeroOverride.stars ?? 0) &&
    (storeHero.duplicates ?? 0) === (localHeroOverride.duplicates ?? 0);

  const [previewTier, setPreviewTier] = useState<DisplayTier>(1);

  // confirm modals
  const [showConfirmPromote, setShowConfirmPromote] = useState(false);
  const [showConfirmAscend, setShowConfirmAscend] = useState(false);

  // network state
  const [isPromoting, setIsPromoting] = useState(false);
  const [isAscending, setIsAscending] = useState(false);

  // rollback for optimistic
  const rollbackRef = useRef<{ hero: any } | null>(null);
  
  // Track last hero id for tier initialization vs clamping
  const lastHeroIdRef = useRef<string | null>(null);

  // Clear override when heroId changes (prevents stale override on navigation)
  useEffect(() => {
    setLocalHeroOverride(null);
  }, [heroId]);

  // Clear override when store catches up (optimistic → canonical)
  useEffect(() => {
    if (!localHeroOverride) return;
    if (!storeHero) return;
    // If store hero has same or newer data, clear the optimistic override
    if (String(storeHero.id) === String(localHeroOverride.id)) {
      setLocalHeroOverride(null);
    }
  }, [localHeroOverride, storeHero]);

  // Use imported displayStars and unlockedTierForHero from lib/tier.ts

  const effectiveUnlockedTier = useMemo<DisplayTier>(() => {
    if (!hero) return 1;
    return unlockedTierForHero(hero);
  }, [hero?.id, hero?.stars, hero?.awakening_level]);

  // Merged tier effect: initialize on hero change, clamp otherwise
  // Prevents effect ping-pong while keeping preview tier user-selectable
  useEffect(() => {
    if (!hero) return;

    const heroKey = String(hero.id);

    // 1) Initialize previewTier when hero changes (or first load)
    if (lastHeroIdRef.current !== heroKey) {
      lastHeroIdRef.current = heroKey;
      setPreviewTier(effectiveUnlockedTier);
      return;
    }

    // 2) Otherwise, only clamp to valid range (don't overwrite user preview choice)
    setPreviewTier(prev => {
      if (prev > effectiveUnlockedTier) return effectiveUnlockedTier;
      if (prev < 1) return 1;
      return prev;
    });
  }, [hero?.id, effectiveUnlockedTier]);

  // Use centralized tier art resolution from lib/tier.ts
  const getTierArtSource = useCallback(
    (tier: DisplayTier) => {
      // Use canonical resolveTierArt from tier.ts (returns string | undefined)
      const url = resolveTierArt(heroData, tier);
      if (url) return { uri: url };
      return SANCTUM_BG;
    },
    [heroData]
  );

  const backgroundArt = useMemo(() => {
    // background follows preview tier (so you *feel* the tier change)
    return getTierArtSource(previewTier);
  }, [getTierArtSource, previewTier]);

  const heroName = heroData?.name || heroData?.hero_name || 'Hero';
  const heroRarity = (heroData?.rarity || 'SR') as string;
  const heroClass = heroData?.hero_class || '—';

  const shards = useMemo(() => clampInt(hero?.duplicates ?? 0, 0, 999999999), [hero?.duplicates]);
  const stars = useMemo(() => displayStars(hero), [hero]);

  // Tier selector options (feature-flag aware for awakening tiers)
  const tierOptions = useMemo(
    () => tierSelectorOptions(user?.id ?? user?.username),
    [user?.id, user?.username]
  );

  // Use centralized progression helpers from tier.ts
  const isMaxStars = useMemo(() => isAtMaxStars(stars), [stars]);
  const nextStar = useMemo(() => nextBackendStar(stars), [stars]);
  // Compute next tier WITHOUT constructing a fake hero object
  const nextTier = useMemo(() => nextStar === null ? null : starsToTierIndex(nextStar), [nextStar]);
  const shardsNeededForNext = useMemo(() => {
    if (!nextStar) return null;
    return STAR_SHARD_COSTS[nextStar] ?? 999;
  }, [nextStar]);

  const canPromote = useMemo(() => {
    if (!user || !hero) return false;
    if (isMaxStars) return false;
    if (!shardsNeededForNext) return false;
    return shards >= shardsNeededForNext;
  }, [hero, isMaxStars, shards, shardsNeededForNext, user]);

  const rarityPillColor = useMemo(() => {
    const map: Record<string, string> = {
      N: 'rgba(160,160,160,0.95)',
      R: 'rgba(90,200,120,0.95)',
      SR: 'rgba(80,160,255,0.95)',
      SSR: 'rgba(180,90,255,0.95)',
      'SSR+': 'rgba(255,90,170,0.95)',
      UR: 'rgba(255,170,60,0.95)',
      'UR+': 'rgba(255,90,90,0.95)',
    };
    return map[heroRarity] || map.SR;
  }, [heroRarity]);

  const rarityNext = useMemo(() => nextRarity(heroRarity), [heroRarity]);
  const canAscend = useMemo(() => {
    // UI-only gating: must be at final tier (5★+) and not already max rarity
    if (!rarityNext) return false;
    return effectiveUnlockedTier === 6;
  }, [effectiveUnlockedTier, rarityNext]);
  
  // Subscribe to entitlements for reactive power updates
  const entitlements = useEntitlementStore(s => s.entitlements);

  const calcPower = useCallback((h: any, hd: any, overrideStars?: number) => {
    if (!h || !hd) return 0;

    const level = clampInt(h?.level ?? 1, 1, 999);
    // Use override stars if provided (for simulating next star power), otherwise extract from hero
    const starsLocal = overrideStars !== undefined 
      ? clampInt(overrideStars, 0, MAX_STAR_TIER)
      : clampInt(h?.stars ?? 0, 0, MAX_STAR_TIER);
    const awaken = clampInt(h?.awakening_level ?? 0, 0, 99);

    // Use canonical combat stats (includes premium cinematic bonus)
    const stats = computeCombatStats(h, hd);

    const levelMult = 1 + (level - 1) * 0.05;
    const starMult = 1 + starsLocal * 0.1;
    const awakenMult = 1 + awaken * 0.2;

    return computePowerWithMultipliers(stats, levelMult, starMult, awakenMult);
  }, [entitlements]);

  const currentPower = useMemo(() => calcPower(hero, heroData), [calcPower, hero, heroData]);

  const nextPower = useMemo(() => {
    if (!hero || !heroData) return null;
    if (!nextStar) return null;
    // Pass nextStar as override instead of constructing fake hero
    return calcPower(hero, heroData, nextStar);
  }, [calcPower, hero, heroData, nextStar]);

  const loadHero = useCallback(async () => {
    if (!heroId) return;
    if (!user) return; // Require user for ensure
    if (isPromoting) return; // Don't fight optimistic UI mid-flight

    setIsLoading(true);
    try {
      // ✅ Ensure pattern (cache-first, correct signature)
      await getUserHeroById(String(heroId));

      // Optional: progression metadata (never determines hero existence)
      if (user?.username) {
        try {
          const progressionData = await getHeroProgression(user.username, String(heroId));
          if (progressionData) {
            // If you have progression-specific state, set it here.
            // For now, progression endpoint just ensures data is fresh.
          }
        } catch {
          // ignore progression errors; do not destabilize hero rendering
        }
      }

      // Clear local override only when store has caught up
      // (isPromoting check at top already guarantees we're not promoting here)
      if (isOverrideCaughtUp) {
        setLocalHeroOverride(null);
      }
    } catch (e) {
      console.error('hero-progression load error', e);
      // IMPORTANT: do not set hero to null here.
      // Keep rendering stable based on selector + existing store state.
    } finally {
      setIsLoading(false);
    }
  }, [
    heroId,
    user,
    isPromoting,
    isOverrideCaughtUp,
    getUserHeroById,
    getHeroProgression,
  ]);

  useEffect(() => {
    if (hydrated && user && heroId) loadHero();
  }, [hydrated, user, heroId, loadHero]);

  const requestPromote = useCallback(() => {
    if (!hero) return;
    if (isMaxStars) {
      Alert.alert('Max Stars', 'This hero is already at maximum stars.');
      return;
    }
    if (!shardsNeededForNext) {
      Alert.alert('Cannot Promote', 'Missing shard cost data.');
      return;
    }
    if (shards < shardsNeededForNext) {
      Alert.alert('Not enough shards', `Need ${shardsNeededForNext} shards. You have ${shards}.`);
      return;
    }
    setShowConfirmPromote(true);
  }, [hero, isMaxStars, shards, shardsNeededForNext]);

  const promoteOptimistic = useCallback(async () => {
    if (!user?.username || !heroId || !hero) return;
    if (isMaxStars || !nextStar || !shardsNeededForNext) return;

    setShowConfirmPromote(false);
    setIsPromoting(true);

    // Store canonical pre-optimistic value for rollback (prefer store over current hero)
    rollbackRef.current = { hero: storeHero ?? hero };

    // OPTIMISTIC APPLY (local override)
    const optimisticHero = {
      ...hero,
      stars: nextStar,
      duplicates: Math.max(0, shards - shardsNeededForNext),
    };
    setLocalHeroOverride(optimisticHero);

    try {
      // Use centralized API wrapper (lib/api.ts) - single source of truth for endpoints
      // Response: { success, new_stars, shards_used, remaining_shards }
      const resp = await promoteHeroStar(String(heroId), user.username);

      const newStars = clampInt(resp?.new_stars ?? nextStar, 0, 6);
      const remaining = clampInt(resp?.remaining_shards ?? optimisticHero.duplicates, 0, 999999999);

      // Update optimistic hero with server response
      setLocalHeroOverride((prev: any) => ({
        ...prev,
        stars: newStars,
        duplicates: remaining,
      }));

      await fetchUser();
      // Refresh store hero (this will update storeHero via selector)
      await getUserHeroById(String(heroId), { forceRefresh: true });
      
      // Clear local override now that store is fresh
      setLocalHeroOverride(null);

      // Compute newTier using authoritative server values
      const newTier = unlockedTierForHero({ ...optimisticHero, stars: newStars, duplicates: remaining });
      if (newTier > effectiveUnlockedTier) {
        Alert.alert(
          'Star Promoted! 🌟',
          `New tier art unlocked: ${labelForTier(newTier)}\n\nReturn to Hero Detail to preview your new art!`
        );
      } else {
        Alert.alert('Star Promoted! 🌟', `Now at ${newStars} star(s). Keep collecting shards!`);
      }
    } catch (e: any) {
      // Rollback to canonical pre-optimistic hero state
      if (rollbackRef.current?.hero) setLocalHeroOverride(rollbackRef.current.hero);
      Alert.alert('Promotion failed', e?.response?.data?.detail || 'Unable to promote this hero right now.');
    } finally {
      rollbackRef.current = null;
      setIsPromoting(false);
    }
  }, [
    hero,
    storeHero,
    heroId,
    isMaxStars,
    nextStar,
    shards,
    shardsNeededForNext,
    unlockedTierForHero,
    effectiveUnlockedTier,
    user?.username,
    fetchUser,
    fetchUserHeroes,
  ]);

  // --- Ascension: UI-only placeholder (endpoint may not exist yet) ---
  const tryAscend = useCallback(async () => {
    setShowConfirmAscend(false);
    Alert.alert('Coming Soon', 'Rarity ascension is planned but not wired yet.');
  }, []);

  // ----------------------------
  // RENDER STATES (stable mode - no branch flipping)
  // ----------------------------
  const renderMode =
    !hydrated || isLoading ? 'loading' :
    !user ? 'not-found' :
    !hero || !heroData ? 'not-found' :
    'ready';

  // Loading view
  if (renderMode === 'loading') {
    return (
      <View style={styles.root}>
        <CenteredBackground source={SANCTUM_BG} mode="contain" zoom={1.04} opacity={1} />
        <SanctumAtmosphere />
        <DivineOverlays vignette grain />

        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color="rgba(255, 215, 140, 0.92)" />
          <Text style={styles.loadingText}>Loading progression...</Text>
        </SafeAreaView>
      </View>
    );
  }

  // Not found view
  if (renderMode === 'not-found') {
    return (
      <View style={styles.root}>
        <CenteredBackground source={SANCTUM_BG} mode="contain" zoom={1.04} opacity={1} />
        <SanctumAtmosphere />
        <DivineOverlays vignette grain />

        <SafeAreaView style={styles.center}>
          <Ionicons name="alert-circle" size={44} color="rgba(255, 215, 140, 0.92)" />
          <Text style={styles.errorTitle}>Hero not found</Text>
          <Pressable style={styles.primaryBtn} onPress={() => Router.back()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  // Ready - main view

  const tierIsCinematic = effectiveUnlockedTier === 6 && VIDEOS_AVAILABLE;

  return (
    <View style={styles.root}>
      <CenteredBackground source={backgroundArt} mode="contain" zoom={1.06} opacity={1} waitForSize={false} />
      <SanctumAtmosphere />
      <DivineOverlays vignette grain />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => Router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.92)" />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>Progression</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {heroRarity} • {heroClass}
            </Text>
          </View>

          <Pressable onPress={() => Router.push(`/hero-detail?id=${hero.id}&tier=${previewTier}`)} style={styles.peekBtn}>
            <Ionicons name="eye" size={18} color="rgba(255, 215, 140, 0.92)" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Identity */}
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.portraitOuter}>
                <View style={[styles.portraitStroke, { backgroundColor: 'rgba(255, 215, 140, 0.18)' }]} />
                <Image source={resolveTierArt(previewTier)} style={styles.portrait} resizeMode="cover" />
                <View style={[styles.rarityPill, { backgroundColor: rarityPillColor }]}>
                  <Text style={styles.rarityPillText}>{heroRarity}</Text>
                </View>
                <View style={styles.tierPill}>
                  <Text style={styles.tierPillText}>
                    {tierLabel(previewTier)}
                    {previewTier > effectiveUnlockedTier ? ' (LOCKED)' : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.heroMeta}>
                <Text style={styles.heroName} numberOfLines={2}>{heroName}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Stars</Text>
                  <View style={styles.starLine}>
                    {stars > 0 ? (
                      <>
                        {Array.from({ length: Math.min(5, stars) }).map((_, i) => (
                          <Ionicons key={i} name="star" size={14} color="rgba(255, 215, 140, 0.92)" />
                        ))}
                        {effectiveUnlockedTier === 6 && <Text style={styles.plusMark}>+</Text>}
                      </>
                    ) : (
                      <Text style={styles.metaValue}>0</Text>
                    )}
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Shards</Text>
                  <View>
                    <Text style={styles.metaValue}>{shards.toLocaleString()}</Text>
                    <Text style={styles.shardHint}>Earn from duplicate summons</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Power</Text>
                  <Text style={styles.metaValue}>{currentPower.toLocaleString()}</Text>
                </View>

                {(hero.awakening_level || 0) > 0 && (
                  <View style={styles.awakenRow}>
                    <Text style={styles.awakenText}>⚡ Awakening {hero.awakening_level}</Text>
                  </View>
                )}
              </View>
            </View>
          </GlassCard>

          {/* Shards hint (DO BOTH: add this) */}
          <GlassCard style={styles.block}>
            <Text style={styles.blockTitle}>How to earn shards</Text>
            <Text style={styles.blockSub}>
              Pull duplicates from Summon to gain shards. More pulls = more stars = more tier art.
            </Text>

            <View style={styles.hintRow}>
              <View style={styles.hintPill}>
                <Ionicons name="sparkles" size={16} color="rgba(255,255,255,0.92)" />
                <Text style={styles.hintText}>Duplicates → +1 shard each pull</Text>
              </View>

              <Pressable onPress={() => Router.push('/summon-hub')} style={styles.hintBtn}>
                <Text style={styles.hintBtnText}>Go to Summon</Text>
              </Pressable>
            </View>
          </GlassCard>

          {/* Tier Ladder */}
          <GlassCard style={styles.block}>
            <Text style={styles.blockTitle}>Ascension Forms</Text>
            <Text style={styles.blockSub}>
              Select a form to preview. Locked tiers remain inaccessible until unlocked.
            </Text>

            <View style={styles.tierRow}>
              {tierOptions.map(({ tier, label, kind }) => {
                const isAwakening = kind === 'awakening';
                // Awakening tiers always "preview only" while hard-off; active tiers check unlock
                const locked = isAwakening ? true : tier > effectiveUnlockedTier;
                const active = tier === previewTier;

                return (
                  <Pressable
                    key={tier}
                    onPress={() => {
                      if (locked) {
                        Alert.alert(
                          isAwakening ? 'Awakening Preview' : 'Locked Tier',
                          isAwakening
                            ? 'Awakening is not active yet. This is preview-only.'
                            : `Unlock ${label} by promoting stars.`
                        );
                        return;
                      }
                      setPreviewTier(tier);
                    }}
                    style={[
                      styles.tierChip,
                      active && styles.tierChipActive,
                      locked && styles.tierChipLocked,
                      isAwakening && styles.tierChipAwakening,
                    ]}
                  >
                    <View style={styles.tierThumbWrap}>
                      <Image source={resolveTierArt(tier)} style={styles.tierThumb} resizeMode="cover" />
                      {locked && (
                        <View style={styles.lockOverlay}>
                          <Ionicons 
                            name={isAwakening ? 'sparkles' : 'lock-closed'} 
                            size={14} 
                            color="rgba(255,255,255,0.9)" 
                          />
                        </View>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.tierChipText,
                        active && styles.tierChipTextActive,
                        locked && styles.tierChipTextLocked,
                      ]}
                    >
                      {label}
                    </Text>

                    {active && !locked && <View style={styles.activeDot} />}
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          {/* Promotion Panel */}
          <GlassCard style={styles.block}>
            <View style={styles.promoHeader}>
              <Text style={styles.blockTitle}>Star Promotion</Text>

              {isMaxStars ? (
                <View style={styles.maxBadge}>
                  <Ionicons name="trophy" size={16} color="rgba(255, 215, 140, 0.92)" />
                  <Text style={styles.maxBadgeText}>MAX</Text>
                </View>
              ) : (
                <View style={styles.nextBadge}>
                  <Text style={styles.nextBadgeText}>Next: {nextStar}★</Text>
                </View>
              )}
            </View>

            {isMaxStars ? (
              <Text style={styles.blockSub}>
                This hero has reached maximum stars (6). Future upgrades can come from Awakening and rarity ascension.
              </Text>
            ) : (
              <>
                <View style={styles.reqBox}>
                  <View style={styles.reqRow}>
                    <Text style={styles.reqLabel}>Shards required</Text>
                    <Text style={styles.reqValue}>{(shardsNeededForNext || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.reqRow}>
                    <Text style={styles.reqLabel}>You have</Text>
                    <Text style={[styles.reqValue, shards >= (shardsNeededForNext || 0) ? styles.good : styles.bad]}>
                      {shards.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>After promotion</Text>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Unlocked tier</Text>
                    <Text style={styles.previewValue}>
                      {nextTier ? labelForTier(nextTier) : '—'}
                    </Text>
                  </View>

                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Power</Text>
                    <Text style={styles.previewValue}>
                      {currentPower.toLocaleString()} → {nextPower?.toLocaleString() ?? '—'}
                    </Text>
                  </View>

                  {nextTier === 6 && (
                    <View style={styles.unlockCallout}>
                      <Ionicons name="film" size={16} color="rgba(255,255,255,0.92)" />
                      <Text style={styles.unlockCalloutText}>Unlocks 5★+ final form (and cinematic, if available)</Text>
                    </View>
                  )}
                </View>

                <Pressable
                  onPress={requestPromote}
                  disabled={!canPromote || isPromoting}
                  style={[
                    styles.promoteBtnOuter,
                    (!canPromote || isPromoting) && styles.promoteBtnOuterDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={
                      !canPromote || isPromoting
                        ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)']
                        : ['rgba(255, 215, 140, 0.92)', 'rgba(180, 120, 40, 0.92)']
                    }
                    style={styles.promoteBtnInner}
                  >
                    {isPromoting ? (
                      <ActivityIndicator color="#0A0B10" />
                    ) : (
                      <>
                        <Ionicons name="star" size={18} color="#0A0B10" />
                        <Text style={styles.promoteBtnText}>
                          {canPromote
                            ? `Promote to ${nextStar}★`
                            : `Need ${(Math.max(0, (shardsNeededForNext || 0) - shards)).toLocaleString()} more shards`}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Text style={styles.promoHint}>
                  Stars increase stats and unlock higher-tier ascension art.
                </Text>
              </>
            )}
          </GlassCard>

          {/* Awakening Preview - Only for 6★ heroes (GATED by feature flag) */}
          {isFeatureEnabled('AWAKENING_PREVIEW_UI') && effectiveUnlockedTier === 6 && (
            <GlassCard style={styles.block}>
              <View style={styles.promoHeader}>
                <Text style={styles.blockTitle}>Awakening Path</Text>
                <View style={styles.comingSoonBadge}>
                  <Ionicons name="time-outline" size={12} color="#FFD700" />
                  <Text style={styles.comingSoonText}>FUTURE</Text>
                </View>
              </View>

              <Text style={styles.blockSub}>
                Your hero has reached 5★+ (maximum stars). The Awakening System will allow transcendence to tiers 7★ through 10★.
              </Text>

              <Pressable
                onPress={() => Router.push('/awakening-preview')}
                style={styles.awakeningPreviewBtn}
              >
                <LinearGradient
                  colors={['rgba(123, 104, 238, 0.85)', 'rgba(155, 89, 182, 0.85)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.awakeningPreviewBtnInner}
                >
                  <Ionicons name="sparkles" size={18} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.awakeningPreviewBtnText}>Preview Awakening Tiers</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </Pressable>
            </GlassCard>
          )}

          {/* Awakening Tier Cards (7★–10★ scaffold) - Only for 6★ heroes (GATED by feature flag) */}
          {isFeatureEnabled('AWAKENING_PREVIEW_UI') && effectiveUnlockedTier === 6 && (
            <GlassCard style={styles.block}>
              <Text style={styles.blockTitle}>🌙 Awakening Tiers</Text>
              <Text style={styles.blockSub}>
                Future awakening system. Unlock by reaching 6★ and spending Awakening Shards.
              </Text>

              <View style={styles.awakeningGrid}>
                {[7, 8, 9, 10].map((tier) => {
                  // Map awakening_level to unlocked: 7→1, 8→2, 9→3, 10→4
                  const unlocked = (hero?.awakening_level || 0) >= (tier - 6);
                  return (
                    <View
                      key={tier}
                      style={[
                        styles.awakeningCard,
                        unlocked && styles.awakeningCardUnlocked,
                      ]}
                    >
                      <View style={styles.awakeningCardTop}>
                        <Text style={styles.awakeningTierText}>{tier}★</Text>
                        <View style={[styles.awakeningPill, unlocked && styles.awakeningPillUnlocked]}>
                          <Text style={styles.awakeningPillText}>{unlocked ? 'UNLOCKED' : 'LOCKED'}</Text>
                        </View>
                      </View>

                      <Text style={styles.awakeningCardTitle}>Awakening Tier {tier - 6}</Text>
                      <Text style={styles.awakeningCardSub}>
                        Planned system • No effects yet
                      </Text>

                      <View style={styles.awakeningDivider} />

                      <Text style={styles.awakeningHint}>
                        Coming soon: passives, VFX, and tier {tier} art.
                      </Text>
                    </View>
                  );
                })}
              </View>
            </GlassCard>
          )}

          {/* Rarity Ascension (DO BOTH: add this) */}
          <GlassCard style={styles.block}>
            <View style={styles.promoHeader}>
              <Text style={styles.blockTitle}>Rarity Ascension</Text>

              {rarityNext ? (
                <View style={styles.nextBadge}>
                  <Text style={styles.nextBadgeText}>{heroRarity} → {rarityNext}</Text>
                </View>
              ) : (
                <View style={styles.maxBadge}>
                  <Ionicons name="trophy" size={16} color="rgba(255, 215, 140, 0.92)" />
                  <Text style={styles.maxBadgeText}>MAX</Text>
                </View>
              )}
            </View>

            {!rarityNext ? (
              <Text style={styles.blockSub}>
                This hero is already at maximum rarity.
              </Text>
            ) : (
              <>
                <Text style={styles.blockSub}>
                  Ascend rarity after reaching 5★+ (tier 6). Server rules (costs/materials) can be enforced on the backend.
                </Text>

                <View style={styles.reqBox}>
                  <View style={styles.reqRow}>
                    <Text style={styles.reqLabel}>Requirement</Text>
                    <Text style={[styles.reqValue, canAscend ? styles.good : styles.bad]}>
                      {canAscend ? '5★+ reached' : 'Reach 5★+'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setShowConfirmAscend(true)}
                  disabled={!canAscend || isAscending}
                  style={[
                    styles.promoteBtnOuter,
                    (!canAscend || isAscending) && styles.promoteBtnOuterDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={
                      !canAscend || isAscending
                        ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)']
                        : ['rgba(155, 89, 182, 0.92)', 'rgba(95, 60, 150, 0.92)']
                    }
                    style={styles.promoteBtnInner}
                  >
                    {isAscending ? (
                      <ActivityIndicator color="rgba(255,255,255,0.92)" />
                    ) : (
                      <>
                        <Ionicons name="rocket" size={18} color="rgba(255,255,255,0.92)" />
                        <Text style={[styles.promoteBtnText, { color: 'rgba(255,255,255,0.92)' }]}>
                          Ascend to {rarityNext}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Text style={styles.promoHint}>
                  If the backend endpoint isn't wired yet, you'll see a clear "not available" message.
                </Text>
              </>
            )}
          </GlassCard>

          <View style={{ height: 140 }} />
        </ScrollView>

        {/* Confirm Promote modal */}
        <Modal
          visible={showConfirmPromote}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmPromote(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Confirm Promotion</Text>

              <Text style={styles.modalText}>
                Promote <Text style={styles.modalStrong}>{heroName}</Text> to{' '}
                <Text style={styles.modalStrong}>{nextStar}★</Text>?
              </Text>

              <View style={styles.modalCostRow}>
                <Ionicons name="sparkles" size={18} color="rgba(180, 90, 255, 0.95)" />
                <Text style={styles.modalCostText}>
                  Cost: {(shardsNeededForNext || 0).toLocaleString()} shards
                </Text>
              </View>

              <View style={styles.modalBtns}>
                <Pressable style={styles.modalBtnGhost} onPress={() => setShowConfirmPromote(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalBtnSolid} onPress={promoteOptimistic}>
                  <Text style={styles.modalBtnSolidText}>Promote</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Confirm Ascend modal */}
        <Modal
          visible={showConfirmAscend}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmAscend(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Confirm Ascension</Text>

              <Text style={styles.modalText}>
                Ascend <Text style={styles.modalStrong}>{heroName}</Text> from{' '}
                <Text style={styles.modalStrong}>{heroRarity}</Text> to{' '}
                <Text style={styles.modalStrong}>{rarityNext || '—'}</Text>?
              </Text>

              <View style={styles.modalCostRow}>
                <Ionicons name="alert" size={18} color="rgba(255, 215, 140, 0.92)" />
                <Text style={styles.modalCostText}>
                  Server enforces final costs & rules.
                </Text>
              </View>

              <View style={styles.modalBtns}>
                <Pressable style={styles.modalBtnGhost} onPress={() => setShowConfirmAscend(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalBtnSolid} onPress={tryAscend}>
                  <Text style={styles.modalBtnSolidText}>Ascend</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060A' },
  safe: { flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 16 },
  loadingText: { color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: '800' },

  errorTitle: { color: 'rgba(255,255,255,0.92)', fontSize: 16, fontWeight: '900', marginTop: 8 },
  primaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
  },
  primaryBtnText: { color: '#0A0B10', fontSize: 14, fontWeight: '900' },

  header: {
    paddingTop: Platform.select({ ios: 10, android: 10, default: 10 }),
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: 'rgba(255,255,255,0.92)', fontSize: 18, fontWeight: '900' },
  headerSub: { marginTop: 2, color: 'rgba(255,255,255,0.62)', fontSize: 11.5, fontWeight: '800' },
  peekBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.25)',
  },

  content: { padding: 16, paddingTop: 6 },

  heroCard: { padding: 12, marginBottom: 12 },
  heroRow: { flexDirection: 'row', gap: 12 },

  portraitOuter: { width: 118, height: 118, borderRadius: 18, overflow: 'hidden' },
  portraitStroke: { position: 'absolute', inset: 0, borderRadius: 18 },
  portrait: { width: '100%', height: '100%' },

  rarityPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rarityPillText: { color: 'rgba(255,255,255,0.95)', fontSize: 10, fontWeight: '900' },

  tierPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  tierPillText: { color: 'rgba(255,255,255,0.90)', fontSize: 10, fontWeight: '900' },

  heroMeta: { flex: 1, justifyContent: 'center' },
  heroName: { color: 'rgba(255,255,255,0.92)', fontSize: 16, fontWeight: '900', marginBottom: 8 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  metaLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800' },
  metaValue: { color: 'rgba(255,255,255,0.90)', fontSize: 12.5, fontWeight: '900' },
  shardHint: { marginTop: 2, fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  starLine: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  plusMark: { marginLeft: 2, color: 'rgba(255, 215, 140, 0.92)', fontSize: 12, fontWeight: '900' },

  awakenRow: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 90, 140, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 140, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  awakenText: { color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '900' },

  block: { padding: 12, marginBottom: 12 },
  blockTitle: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '900' },
  blockSub: { marginTop: 6, color: 'rgba(255,255,255,0.62)', fontSize: 11.5, fontWeight: '700', lineHeight: 16 },

  hintRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  hintText: { color: 'rgba(255,255,255,0.82)', fontSize: 11.5, fontWeight: '800' },
  hintBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
  },
  hintBtnText: { color: '#0A0B10', fontSize: 12, fontWeight: '900' },

  tierRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tierChip: {
    width: '31%',
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  tierChipActive: {
    borderColor: 'rgba(255, 215, 140, 0.55)',
    backgroundColor: 'rgba(255, 215, 140, 0.10)',
  },
  tierChipLocked: { opacity: 0.45 },
  tierChipAwakening: { 
    borderColor: 'rgba(180, 130, 255, 0.4)',
    backgroundColor: 'rgba(180, 130, 255, 0.08)',
  },

  tierThumbWrap: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  tierThumb: { width: '100%', height: '100%' },
  lockOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tierChipText: { color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '900' },
  tierChipTextActive: { color: 'rgba(255, 215, 140, 0.92)' },
  tierChipTextLocked: { color: 'rgba(255,255,255,0.65)' },

  activeDot: {
    marginTop: 6,
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
  },

  cineRow: {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cineText: { flex: 1, color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '800' },
  cineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
  },
  cineBtnText: { color: '#0A0B10', fontSize: 12, fontWeight: '900' },

  promoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 140, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.25)',
  },
  nextBadgeText: { color: 'rgba(255, 215, 140, 0.92)', fontSize: 11, fontWeight: '900' },
  maxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 140, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.25)',
  },
  maxBadgeText: { color: 'rgba(255, 215, 140, 0.92)', fontSize: 11, fontWeight: '900' },

  reqBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  reqRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reqLabel: { color: 'rgba(255,255,255,0.60)', fontSize: 11, fontWeight: '800' },
  reqValue: { color: 'rgba(255,255,255,0.90)', fontSize: 11, fontWeight: '900' },
  good: { color: 'rgba(70, 230, 150, 0.95)' },
  bad: { color: 'rgba(255, 90, 90, 0.95)' },

  previewBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  previewTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  previewLabel: { color: 'rgba(255,255,255,0.60)', fontSize: 11, fontWeight: '800' },
  previewValue: { color: 'rgba(255,255,255,0.90)', fontSize: 11, fontWeight: '900' },

  unlockCallout: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(155, 89, 182, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockCalloutText: { flex: 1, color: 'rgba(255,255,255,0.86)', fontSize: 11, fontWeight: '800' },

  promoteBtnOuter: { marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  promoteBtnOuterDisabled: { opacity: 0.55 },
  promoteBtnInner: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  promoteBtnText: { color: '#0A0B10', fontSize: 13, fontWeight: '900' },
  promoHint: { marginTop: 8, color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700' },

  // Awakening Preview
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  comingSoonText: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  awakeningPreviewBtn: { marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  awakeningPreviewBtnInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  awakeningPreviewBtnText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '900' },

  // Awakening Tier Cards (7★–10★)
  awakeningGrid: { marginTop: 12, gap: 12 },
  awakeningCard: {
    backgroundColor: 'rgba(20, 18, 40, 0.65)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  awakeningCardUnlocked: {
    borderColor: 'rgba(255, 215, 140, 0.55)',
    backgroundColor: 'rgba(255, 215, 140, 0.08)',
  },
  awakeningCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  awakeningTierText: { fontSize: 20, fontWeight: '900', color: 'rgba(255,255,255,0.92)' },
  awakeningPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  awakeningPillUnlocked: {
    backgroundColor: 'rgba(255, 215, 140, 0.20)',
    borderColor: 'rgba(255, 215, 140, 0.45)',
  },
  awakeningPillText: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
  awakeningCardTitle: { marginTop: 10, fontSize: 14, fontWeight: '900', color: 'rgba(255,255,255,0.92)' },
  awakeningCardSub: { marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  awakeningDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  awakeningHint: { fontSize: 11, color: 'rgba(255,255,255,0.50)', lineHeight: 16, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 12, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
  },
  modalTitle: { color: 'rgba(255,255,255,0.92)', fontSize: 16, fontWeight: '900' },
  modalText: { marginTop: 10, color: 'rgba(255,255,255,0.70)', fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  modalStrong: { color: 'rgba(255, 215, 140, 0.92)', fontWeight: '900' },

  modalCostRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalCostText: { color: 'rgba(255,255,255,0.80)', fontSize: 12, fontWeight: '800' },

  modalBtns: { marginTop: 14, flexDirection: 'row', gap: 10 },
  modalBtnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  modalBtnGhostText: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '900' },
  modalBtnSolid: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 140, 0.92)',
    alignItems: 'center',
  },
  modalBtnSolidText: { color: '#0A0B10', fontSize: 13, fontWeight: '900' },
});
