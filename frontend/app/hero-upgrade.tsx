import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGameStore } from '../stores/gameStore';
import { isErrorHandledGlobally } from '../lib/api';
import { useEntitlementStore } from '../stores/entitlementStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

// Centralized API wrappers (no raw fetch in screens)
import { getHeroDetails, levelUpHero as apiLevelUpHero, promoteHeroStar, awakenHero as apiAwakenHero } from '../lib/api';

// CANONICAL premium cinematic bonus
import { premiumCinematicOwnershipBonus } from '../lib/combatBonuses';
import { hasHeroPremiumCinematicOwned } from '../lib/cinematicsAccess';

// Centralized tier logic (single source of truth for star/tier calculations)
import { MAX_STAR_TIER, displayStars, starsSuffix } from '../lib/progression';

export default function HeroUpgradeScreen() {
  const { heroId } = useLocalSearchParams<{ heroId: string }>();
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  // Subscribe to entitlements for reactive bonus updates
  const entitlements = useEntitlementStore(s => s.entitlements);
  const [heroDetails, setHeroDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'stats' | 'skills' | 'awaken'>('stats');

  useEffect(() => {
    if (heroId && user) {
      loadHeroDetails();
    }
  }, [heroId, user]);

  const loadHeroDetails = async () => {
    setIsLoading(true);
    try {
      // Use centralized API wrapper
      const data = await getHeroDetails(heroId || '', user?.username || '');
      setHeroDetails(data);
    } catch (error) {
      console.error('Failed to load hero details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const levelUpHero = async (levels: number = 1) => {
    setIsUpgrading(true);
    try {
      // Use centralized API wrapper
      const result = await apiLevelUpHero(heroId || '', user?.username || '', levels);
      Alert.alert(
        'Level Up!',
        `Hero leveled up to Lv.${result.new_level}\nGold spent: ${result.gold_spent.toLocaleString()}`
      );
      loadHeroDetails();
      fetchUser();
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Error', error?.message || 'Failed to level up');
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  const promoteHeroStarLocal = async () => {
    setIsUpgrading(true);
    try {
      // Use centralized API wrapper
      const result = await promoteHeroStar(heroId || '', user?.username || '');
      Alert.alert(
        'Star Promotion!',
        `Hero promoted to ${result.new_stars}★\nShards used: ${result.shards_used}`
      );
      loadHeroDetails();
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Error', error?.message || 'Failed to promote');
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  const awakenHero = async () => {
    setIsUpgrading(true);
    try {
      // Use centralized API wrapper
      const result = await apiAwakenHero(heroId || '', user?.username || '');
      Alert.alert(
        'Awakening Complete!',
        `Hero awakened to level ${result.new_awakening_level}!\nShards used: ${result.shards_used}\nGold used: ${result.gold_used.toLocaleString()}`
      );
      loadHeroDetails();
      fetchUser();
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Error', error?.message || 'Failed to awaken');
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    return COLORS.rarity[rarity as keyof typeof COLORS.rarity] || COLORS.cream.dark;
  };

  const getClassIcon = (heroClass: string) => {
    switch (heroClass) {
      case 'Warrior': return 'shield';
      case 'Mage': return 'flame';
      case 'Archer': return 'locate';
      default: return 'person';
    }
  };

  const getElementColor = (element: string) => {
    switch (element) {
      case 'Fire': return '#FF6B35';
      case 'Water': return '#4A90D9';
      case 'Earth': return '#8B7355';
      case 'Wind': return '#7CCD7C';
      case 'Light': return COLORS.gold.primary;
      case 'Dark': return '#9B30FF';
      default: return COLORS.cream.soft;
    }
  };

  const renderStars = (count: number, max: number = 6) => {
    return (
      <View style={styles.starsContainer}>
        {Array.from({ length: max }).map((_, i) => (
          <Ionicons
            key={i}
            name={i < count ? 'star' : 'star-outline'}
            size={20}
            color={i < count ? COLORS.gold.primary : COLORS.navy.light}
          />
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading hero...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!heroDetails) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Hero not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const heroData = heroDetails.hero_data;
  const stats = heroDetails.calculated_stats;
  
  // Apply premium cinematic bonus to display stats
  const actualHeroId = heroDetails?.hero_id || heroDetails?.user_hero?.hero_id || heroId || '';
  const owned = hasHeroPremiumCinematicOwned(actualHeroId);
  const bonus = premiumCinematicOwnershipBonus(owned);
  const displayHp = Math.floor((stats?.hp ?? 0) * bonus.hpMult);
  const displayAtk = Math.floor((stats?.atk ?? 0) * bonus.atkMult);

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          
          {/* Hero Header */}
          <LinearGradient
            colors={[getRarityColor(heroData?.rarity) + '40', COLORS.navy.dark]}
            style={styles.heroHeader}
          >
            <Image
              source={{ uri: heroData?.image_url }}
              style={styles.heroImage}
            />
            <View style={styles.heroTitleSection}>
              <Text style={[styles.heroName, { color: getRarityColor(heroData?.rarity) }]}>
                {heroData?.name}
              </Text>
              <View style={styles.heroBadges}>
                <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(heroData?.rarity) }]}>
                  <Text style={styles.rarityText}>{heroData?.rarity}</Text>
                </View>
                <View style={[styles.classBadge, { backgroundColor: COLORS.navy.medium }]}>
                  <Ionicons name={getClassIcon(heroData?.hero_class) as any} size={14} color={COLORS.gold.light} />
                  <Text style={styles.classText}>{heroData?.hero_class}</Text>
                </View>
                <View style={[styles.elementBadge, { backgroundColor: getElementColor(heroData?.element) + '40' }]}>
                  <Text style={[styles.elementText, { color: getElementColor(heroData?.element) }]}>
                    {heroData?.element}
                  </Text>
                </View>
              </View>
              
              <View style={styles.levelSection}>
                <Text style={styles.levelLabel}>Level</Text>
                <Text style={styles.levelValue}>{heroDetails.level}</Text>
                <Text style={styles.levelMax}>/ {heroDetails.max_level}</Text>
              </View>
              
              {renderStars(heroDetails.stars || 0)}
              
              {heroDetails.awakening_level > 0 && (
                <View style={styles.awakeningBadge}>
                  <Text style={styles.awakeningText}>⚡ Awakened Lv.{heroDetails.awakening_level}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
          
          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            {(['stats', 'skills', 'awaken'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, selectedTab === tab && styles.tabActive]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Stats Tab */}
          {selectedTab === 'stats' && (
            <View style={styles.tabContent}>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="heart" size={24} color="#FF6B6B" />
                  <Text style={styles.statValue}>{displayHp.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>HP{owned ? ' +10%' : ''}</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="flash" size={24} color="#FF9F43" />
                  <Text style={styles.statValue}>{displayAtk.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>ATK{owned ? ' +5%' : ''}</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="shield" size={24} color="#54A0FF" />
                  <Text style={styles.statValue}>{stats?.def?.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>DEF</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="speedometer" size={24} color="#5F27CD" />
                  <Text style={styles.statValue}>{stats?.speed}</Text>
                  <Text style={styles.statLabel}>SPD</Text>
                </View>
              </View>
              
              {/* Level Up Section */}
              <View style={styles.upgradeSection}>
                <Text style={styles.upgradeTitle}>Level Up</Text>
                <View style={styles.upgradeInfo}>
                  <Text style={styles.upgradeInfoText}>
                    Cost: {heroDetails.level_up_cost?.toLocaleString()} Gold
                  </Text>
                  <Text style={styles.upgradeInfoText}>
                    Your Gold: {user?.gold?.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.levelButtons}>
                  <TouchableOpacity
                    style={styles.levelButton}
                    onPress={() => levelUpHero(1)}
                    disabled={isUpgrading || heroDetails.level >= heroDetails.max_level}
                  >
                    <LinearGradient
                      colors={[COLORS.gold.primary, COLORS.gold.dark]}
                      style={styles.levelButtonGradient}
                    >
                      {isUpgrading ? (
                        <ActivityIndicator color={COLORS.navy.darkest} size="small" />
                      ) : (
                        <Text style={styles.levelButtonText}>+1 Level</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.levelButton}
                    onPress={() => levelUpHero(10)}
                    disabled={isUpgrading || heroDetails.level >= heroDetails.max_level}
                  >
                    <LinearGradient
                      colors={[COLORS.rarity.SSR, COLORS.rarity.UR]}
                      style={styles.levelButtonGradient}
                    >
                      <Text style={styles.levelButtonText}>+10 Levels</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Star Promotion Section */}
              <View style={styles.upgradeSection}>
                <Text style={styles.upgradeTitle}>Star Promotion</Text>
                <View style={styles.upgradeInfo}>
                  <Text style={styles.upgradeInfoText}>
                    Shards Needed: {heroDetails.shards_for_next_star}
                  </Text>
                  <Text style={styles.upgradeInfoText}>
                    Your Shards: {heroDetails.duplicates || 0}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.promoteButton}
                  onPress={promoteHeroStarLocal}
                  disabled={isUpgrading || (heroDetails.duplicates || 0) < heroDetails.shards_for_next_star || displayStars(heroDetails) >= MAX_STAR_TIER}
                >
                  <LinearGradient
                    colors={[COLORS.gold.primary, COLORS.gold.dark]}
                    style={styles.promoteButtonGradient}
                  >
                    {isUpgrading ? (
                      <ActivityIndicator color={COLORS.navy.darkest} size="small" />
                    ) : (
                      <>
                        <Ionicons name="star" size={20} color={COLORS.navy.darkest} />
                        <Text style={styles.promoteButtonText}>Promote to {displayStars(heroDetails) + 1}★</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Skills Tab */}
          {selectedTab === 'skills' && (
            <View style={styles.tabContent}>
              {heroData?.skills?.map((skill: any, index: number) => {
                const isUnlocked = heroDetails.level >= skill.unlock_level && 
                                   (heroDetails.stars || 0) >= skill.unlock_stars;
                return (
                  <View 
                    key={skill.id || index} 
                    style={[styles.skillCard, !isUnlocked && styles.skillCardLocked]}
                  >
                    <View style={styles.skillHeader}>
                      <View style={[
                        styles.skillIcon,
                        { backgroundColor: skill.skill_type === 'passive' ? COLORS.rarity.SSR : COLORS.rarity.UR }
                      ]}>
                        <Ionicons 
                          name={skill.skill_type === 'passive' ? 'infinite' : 'flash'} 
                          size={20} 
                          color={COLORS.cream.pure} 
                        />
                      </View>
                      <View style={styles.skillInfo}>
                        <Text style={styles.skillName}>{skill.name}</Text>
                        <Text style={styles.skillType}>
                          {skill.skill_type === 'passive' ? 'Passive' : `Active • ${skill.cooldown} turn CD`}
                        </Text>
                      </View>
                      {!isUnlocked && (
                        <View style={styles.lockBadge}>
                          <Ionicons name="lock-closed" size={14} color={COLORS.cream.dark} />
                          <Text style={styles.lockText}>
                            Lv.{skill.unlock_level}{starsSuffix(skill.unlock_stars)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.skillDesc, !isUnlocked && styles.skillDescLocked]}>
                      {skill.description}
                    </Text>
                    {skill.damage_multiplier > 1 && (
                      <Text style={styles.skillDamage}>
                        Damage: {(skill.damage_multiplier * 100).toFixed(0)}%
                      </Text>
                    )}
                    {skill.buff_percent > 0 && (
                      <Text style={styles.skillBuff}>
                        +{(skill.buff_percent * 100).toFixed(0)}% {skill.buff_type?.toUpperCase()}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          
          {/* Awaken Tab */}
          {selectedTab === 'awaken' && (
            <View style={styles.tabContent}>
              <LinearGradient
                colors={[COLORS.rarity['UR+'], COLORS.rarity.UR]}
                style={styles.awakenCard}
              >
                <Text style={styles.awakenTitle}>Awakening</Text>
                <Text style={styles.awakenLevel}>Current Level: {heroDetails.awakening_level || 0} / 5</Text>
                <Text style={styles.awakenDesc}>
                  Awakening unlocks your hero's true potential, granting massive stat bonuses.
                  Each awakening level provides +20% to all stats.
                </Text>
                
                {heroDetails.awakening_level < 5 && (
                  <View style={styles.awakenCosts}>
                    <Text style={styles.awakenCostTitle}>Requirements for Level {(heroDetails.awakening_level || 0) + 1}:</Text>
                    <Text style={styles.awakenCostItem}>
                      • {[50, 100, 200, 400, 800][heroDetails.awakening_level || 0]} Shards 
                      (Have: {heroDetails.duplicates || 0})
                    </Text>
                    <Text style={styles.awakenCostItem}>
                      • {[10000, 25000, 50000, 100000, 250000][heroDetails.awakening_level || 0].toLocaleString()} Gold 
                      (Have: {user?.gold?.toLocaleString()})
                    </Text>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.awakenButton}
                  onPress={awakenHero}
                  disabled={isUpgrading || heroDetails.awakening_level >= 5}
                >
                  {isUpgrading ? (
                    <ActivityIndicator color={COLORS.cream.pure} />
                  ) : (
                    <>
                      <Ionicons name="flash" size={24} color={COLORS.cream.pure} />
                      <Text style={styles.awakenButtonText}>
                        {heroDetails.awakening_level >= 5 ? 'Max Awakening' : 'Awaken Hero'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </LinearGradient>
              
              <View style={styles.awakenBonuses}>
                <Text style={styles.bonusTitle}>Awakening Bonuses</Text>
                {[1, 2, 3, 4, 5].map((level) => (
                  <View 
                    key={level} 
                    style={[
                      styles.bonusRow,
                      level <= (heroDetails.awakening_level || 0) && styles.bonusRowActive
                    ]}
                  >
                    <Text style={styles.bonusLevel}>Lv.{level}</Text>
                    <Text style={styles.bonusDesc}>+{level * 20}% All Stats</Text>
                    <Ionicons 
                      name={level <= (heroDetails.awakening_level || 0) ? 'checkmark-circle' : 'ellipse-outline'} 
                      size={20} 
                      color={level <= (heroDetails.awakening_level || 0) ? COLORS.success : COLORS.navy.light} 
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  backButton: { position: 'absolute', top: 50, left: 16, zIndex: 1, padding: 8 },
  heroHeader: { borderRadius: 16, padding: 16, flexDirection: 'row', marginBottom: 16 },
  heroImage: { width: 120, height: 120, borderRadius: 12, borderWidth: 2, borderColor: COLORS.gold.dark },
  heroTitleSection: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  heroName: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  rarityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  rarityText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  classBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, gap: 4 },
  classText: { fontSize: 10, color: COLORS.cream.soft },
  elementBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  elementText: { fontSize: 10, fontWeight: 'bold' },
  levelSection: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  levelLabel: { fontSize: 12, color: COLORS.cream.dark, marginRight: 4 },
  levelValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary },
  levelMax: { fontSize: 12, color: COLORS.cream.dark },
  starsContainer: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  awakeningBadge: { backgroundColor: COLORS.rarity['UR+'] + '40', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  awakeningText: { fontSize: 12, color: COLORS.rarity['UR+'], fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.gold.primary },
  tabText: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.soft },
  tabTextActive: { color: COLORS.navy.darkest },
  tabContent: {},
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { width: '47%', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  statLabel: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
  upgradeSection: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  upgradeTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  upgradeInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  upgradeInfoText: { fontSize: 12, color: COLORS.cream.dark },
  levelButtons: { flexDirection: 'row', gap: 12 },
  levelButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  levelButtonGradient: { padding: 12, alignItems: 'center' },
  levelButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.navy.darkest },
  promoteButton: { borderRadius: 10, overflow: 'hidden' },
  promoteButtonGradient: { flexDirection: 'row', padding: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  promoteButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.navy.darkest },
  skillCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  skillCardLocked: { opacity: 0.5 },
  skillHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  skillIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  skillInfo: { flex: 1, marginLeft: 12 },
  skillName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  skillType: { fontSize: 12, color: COLORS.cream.dark },
  lockBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.dark, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  lockText: { fontSize: 10, color: COLORS.cream.dark },
  skillDesc: { fontSize: 14, color: COLORS.cream.soft, lineHeight: 20 },
  skillDescLocked: { color: COLORS.cream.dark },
  skillDamage: { fontSize: 12, color: COLORS.rarity.UR, marginTop: 8, fontWeight: 'bold' },
  skillBuff: { fontSize: 12, color: COLORS.success, marginTop: 4, fontWeight: 'bold' },
  awakenCard: { borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
  awakenTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  awakenLevel: { fontSize: 16, color: COLORS.cream.soft, marginBottom: 12 },
  awakenDesc: { fontSize: 14, color: COLORS.cream.soft, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  awakenCosts: { backgroundColor: COLORS.navy.darkest + '60', borderRadius: 12, padding: 16, width: '100%', marginBottom: 16 },
  awakenCostTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  awakenCostItem: { fontSize: 13, color: COLORS.cream.soft, marginBottom: 4 },
  awakenButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.darkest, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, gap: 8 },
  awakenButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  awakenBonuses: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  bonusTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.navy.light + '30' },
  bonusRowActive: { backgroundColor: COLORS.success + '20', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8 },
  bonusLevel: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, width: 50 },
  bonusDesc: { flex: 1, fontSize: 14, color: COLORS.cream.soft },
  loadingText: { color: COLORS.cream.soft, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center', marginBottom: 16 },
  backLink: { color: COLORS.gold.primary, fontSize: 16 },
});
