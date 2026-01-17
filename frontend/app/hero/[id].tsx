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
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../components/ui/tokens';

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

/**
 * Hero Visual Layer Stack (locked order):
 * 1. Background art (static)
 * 2. Atmospheric overlay (very light)
 * 3. Hero silhouette / model (centered)
 * 4. Parallax foreground accents (future: cloth, hair)
 * 5. UI chrome (top stats, bottom actions)
 */

export default function HeroPresentationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hydrated = useHydration();
  const { user, getUserHeroById, selectUserHeroById } = useGameStore();
  
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
        // Use canonical selector pattern
        const userHero = await selectUserHeroById(id);
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
  }, [hydrated, user, id, selectUserHeroById]);
  
  // Resolve tier art
  const tier = useMemo(() => {
    if (!hero) return 1 as DisplayTier;
    return effectiveTierForHero(hero);
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
  
  // Camera animation (static for now - will animate in future phases)
  const cameraTransform = getCameraTransform(cameraMode);
  
  // Handle back navigation
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
          />
        ) : (
          <Image
            source={require('../../assets/backgrounds/sanctum_environment_01.jpg')}
            style={styles.backgroundArt}
            resizeMode="cover"
          />
        )}
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
            },
          ]}
        >
          {/* Hero image with camera framing */}
          {heroArtUrl && (
            <Image
              source={{ uri: heroArtUrl }}
              style={styles.heroImage}
              resizeMode="contain"
            />
          )}
        </Animated.View>
      </Pressable>
      
      {/* LAYER 4: Parallax foreground accents (future: cloth, hair tips) */}
      {/* Currently empty - reserved for future phases */}
      <View style={styles.parallaxLayer} pointerEvents="none" />
      
      {/* LAYER 5: UI chrome */}
      <SafeAreaView style={styles.uiLayer} edges={['top', 'bottom']}>
        {/* Top stats zone */}
        <View style={styles.topZone}>
          {/* Back button */}
          <Pressable
            style={styles.headerBackButton}
            onPress={handleBack}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
          </Pressable>
          
          {/* Hero name + tier */}
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{heroData.name}</Text>
            <Text style={styles.heroMeta}>
              {heroData.rarity} • Tier {tier}
            </Text>
          </View>
          
          {/* Affinity indicator */}
          <View style={styles.affinityBadge}>
            <Ionicons name="heart" size={14} color={COLORS.gold.light} />
            <Text style={styles.affinityText}>{hero.affinity_level || 0}</Text>
          </View>
        </View>
        
        {/* Bottom actions zone */}
        <View style={styles.bottomZone}>
          {/* Action buttons (future: upgrade, gift, etc.) */}
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                haptic('light');
                router.push(`/hero-detail?id=${id}`);
              }}
            >
              <Ionicons name="stats-chart" size={20} color={COLORS.cream.pure} />
              <Text style={styles.actionText}>Stats</Text>
            </Pressable>
            
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                haptic('light');
                router.push(`/hero-upgrade?id=${id}`);
              }}
            >
              <Ionicons name="arrow-up-circle" size={20} color={COLORS.cream.pure} />
              <Text style={styles.actionText}>Upgrade</Text>
            </Pressable>
            
            <Pressable
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={() => {
                haptic('medium');
                // Future: Gift interaction
              }}
            >
              <Ionicons name="gift" size={20} color={COLORS.navy.darkest} />
              <Text style={[styles.actionText, styles.actionTextPrimary]}>Gift</Text>
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
    opacity: 0.4, // Dim for focus on hero
  },
  
  // Layer 3: Hero
  heroLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContainer: {
    width: '80%',
    height: '70%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  
  // Layer 4: Parallax (reserved)
  parallaxLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  
  // Layer 5: UI
  uiLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  
  // Top zone
  topZone: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingTop: 8,
    gap: 12,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy.dark + '80',
    borderRadius: 20,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.cream.pure,
    letterSpacing: 0.5,
  },
  heroMeta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    marginTop: 2,
  },
  affinityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.navy.dark + '80',
    borderRadius: 12,
  },
  affinityText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.light,
  },
  
  // Bottom zone
  bottomZone: {
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingBottom: LAYOUT.BOTTOM_GUTTER,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  actionText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
  },
  actionTextPrimary: {
    color: COLORS.navy.darkest,
  },
});
