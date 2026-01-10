import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { router, useLocalSearchParams } from 'expo-router';
import HeroCinematicModal from '../components/HeroCinematicModal';
import { getHeroCinematicVideo, heroNameToId, VIDEOS_AVAILABLE } from '../constants/heroCinematics';

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

export default function HeroDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  const [hero, setHero] = useState<any>(null);
  const [heroData, setHeroData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'skills' | 'equip'>('stats');
  
  // 5+ Star Cinematic Modal State
  const [showCinematicModal, setShowCinematicModal] = useState(false);
  const [cinematicVideoSource, setCinematicVideoSource] = useState<any>(null);

  // Check if hero is at 5+ star (final ascension)
  const isFivePlusStar = useCallback(() => {
    if (!hero) return false;
    // 5+ star is typically star_level >= 6 in most gacha games
    // Adjust this condition based on your game's progression system
    return (hero.star_level || 0) >= 6;
  }, [hero]);

  // Check if hero is UR or UR+ (for preview button visibility)
  const isHighRarity = useCallback(() => {
    if (!heroData) return false;
    return heroData.rarity === 'UR' || heroData.rarity === 'UR+';
  }, [heroData]);

  // Handle tap on hero portrait for 5+ cinematic
  const handlePortraitTap = useCallback(() => {
    if (!heroData) return;
    
    // Only trigger cinematic for 5+ star heroes
    if (!isFivePlusStar()) {
      return; // Do nothing for non-5+ star heroes
    }
    
    const heroId = heroNameToId(heroData.name);
    const videoSource = getHeroCinematicVideo(heroId);
    
    if (videoSource) {
      setCinematicVideoSource(videoSource);
      setShowCinematicModal(true);
    } else {
      // Fail safe: do nothing if video doesn't exist
      if (__DEV__) {
        console.log(`[HeroDetail] No cinematic video for ${heroId} at 5+ star`);
      }
    }
  }, [heroData, isFivePlusStar]);

  // Handle preview button tap (for UR/UR+ heroes not yet at 5+)
  const handlePreview5PlusCinematic = useCallback(() => {
    if (!heroData) return;
    
    const heroId = heroNameToId(heroData.name);
    const videoSource = getHeroCinematicVideo(heroId);
    
    if (videoSource) {
      setCinematicVideoSource(videoSource);
      setShowCinematicModal(true);
    } else {
      // Fail safe: show message in DEV, do nothing in PROD
      if (__DEV__) {
        console.log(`[HeroDetail] Preview: No cinematic video available for ${heroId}`);
      }
    }
  }, [heroData]);

  // Close cinematic modal
  const handleCloseCinematic = useCallback(() => {
    setShowCinematicModal(false);
    setCinematicVideoSource(null);
  }, []);

  useEffect(() => {
    if (hydrated && user && id) {
      loadHeroData();
    }
  }, [hydrated, user, id]);

  const loadHeroData = async () => {
    try {
      // Load user hero data
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user/${user?.username}/heroes`
      );
      if (response.ok) {
        const heroes = await response.json();
        const userHero = heroes.find((h: any) => h.id === id);
        if (userHero) {
          setHero(userHero);
          setHeroData(userHero.hero_data);
        }
      }
    } catch (error) {
      console.error('Failed to load hero:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRarityGradient = (rarity: string): [string, string] => {
    const color = RARITY_COLORS[rarity] || RARITY_COLORS['N'];
    return [color, `${color}88`];
  };

  if (!hydrated || isLoading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!hero || !heroData) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.gold.primary} />
          <Text style={styles.errorText}>Hero not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const rarityColor = RARITY_COLORS[heroData.rarity] || RARITY_COLORS['N'];

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.title}>Hero Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Portrait - Tappable for 5+ Star Cinematic */}
          <TouchableOpacity 
            style={styles.portraitContainer}
            onPress={handlePortraitTap}
            activeOpacity={isFivePlusStar() ? 0.8 : 1}
          >
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
              
              {/* Hero image - Static */}
              <View style={styles.heroImageContainer}>
                {heroData.image_url ? (
                  <Image
                    source={{ uri: heroData.image_url }}
                    style={{ width: 200, height: 280 }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Image
                      source={require('../assets/images/icon.png')}
                      style={{ width: 120, height: 120 }}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </View>
              
              {/* 5+ Star Indicator - shows when hero is at max ascension */}
              {isFivePlusStar() && (
                <View style={styles.fivePlusIndicator}>
                  <Ionicons name="play-circle" size={20} color={COLORS.cream.pure} />
                  <Text style={styles.fivePlusIndicatorText}>Tap for Cinematic</Text>
                </View>
              )}
              
              {/* Rarity Badge */}
              <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
                <Text style={styles.rarityText}>{heroData.rarity}</Text>
              </View>
              
              {/* Star Level */}
              <View style={styles.starsContainer}>
                {Array.from({ length: hero.star_level || 1 }).map((_, i) => (
                  <Ionicons key={i} name="star" size={16} color={COLORS.gold.primary} />
                ))}
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Hero Name & Class */}
          <View style={styles.nameContainer}>
            <Text style={styles.heroName}>{heroData.name}</Text>
            <View style={styles.classTag}>
              <Ionicons 
                name={CLASS_ICONS[heroData.hero_class] as any || 'person'} 
                size={14} 
                color={COLORS.cream.soft} 
              />
              <Text style={styles.classText}>{heroData.hero_class}</Text>
            </View>
            <Text style={styles.elementText}>Element: {heroData.element}</Text>
          </View>

          {/* Level & XP */}
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
                  size={18} 
                  color={activeTab === tab ? COLORS.navy.darkest : COLORS.cream.soft} 
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          {activeTab === 'stats' && (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="heart" size={24} color="#e74c3c" />
                <Text style={styles.statValue}>{hero.current_hp?.toLocaleString() || heroData.base_hp}</Text>
                <Text style={styles.statLabel}>HP</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="flash" size={24} color="#f39c12" />
                <Text style={styles.statValue}>{hero.current_atk?.toLocaleString() || heroData.base_atk}</Text>
                <Text style={styles.statLabel}>ATK</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="shield" size={24} color="#3498db" />
                <Text style={styles.statValue}>{hero.current_def?.toLocaleString() || heroData.base_def}</Text>
                <Text style={styles.statLabel}>DEF</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="speedometer" size={24} color="#9b59b6" />
                <Text style={styles.statValue}>{heroData.base_speed || 100}</Text>
                <Text style={styles.statLabel}>SPD</Text>
              </View>
            </View>
          )}

          {activeTab === 'skills' && (
            <View style={styles.skillsList}>
              {(heroData.skills && heroData.skills.length > 0) ? heroData.skills.map((skill: any, idx: number) => (
                <View key={idx} style={styles.skillCard}>
                  <View style={[styles.skillIcon, skill.skill_type === 'passive' && styles.skillIconPassive]}>
                    <Ionicons 
                      name={skill.skill_type === 'passive' ? 'sparkles' : 'flash'} 
                      size={20} 
                      color={skill.skill_type === 'passive' ? '#9b59b6' : COLORS.gold.primary} 
                    />
                  </View>
                  <View style={styles.skillInfo}>
                    <View style={styles.skillHeader}>
                      <Text style={styles.skillName}>{skill.name}</Text>
                      <View style={[styles.skillTypeBadge, skill.skill_type === 'passive' && styles.skillTypeBadgePassive]}>
                        <Text style={styles.skillTypeText}>{skill.skill_type?.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.skillDesc}>{skill.description}</Text>
                    {skill.damage_multiplier && skill.damage_multiplier > 0 && (
                      <View style={styles.skillStats}>
                        <Text style={styles.skillStatText}>DMG: {(skill.damage_multiplier * 100).toFixed(0)}%</Text>
                        {skill.cooldown > 0 && <Text style={styles.skillStatText}>CD: {skill.cooldown} turns</Text>}
                      </View>
                    )}
                    {skill.buff_type && (
                      <View style={styles.skillStats}>
                        <Text style={styles.skillStatText}>Buff: +{(skill.buff_percent * 100).toFixed(0)}% {skill.buff_type.toUpperCase()}</Text>
                      </View>
                    )}
                    {skill.heal_percent > 0 && (
                      <View style={styles.skillStats}>
                        <Text style={[styles.skillStatText, { color: '#2ecc71' }]}>Heal: {(skill.heal_percent * 100).toFixed(0)}%</Text>
                      </View>
                    )}
                    <Text style={styles.skillUnlock}>
                      {skill.unlock_level > 1 ? `Unlock at Lv.${skill.unlock_level}` : 
                       skill.unlock_stars > 0 ? `Unlock at ${skill.unlock_stars}★` : 'Available'}
                    </Text>
                  </View>
                </View>
              )) : (
                <View style={styles.noSkillsContainer}>
                  <Ionicons name="flash-off" size={32} color={COLORS.navy.light} />
                  <Text style={styles.noSkillsText}>No skills data available</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'equip' && (
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
                    size={28} 
                    color={COLORS.navy.light} 
                  />
                  <Text style={styles.equipSlotName}>{slot}</Text>
                  <Text style={styles.equipEmpty}>Empty</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Description */}
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>Biography</Text>
            <Text style={styles.descriptionText}>
              {heroData.description || `A powerful ${heroData.hero_class} with the element of ${heroData.element}.`}
            </Text>
          </View>

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
                <Ionicons name="arrow-up" size={20} color={COLORS.navy.darkest} />
                <Text style={styles.upgradeText}>Level Up</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.promoteButton}
              onPress={() => router.push(`/hero-progression?heroId=${id}`)}
            >
              <Ionicons name="star" size={20} color={COLORS.gold.primary} />
              <Text style={styles.promoteText}>⭐ Stars</Text>
            </TouchableOpacity>
          </View>

          {/* Preview 5+ Cinematic Button - Only for UR/UR+ heroes not yet at 5+ star */}
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
                <Ionicons name="play-circle" size={20} color={COLORS.cream.pure} />
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
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  placeholder: { width: 40 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 100 },
  
  // Portrait
  portraitContainer: { alignItems: 'center', marginBottom: 16 },
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
    width: 200, 
    height: 280, 
    alignItems: 'center', 
    justifyContent: 'center',
    zIndex: 1,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 60,
  },
  rarityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rarityText: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.pure },
  starsContainer: { 
    flexDirection: 'row', 
    marginTop: 8,
    zIndex: 1,
  },
  
  // Name
  nameContainer: { alignItems: 'center', marginBottom: 16 },
  heroName: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 4 },
  classTag: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: COLORS.navy.medium, 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 12,
    marginBottom: 4,
  },
  classText: { fontSize: 12, color: COLORS.cream.soft },
  elementText: { fontSize: 12, color: COLORS.cream.dark },
  
  // Level Card
  levelCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16 
  },
  levelInfo: { alignItems: 'center', width: 60 },
  levelLabel: { fontSize: 10, color: COLORS.cream.dark },
  levelValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary },
  xpBar: { 
    flex: 1, 
    height: 8, 
    backgroundColor: COLORS.navy.darkest, 
    borderRadius: 4, 
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', backgroundColor: COLORS.gold.primary, borderRadius: 4 },
  
  // Tabs
  tabBar: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    padding: 4, 
    marginBottom: 16 
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: 8, 
    gap: 6 
  },
  tabActive: { backgroundColor: COLORS.gold.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.cream.soft },
  tabTextActive: { color: COLORS.navy.darkest },
  
  // Stats Grid
  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    marginBottom: 16 
  },
  statCard: { 
    flex: 1, 
    minWidth: '45%', 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    padding: 16, 
    alignItems: 'center' 
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  statLabel: { fontSize: 12, color: COLORS.cream.dark },
  
  // Skills
  skillsList: { gap: 12, marginBottom: 16 },
  skillCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    padding: 12 
  },
  skillIcon: { 
    width: 40, 
    height: 40, 
    backgroundColor: COLORS.navy.darkest, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  skillIconPassive: {
    backgroundColor: '#9b59b620',
    borderWidth: 1,
    borderColor: '#9b59b6',
  },
  skillInfo: { flex: 1, marginLeft: 12 },
  skillHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  skillName: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure },
  skillTypeBadge: { backgroundColor: COLORS.gold.dark, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  skillTypeBadgePassive: { backgroundColor: '#9b59b6' },
  skillTypeText: { fontSize: 8, fontWeight: 'bold', color: COLORS.cream.pure },
  skillDesc: { fontSize: 12, color: COLORS.cream.soft, marginBottom: 4, lineHeight: 16 },
  skillStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  skillStatText: { fontSize: 11, color: COLORS.gold.primary, fontWeight: '600' },
  skillUnlock: { fontSize: 10, color: COLORS.cream.dark, marginTop: 4 },
  skillLevel: { fontSize: 12, color: COLORS.gold.primary, fontWeight: '600' },
  noSkillsContainer: { alignItems: 'center', paddingVertical: 30 },
  noSkillsText: { fontSize: 14, color: COLORS.cream.dark, marginTop: 8 },
  
  // Equipment
  equipGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    marginBottom: 16 
  },
  equipSlot: { 
    width: '30%', 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    padding: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.navy.light,
    borderStyle: 'dashed',
  },
  equipSlotName: { fontSize: 10, color: COLORS.cream.dark, marginTop: 4 },
  equipEmpty: { fontSize: 10, color: COLORS.navy.light },
  
  // Description
  descriptionCard: { 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16 
  },
  descriptionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  descriptionText: { fontSize: 12, color: COLORS.cream.soft, lineHeight: 18 },
  
  // Actions
  actionButtons: { flexDirection: 'row', gap: 12 },
  upgradeButton: { flex: 2, borderRadius: 12, overflow: 'hidden' },
  upgradeGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 14, 
    gap: 8 
  },
  upgradeText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  promoteButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    paddingVertical: 14, 
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.gold.primary,
  },
  promoteText: { fontSize: 14, fontWeight: '600', color: COLORS.gold.primary },
  // 5+ Star Cinematic Indicator
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
    borderRadius: 16,
    marginHorizontal: 20,
  },
  fivePlusIndicatorText: {
    color: COLORS.cream.pure,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Preview 5+ Button
  preview5PlusButton: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  preview5PlusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  preview5PlusText: {
    color: COLORS.cream.pure,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  
  // Error
  errorText: { color: COLORS.cream.pure, fontSize: 18 },
  backBtn: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  backBtnText: { color: COLORS.navy.darkest, fontSize: 16, fontWeight: 'bold' },
});
