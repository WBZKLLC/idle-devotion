import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';

const RARITY_COLORS: { [key: string]: string } = {
  'SR': '#4CAF50',
  'SSR': '#9C27B0',
  'UR': '#FF9800',
  'UR+': '#F44336',
};

const ELEMENT_COLORS: { [key: string]: string } = {
  'Fire': '#FF5722',
  'Water': '#2196F3',
  'Earth': '#795548',
  'Wind': '#00BCD4',
  'Light': '#FFD700',
  'Dark': '#9C27B0',
};

export default function HeroesScreen() {
  const { user, userHeroes, fetchUserHeroes, upgradeHero, isLoading } = useGameStore();
  const [selectedHero, setSelectedHero] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserHeroes();
    }
  }, [user]);

  const handleUpgrade = async () => {
    if (!selectedHero) return;

    const duplicatesNeeded = selectedHero.rank * 2;

    if (selectedHero.rank >= 10) {
      Alert.alert('Max Rank', 'This hero is at max rank. Use Star Chart for further progression.');
      return;
    }

    if (selectedHero.duplicates < duplicatesNeeded) {
      Alert.alert(
        'Insufficient Duplicates',
        `You need ${duplicatesNeeded} duplicates to rank up. You have ${selectedHero.duplicates}.`
      );
      return;
    }

    try {
      await upgradeHero(selectedHero.id);
      Alert.alert('Success!', `${selectedHero.hero_data.name} ranked up to Rank ${selectedHero.rank + 1}!`);
      setShowDetail(false);
      await fetchUserHeroes();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to upgrade hero');
    }
  };

  const filteredHeroes = filterRarity
    ? userHeroes.filter((h) => h.hero_data?.rarity === filterRarity)
    : userHeroes;

  // Group heroes by rarity
  const groupedHeroes = filteredHeroes.reduce((acc: any, hero: any) => {
    const rarity = hero.hero_data?.rarity || 'SR';
    if (!acc[rarity]) acc[rarity] = [];
    acc[rarity].push(hero);
    return acc;
  }, {});

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.noUserText}>Please login first</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hero Collection</Text>
          <Text style={styles.subtitle}>{userHeroes.length} Heroes Collected</Text>
        </View>

        {/* Rarity Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              !filterRarity && styles.filterButtonActive,
            ]}
            onPress={() => setFilterRarity(null)}
          >
            <Text style={styles.filterText}>All</Text>
          </TouchableOpacity>
          {['SR', 'SSR', 'UR', 'UR+'].map((rarity) => (
            <TouchableOpacity
              key={rarity}
              style={[
                styles.filterButton,
                { borderColor: RARITY_COLORS[rarity] },
                filterRarity === rarity && styles.filterButtonActive,
                filterRarity === rarity && { backgroundColor: RARITY_COLORS[rarity] + '33' },
              ]}
              onPress={() => setFilterRarity(rarity)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: RARITY_COLORS[rarity] },
                ]}
              >
                {rarity}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Heroes List */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#FF6B9D" style={styles.loader} />
        ) : userHeroes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No heroes yet</Text>
            <Text style={styles.emptySubtext}>Try summoning some heroes!</Text>
          </View>
        ) : (
          Object.keys(groupedHeroes)
            .sort((a, b) => {
              const order = ['UR+', 'UR', 'SSR', 'SR'];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map((rarity) => (
              <View key={rarity} style={styles.raritySection}>
                <Text
                  style={[
                    styles.raritySectionTitle,
                    { color: RARITY_COLORS[rarity] },
                  ]}
                >
                  {rarity} Heroes ({groupedHeroes[rarity].length})
                </Text>
                <View style={styles.heroGrid}>
                  {groupedHeroes[rarity].map((hero: any) => (
                    <TouchableOpacity
                      key={hero.id}
                      style={[
                        styles.heroCard,
                        { borderColor: RARITY_COLORS[hero.hero_data?.rarity || 'SR'] },
                      ]}
                      onPress={() => {
                        setSelectedHero(hero);
                        setShowDetail(true);
                      }}
                    >
                      <Image
                        source={{ uri: hero.hero_data?.image_url }}
                        style={styles.heroImage}
                      />
                      <View style={styles.heroInfo}>
                        <Text style={styles.heroName} numberOfLines={1}>
                          {hero.hero_data?.name}
                        </Text>
                        <View style={styles.heroStats}>
                          <View style={styles.statBadge}>
                            <Text style={styles.statText}>Rank {hero.rank}</Text>
                          </View>
                          <View style={styles.statBadge}>
                            <Text style={styles.statText}>Lv.{hero.level}</Text>
                          </View>
                        </View>
                        {hero.duplicates > 0 && (
                          <View style={styles.duplicateBadge}>
                            <Ionicons name="copy" size={12} color="#FFD700" />
                            <Text style={styles.duplicateText}>+{hero.duplicates}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
        )}
      </ScrollView>

      {/* Hero Detail Modal */}
      <Modal
        visible={showDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedHero && (
              <>
                <TouchableOpacity
                  style={styles.closeIcon}
                  onPress={() => setShowDetail(false)}
                >
                  <Ionicons name="close" size={32} color="#fff" />
                </TouchableOpacity>

                <Image
                  source={{ uri: selectedHero.hero_data?.image_url }}
                  style={styles.detailImage}
                />

                <View
                  style={[
                    styles.rarityBadge,
                    { backgroundColor: RARITY_COLORS[selectedHero.hero_data?.rarity || 'SR'] },
                  ]}
                >
                  <Text style={styles.rarityText}>{selectedHero.hero_data?.rarity}</Text>
                </View>

                <Text style={styles.detailName}>{selectedHero.hero_data?.name}</Text>
                <Text style={styles.detailDescription}>
                  {selectedHero.hero_data?.description}
                </Text>

                <View style={styles.detailStats}>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Class:</Text>
                    <Text style={styles.statValue}>{selectedHero.hero_data?.hero_class}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Element:</Text>
                    <View style={styles.elementBadge}>
                      <View
                        style={[
                          styles.elementDot,
                          { backgroundColor: ELEMENT_COLORS[selectedHero.hero_data?.element || 'Fire'] },
                        ]}
                      />
                      <Text style={styles.statValue}>{selectedHero.hero_data?.element}</Text>
                    </View>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Level:</Text>
                    <Text style={styles.statValue}>{selectedHero.level}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Rank:</Text>
                    <Text style={styles.statValue}>{selectedHero.rank} / 10</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Duplicates:</Text>
                    <Text style={styles.statValue}>{selectedHero.duplicates}</Text>
                  </View>
                </View>

                <View style={styles.combatStats}>
                  <View style={styles.combatStat}>
                    <Ionicons name="heart" size={24} color="#F44336" />
                    <Text style={styles.combatStatLabel}>HP</Text>
                    <Text style={styles.combatStatValue}>{selectedHero.current_hp}</Text>
                  </View>
                  <View style={styles.combatStat}>
                    <Ionicons name="flash" size={24} color="#FF9800" />
                    <Text style={styles.combatStatLabel}>ATK</Text>
                    <Text style={styles.combatStatValue}>{selectedHero.current_atk}</Text>
                  </View>
                  <View style={styles.combatStat}>
                    <Ionicons name="shield" size={24} color="#2196F3" />
                    <Text style={styles.combatStatLabel}>DEF</Text>
                    <Text style={styles.combatStatValue}>{selectedHero.current_def}</Text>
                  </View>
                </View>

                {selectedHero.rank < 10 && (
                  <TouchableOpacity
                    style={[
                      styles.upgradeButton,
                      selectedHero.duplicates < selectedHero.rank * 2 && styles.upgradeButtonDisabled,
                    ]}
                    onPress={handleUpgrade}
                    disabled={selectedHero.duplicates < selectedHero.rank * 2}
                  >
                    <Text style={styles.upgradeButtonText}>
                      Rank Up (Need {selectedHero.rank * 2} duplicates)
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedHero.rank === 10 && (
                  <View style={styles.maxRankBadge}>
                    <Ionicons name="trophy" size={24} color="#FFD700" />
                    <Text style={styles.maxRankText}>Max Rank - Star Chart Available</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#1a1a2e',
  },
  filterButtonActive: {
    borderColor: '#FF6B9D',
    backgroundColor: '#FF6B9D33',
  },
  filterText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  raritySection: {
    marginBottom: 24,
  },
  raritySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroCard: {
    width: '48%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 150,
  },
  heroInfo: {
    padding: 8,
  },
  heroName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 4,
  },
  statBadge: {
    backgroundColor: '#0f0f1e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statText: {
    fontSize: 10,
    color: '#999',
  },
  duplicateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  duplicateText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 50,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    maxHeight: '90%',
    borderWidth: 2,
    borderColor: '#FF6B9D',
  },
  closeIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  detailImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
  },
  rarityBadge: {
    position: 'absolute',
    top: 24,
    left: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rarityText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailStats: {
    backgroundColor: '#0f0f1e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  elementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  elementDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  combatStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  combatStat: {
    flex: 1,
    backgroundColor: '#0f0f1e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  combatStatLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  combatStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  upgradeButton: {
    backgroundColor: '#FF6B9D',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  upgradeButtonDisabled: {
    backgroundColor: '#666',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  maxRankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD70033',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  maxRankText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noUserText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});
