import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

export default function HeroesScreen() {
  const router = useRouter();
  const { user, userHeroes, fetchUserHeroes, isLoading } = useGameStore();
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'level' | 'rarity' | 'power'>('rarity');

  useEffect(() => {
    if (user) {
      fetchUserHeroes();
    }
  }, [user]);

  const getRarityColor = (rarity: string) => {
    return COLORS.rarity[rarity as keyof typeof COLORS.rarity] || COLORS.cream.dark;
  };

  const getRarityOrder = (rarity: string) => {
    const order = { 'N': 0, 'R': 1, 'SR': 2, 'SSR': 3, 'SSR+': 4, 'UR': 5, 'UR+': 6 };
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

  const calculatePower = (hero: any) => {
    const heroData = hero.hero_data;
    if (!heroData) return 0;
    const levelMult = 1 + (hero.level - 1) * 0.05;
    const starMult = 1 + (hero.stars || 0) * 0.1;
    const awakenMult = 1 + (hero.awakening_level || 0) * 0.2;
    return Math.floor((heroData.base_hp + heroData.base_atk * 3 + heroData.base_def * 2) * levelMult * starMult * awakenMult);
  };

  const filteredAndSortedHeroes = userHeroes
    .filter(hero => {
      if (filterRarity && hero.hero_data?.rarity !== filterRarity) return false;
      if (filterClass && hero.hero_data?.hero_class !== filterClass) return false;
      return true;
    })
    .sort((a, b) => {
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

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Heroes</Text>
          <Text style={styles.subtitle}>{userHeroes.length} Heroes Collected</Text>
        </View>

        {/* Filter Bar */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, !filterRarity && styles.filterChipActive]}
              onPress={() => setFilterRarity(null)}
            >
              <Text style={[styles.filterText, !filterRarity && styles.filterTextActive]}>All</Text>
            </TouchableOpacity>
            {RARITIES.map(rarity => (
              <TouchableOpacity
                key={rarity}
                style={[
                  styles.filterChip,
                  filterRarity === rarity && styles.filterChipActive,
                  { borderColor: getRarityColor(rarity) }
                ]}
                onPress={() => setFilterRarity(filterRarity === rarity ? null : rarity)}
              >
                <Text style={[
                  styles.filterText,
                  filterRarity === rarity && styles.filterTextActive,
                  { color: filterRarity === rarity ? COLORS.navy.darkest : getRarityColor(rarity) }
                ]}>
                  {rarity}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Class Filter */}
        <View style={styles.classFilterContainer}>
          {CLASSES.map(cls => (
            <TouchableOpacity
              key={cls}
              style={[styles.classChip, filterClass === cls && styles.classChipActive]}
              onPress={() => setFilterClass(filterClass === cls ? null : cls)}
            >
              <Ionicons 
                name={getClassIcon(cls) as any} 
                size={16} 
                color={filterClass === cls ? COLORS.navy.darkest : COLORS.gold.light} 
              />
              <Text style={[styles.classText, filterClass === cls && styles.classTextActive]}>
                {cls}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sort Options */}
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          {(['rarity', 'level', 'power'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.sortChip, sortBy === option && styles.sortChipActive]}
              onPress={() => setSortBy(option)}
            >
              <Text style={[styles.sortText, sortBy === option && styles.sortTextActive]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold.primary} />
            <Text style={styles.loadingText}>Loading heroes...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.heroesGrid}
            contentContainerStyle={styles.heroesGridContent}
          >
            <View style={styles.gridContainer}>
              {filteredAndSortedHeroes.map((hero) => {
                const heroData = hero.hero_data;
                const power = calculatePower(hero);
                
                return (
                  <TouchableOpacity
                    key={hero.id}
                    style={styles.heroCard}
                    onPress={() => router.push(`/hero-detail?id=${hero.id}`)}
                  >
                    <LinearGradient
                      colors={[getRarityColor(heroData?.rarity) + '40', COLORS.navy.dark]}
                      style={styles.heroCardGradient}
                    >
                      <Image
                        source={{ uri: heroData?.image_url }}
                        style={styles.heroImage}
                      />
                      
                      {/* Rarity Badge */}
                      <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(heroData?.rarity) }]}>
                        <Text style={styles.rarityText}>{heroData?.rarity}</Text>
                      </View>
                      
                      {/* Class Icon */}
                      <View style={styles.classIcon}>
                        <Ionicons 
                          name={getClassIcon(heroData?.hero_class) as any} 
                          size={14} 
                          color={COLORS.gold.light} 
                        />
                      </View>
                      
                      {/* Stars */}
                      {(hero.stars || 0) > 0 && (
                        <View style={styles.starsContainer}>
                          {Array.from({ length: hero.stars || 0 }).map((_, i) => (
                            <Ionicons key={i} name="star" size={10} color={COLORS.gold.primary} />
                          ))}
                        </View>
                      )}
                      
                      {/* Awakening Badge */}
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
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {filteredAndSortedHeroes.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={48} color={COLORS.navy.light} />
                <Text style={styles.emptyText}>No heroes match your filters</Text>
                <TouchableOpacity onPress={() => { setFilterRarity(null); setFilterClass(null); }}>
                  <Text style={styles.clearFilters}>Clear Filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/team-builder')}
          >
            <LinearGradient
              colors={[COLORS.gold.primary, COLORS.gold.dark]}
              style={styles.quickActionGradient}
            >
              <Ionicons name="people" size={20} color={COLORS.navy.darkest} />
              <Text style={styles.quickActionText}>Team Builder</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/summon-hub')}
          >
            <LinearGradient
              colors={[COLORS.rarity.UR, COLORS.rarity['UR+']]}
              style={styles.quickActionGradient}
            >
              <Ionicons name="sparkles" size={20} color={COLORS.cream.pure} />
              <Text style={[styles.quickActionText, { color: COLORS.cream.pure }]}>Summon</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', marginTop: 4 },
  filterContainer: { paddingHorizontal: 16, marginBottom: 8 },
  filterScroll: { flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: COLORS.navy.light, backgroundColor: COLORS.navy.medium },
  filterChipActive: { backgroundColor: COLORS.gold.primary, borderColor: COLORS.gold.primary },
  filterText: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.soft },
  filterTextActive: { color: COLORS.navy.darkest },
  classFilterContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  classChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.navy.medium, gap: 6, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  classChipActive: { backgroundColor: COLORS.gold.primary },
  classText: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.soft },
  classTextActive: { color: COLORS.navy.darkest },
  sortContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  sortLabel: { fontSize: 12, color: COLORS.cream.dark },
  sortChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: COLORS.navy.medium },
  sortChipActive: { backgroundColor: COLORS.gold.dark },
  sortText: { fontSize: 11, color: COLORS.cream.soft },
  sortTextActive: { color: COLORS.cream.pure, fontWeight: 'bold' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12, fontSize: 16 },
  heroesGrid: { flex: 1 },
  heroesGridContent: { paddingHorizontal: 12, paddingBottom: 100 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  heroCard: { width: '31%', aspectRatio: 0.75, marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  heroCardGradient: { flex: 1, padding: 6 },
  heroImage: { width: '100%', aspectRatio: 1, borderRadius: 8, borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  rarityBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rarityText: { fontSize: 8, fontWeight: 'bold', color: COLORS.cream.pure },
  classIcon: { position: 'absolute', top: 10, right: 10, backgroundColor: COLORS.navy.darkest + '80', padding: 4, borderRadius: 6 },
  starsContainer: { position: 'absolute', top: 30, left: 10, flexDirection: 'row', gap: 1 },
  awakenBadge: { position: 'absolute', bottom: 40, right: 10, backgroundColor: COLORS.rarity['UR+'], paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  awakenText: { fontSize: 8, fontWeight: 'bold', color: COLORS.cream.pure },
  heroInfo: { marginTop: 4 },
  heroName: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelText: { fontSize: 10, color: COLORS.cream.soft, fontWeight: 'bold' },
  powerText: { fontSize: 9, color: COLORS.gold.light },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.cream.dark, marginTop: 12 },
  clearFilters: { fontSize: 14, color: COLORS.gold.primary, marginTop: 8, fontWeight: 'bold' },
  quickActions: { position: 'absolute', bottom: 80, left: 16, right: 16, flexDirection: 'row', gap: 12 },
  quickActionButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  quickActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  quickActionText: { fontSize: 14, fontWeight: 'bold', color: COLORS.navy.darkest },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
