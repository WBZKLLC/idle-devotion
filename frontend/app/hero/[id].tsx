// /app/frontend/app/hero/[id].tsx
// Phase 3.23.9: Hero Screen Foundation
//
// A neutral, elegant stage for hero presentation.
// Layer stack locked for future motion/intimacy upgrades.
//
// NOT in this phase: idle sway, breathing, intimacy, camera creep
// "Just structure. No motion tiers yet."

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

// Store
import { useGameStore, useHydration } from '../../stores/gameStore';

// Theme
import COLORS from '../../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT, HERO_STAGE } from '../../components/ui/tokens';

// Hero foundation
import { CAMERA, getCameraTransform, CameraMode } from '../../lib/hero/camera';
import { useHeroInteractions } from '../../lib/hero/interactions';
import { 
  ContentLevel, 
  getEffectiveContentLevel,
  SCREEN_BOUNDARIES,
} from '../../lib/hero/content-boundaries';

// Tier resolution
import { resolveTierArt, effectiveTierForHero, DisplayTier } from '../../lib/progression';

// Shared atmosphere
import { AtmosphereStack } from '../../components/home/AtmosphereStack';

// Haptics
import { haptic } from '../../lib/ui/interaction';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Hero Visual Layer Stack (locked order):
 * 1. Background art (static)
 * 2. Atmospheric overlay (very light)
 * 3. Hero silhouette / model (centered)
 * 4. Parallax foreground accents (future: cloth, hair)
 * 5. UI chrome (top stats, bottom actions)
 */

// Rarity star rendering helper
function renderRarityStars(rarity: string) {
  const starCount = rarity === 'UR' || rarity === 'UR+' ? 5 
    : rarity === 'SSR' || rarity === 'SSR+' ? 4 
    : rarity === 'SR' ? 3 
    : 2;
  
  return (
    <View style={styles.rarityStars}>
      {Array(starCount).fill(0).map((_, i) => (
        <Ionicons 
          key={i} 
          name="star" 
          size={12} 
          color={COLORS.gold.light} 
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

export default function HeroPresentationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hydrated = useHydration();
  const { user, getUserHeroById } = useGameStore();
  
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState<any>(null);
  const [heroData, setHeroData] = useState<any>(null);
  
  // Camera mode (only 'standard' active for now)
  const [cameraMode] = useState<CameraMode>('standard');
  
  // Wire interaction hooks (no-op for now)
  const { onTap, onLongPress } = useHeroInteractions(id || '');
  
  // Load hero data
  useEffect(() => {
    if (!hydrated || !user || !id) return;
    
    const loadHero = async () => {
      setLoading(true);
      try {
        // Use canonical cache-first + API fallback pattern
        const userHero = await getUserHeroById(id);
        if (userHero) {
          setHero(userHero);
          setHeroData(userHero.hero_data);
        }
      } catch (err) {
        console.error('[HeroPresentation] Failed to load hero:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadHero();
  }, [hydrated, user, id, getUserHeroById]);
  
  // Resolve tier art
  const tier = useMemo(() => {
    if (!hero) return 1 as DisplayTier;
    // Use tier 1 (standard) as default requested tier
    return effectiveTierForHero(hero, 1 as DisplayTier);
  }, [hero]);
  
  const heroArtUrl = useMemo(() => {
    if (!heroData) return null;
    return resolveTierArt(heroData, tier);
  }, [heroData, tier]);
  
  // Get effective content level for this screen
  const contentLevel = useMemo(() => {
    const affinityLevel = hero?.affinity_level || 0;
    return getEffectiveContentLevel('heroPresentation', affinityLevel);
  }, [hero]);
  
  // Camera transform (static for now - will animate in future phases)
  const cameraTransform = getCameraTransform(cameraMode);
  
  // Calculate hero power (simple single value)
  const heroPower = useMemo(() => {
    if (!hero) return 0;
    return Math.floor((hero.current_atk || 0) + (hero.current_hp || 0) / 10 + (hero.current_def || 0));
  }, [hero]);
  
  // Handle back navigation
  const handleBack = () => {
    haptic('light');
    router.back();
  };
  
  // Action handlers
  const handleUpgrade = () => {
    haptic('medium');
    router.push(`/hero-upgrade?id=${id}`);
  };
  
  const handleBond = () => {
    haptic('light');
    // Future: Bond/Gift interaction
    console.log('[HeroPresentation] Bond tapped');
  };
  
  const handleEquip = () => {
    haptic('light');
    // Future: Equipment screen
    console.log('[HeroPresentation] Equip tapped');
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
          <Text style={styles.loadingText}>Preparing...</Text>
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
      {/* LAYER 1: Background art (static) */}
      <View style={StyleSheet.absoluteFill}>
        {heroArtUrl ? (
          <Image
            source={{ uri: heroArtUrl }}
            style={styles.backgroundArt}
            resizeMode="cover"
            blurRadius={Platform.OS === 'ios' ? 20 : 10}
          />
        ) : (
          // Gradient fallback when no art available
          <LinearGradient
            colors={[COLORS.navy.darkest, COLORS.navy.dark, COLORS.navy.primary]}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Darken overlay for background */}
        <View style={styles.backgroundOverlay} />
      </View>
      
      {/* LAYER 2: Atmospheric overlay (very light) */}
      <AtmosphereStack
        topHaze
        vignette
        bottomMist
        driftingFog={false} // Disable drift on hero screen for focus
      />
      
      {/* LAYER 3: Hero silhouette / model (centered) */}
      <Pressable
        style={styles.heroLayer}
        onPress={() => onTap()}
        onLongPress={() => onLongPress()}
        delayLongPress={500}
      >
        <Animated.View
          style={[
            styles.heroContainer,
            {
              transform: cameraTransform,
              maxWidth: HERO_STAGE.HERO_MAX_WIDTH,
            },
          ]}
        >
          {/* Hero image with camera framing */}
          {heroArtUrl ? (
            <Image
              source={{ uri: heroArtUrl }}
              style={styles.heroImage}
              resizeMode="contain"
            />
          ) : (
            // Placeholder fallback with hero initial
            <View style={styles.heroPlaceholder}>
              <LinearGradient
                colors={[COLORS.navy.medium, COLORS.navy.dark]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.heroInitial}>{heroData.name?.charAt(0) || '?'}</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
      
      {/* LAYER 4: Parallax foreground accents (future: cloth, hair tips) */}
      {/* Currently empty - reserved for future phases */}
      <View style={styles.parallaxLayer} pointerEvents="none" />
      
      {/* LAYER 5: UI chrome */}
      <SafeAreaView style={styles.uiLayer} edges={['top', 'bottom']}>
        {/* Top safe zone (HUD) */}
        <View style={styles.topZone}>
          {/* Back button */}
          <Pressable
            style={styles.headerBackButton}
            onPress={handleBack}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
          </Pressable>
          
          {/* Hero name + rarity */}
          <View style={styles.heroInfo}>
            <Text style={styles.heroName} numberOfLines={1}>{heroData.name}</Text>
            {renderRarityStars(heroData.rarity)}
          </View>
          
          {/* Affinity indicator (optional) */}
          {(hero.affinity_level ?? 0) > 0 && (
            <View style={styles.affinityBadge}>
              <Ionicons name="heart" size={14} color={COLORS.gold.light} />
              <Text style={styles.affinityText}>{hero.affinity_level}</Text>
            </View>
          )}
        </View>
        
        {/* Bottom safe zone (actions) */}
        <View style={styles.bottomZone}>
          {/* Power display (single stat only) */}
          {heroPower > 0 && (
            <View style={styles.powerDisplay}>
              <Ionicons name="flash" size={14} color={COLORS.gold.medium} />
              <Text style={styles.powerValue}>{heroPower.toLocaleString()}</Text>
            </View>
          )}
          
          {/* Actions row: Upgrade (primary), Bond (secondary), Equip (tertiary), Skins (disabled) */}
          <View style={styles.actionsRow}>
            {/* Primary: Upgrade */}
            <Pressable
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={handleUpgrade}
            >
              <Ionicons name="arrow-up-circle" size={20} color={COLORS.navy.darkest} />
              <Text style={[styles.actionText, styles.actionTextPrimary]}>Upgrade</Text>
            </Pressable>
            
            {/* Secondary: Bond */}
            <Pressable
              style={styles.actionButton}
              onPress={handleBond}
            >
              <Ionicons name="heart-outline" size={20} color={COLORS.cream.pure} />
              <Text style={styles.actionText}>Bond</Text>
            </Pressable>
            
            {/* Tertiary: Equip */}
            <Pressable
              style={styles.actionButton}
              onPress={handleEquip}
            >
              <Ionicons name="shirt-outline" size={20} color={COLORS.cream.pure} />
              <Text style={styles.actionText}>Equip</Text>
            </Pressable>
            
            {/* Optional: Skins (disabled/coming soon) */}
            <Pressable
              style={[styles.actionButton, styles.actionButtonDisabled]}
              disabled
            >
              <Ionicons name="color-palette-outline" size={18} color={COLORS.cream.dark} />
              <Text style={[styles.actionText, styles.actionTextDisabled]}>Skins</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  
  // Error
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
  
  // Layer 1: Background
  backgroundArt: {
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.navy.darkest,
    opacity: 0.4,
  },
  
  // Layer 3: Hero
  heroLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: HERO_STAGE.TOP_SAFE,
    paddingBottom: HERO_STAGE.BOTTOM_SAFE,
    paddingHorizontal: HERO_STAGE.SIDE_PADDING,
  },
  heroContainer: {
    width: '85%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: 200,
    height: 280,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroInitial: {
    fontSize: 72,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.cream.dark,
    opacity: 0.5,
  },
  
  // Layer 4: Parallax (reserved)
  parallaxLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  
  // Layer 5: UI Chrome
  uiLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  
  // Top zone (HUD)
  topZone: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HERO_STAGE.SIDE_PADDING,
    paddingTop: 8,
    gap: 12,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy.dark + '90',
    borderRadius: 20,
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.cream.pure,
    letterSpacing: 0.5,
  },
  rarityStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  affinityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.navy.dark + '90',
    borderRadius: 12,
  },
  affinityText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.light,
  },
  
  // Bottom zone (actions)
  bottomZone: {
    paddingHorizontal: HERO_STAGE.SIDE_PADDING,
    paddingBottom: LAYOUT.BOTTOM_GUTTER,
    gap: 12,
  },
  powerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  powerValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.medium,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
    backgroundColor: COLORS.navy.dark + 'D0',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.gold.primary,
    borderColor: COLORS.gold.dark,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.navy.dark + '60',
    borderColor: 'transparent',
    opacity: 0.6,
  },
  actionText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
  },
  actionTextPrimary: {
    color: COLORS.navy.darkest,
    fontWeight: FONT_WEIGHT.semibold,
  },
  actionTextDisabled: {
    color: COLORS.cream.dark,
  },
});
