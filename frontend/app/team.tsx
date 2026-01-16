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
  Alert,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { useEntitlementVersion } from '../lib/entitlements/gating';
import { Ionicons } from '@expo/vector-icons';
import { toast } from '../components/ui/Toast';

// CANONICAL combat stats and power helpers
import { computeCombatStats } from '../lib/combatStats';
import { computeTeamPower } from '../lib/power';

const RARITY_COLORS: { [key: string]: string } = {
  'SR': '#4CAF50',
  'SSR': '#9C27B0',
  'UR': '#FF9800',
  'UR+': '#F44336',
};

export default function TeamScreen() {
  const { user, userHeroes, fetchUserHeroes, isLoading } = useGameStore();
  // Subscribe to entitlements for reactive power updates (Phase 3.21: use version hook)
  const _entitlementVersion = useEntitlementVersion();
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserHeroes();
    }
  }, [user]);

  const toggleHeroSelection = (heroId: string) => {
    if (selectedHeroes.includes(heroId)) {
      setSelectedHeroes(selectedHeroes.filter((id) => id !== heroId));
    } else {
      if (selectedHeroes.length >= 6) {
        toast.warning('Maximum 6 heroes per team');
        return;
      }
      setSelectedHeroes([...selectedHeroes, heroId]);
    }
  };

  const calculateTeamPower = () => {
    let totalPower = 0;
    selectedHeroes.forEach((heroId) => {
      const hero = userHeroes.find((h) => h.id === heroId);
      if (hero) {
        // Use canonical combat stats (includes premium cinematic bonus)
        const stats = computeCombatStats(hero, hero.hero_data);
        totalPower += computeTeamPower(stats);
      }
    });
    return totalPower;
  };

  const getTeamSynergy = () => {
    const elements: { [key: string]: number } = {};
    const classes: { [key: string]: number } = {};

    selectedHeroes.forEach((heroId) => {
      const hero = userHeroes.find((h) => h.id === heroId);
      if (hero?.hero_data) {
        elements[hero.hero_data.element] = (elements[hero.hero_data.element] || 0) + 1;
        classes[hero.hero_data.hero_class] = (classes[hero.hero_data.hero_class] || 0) + 1;
      }
    });

    const synergies: string[] = [];

    // Check for element synergies
    Object.entries(elements).forEach(([element, count]) => {
      if (count >= 2) {
        synergies.push(`${element} Synergy x${count}`);
      }
    });

    // Check for class synergies
    Object.entries(classes).forEach(([heroClass, count]) => {
      if (count >= 2) {
        synergies.push(`${heroClass} Synergy x${count}`);
      }
    });

    return synergies;
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.noUserText}>Please login first</Text>
      </View>
    );
  }

  const teamPower = calculateTeamPower();
  const synergies = getTeamSynergy();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Team Builder</Text>
          <Text style={styles.subtitle}>Select up to 6 heroes</Text>
        </View>

        {/* Team Display */}
        <View style={styles.teamDisplay}>
          <View style={styles.teamHeader}>
            <Text style={styles.teamTitle}>Current Team ({selectedHeroes.length}/6)</Text>
            {selectedHeroes.length > 0 && (
              <TouchableOpacity onPress={() => setSelectedHeroes([])}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.teamGrid}>
            {[...Array(6)].map((_, index) => {
              const heroId = selectedHeroes[index];
              const hero = heroId ? userHeroes.find((h) => h.id === heroId) : null;

              return (
                <View key={index} style={styles.teamSlotContainer}>
                  <TouchableOpacity
                    style={[
                      styles.teamSlot,
                      hero && { borderColor: RARITY_COLORS[hero.hero_data?.rarity || 'SR'] },
                    ]}
                    onPress={() => !hero && toast.info('Tap a hero below to add them to this slot')}
                  >
                    {hero ? (
                      <>
                        <Image source={{ uri: hero.hero_data?.image_url }} style={styles.teamHeroImage} />
                        <View style={styles.teamHeroInfo}>
                          <Text style={styles.teamHeroName} numberOfLines={1}>
                            {hero.hero_data?.name?.split(' ')[0]}
                          </Text>
                          <Text style={styles.teamHeroRank}>Lv.{hero.level || 1}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.emptySlot}>
                        <Ionicons name="add-circle-outline" size={36} color="#666" />
                        <Text style={styles.emptySlotText}>Empty</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {/* LARGE REMOVE BUTTON */}
                  {hero && (
                    <TouchableOpacity
                      style={styles.removeHeroButton}
                      onPress={() => toggleHeroSelection(hero.id)}
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                      <View style={styles.removeHeroButtonInner}>
                        <Ionicons name="close" size={18} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Team Stats */}
          {selectedHeroes.length > 0 && (
            <View style={styles.teamStats}>
              <View style={styles.powerCard}>
                <Ionicons name="flash" size={24} color="#FF6B9D" />
                <View>
                  <Text style={styles.powerLabel}>Team Power</Text>
                  <Text style={styles.powerValue}>{teamPower.toLocaleString()}</Text>
                </View>
              </View>

              {synergies.length > 0 && (
                <View style={styles.synergyCard}>
                  <Text style={styles.synergyTitle}>Synergies</Text>
                  {synergies.map((synergy, index) => (
                    <View key={index} style={styles.synergyItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={styles.synergyText}>{synergy}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Hero Selection */}
        <View style={styles.selectionSection}>
          <Text style={styles.sectionTitle}>Select Heroes</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#FF6B9D" style={styles.loader} />
          ) : userHeroes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>No heroes available</Text>
              <Text style={styles.emptySubtext}>Summon heroes first!</Text>
            </View>
          ) : (
            <View style={styles.heroList}>
              {userHeroes.map((hero) => {
                const isSelected = selectedHeroes.includes(hero.id);
                return (
                  <TouchableOpacity
                    key={hero.id}
                    style={[
                      styles.heroItem,
                      { borderColor: RARITY_COLORS[hero.hero_data?.rarity || 'SR'] },
                      isSelected && styles.heroItemSelected,
                    ]}
                    onPress={() => toggleHeroSelection(hero.id)}
                  >
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                      </View>
                    )}
                    <Image source={{ uri: hero.hero_data?.image_url }} style={styles.heroItemImage} />
                    <View style={styles.heroItemInfo}>
                      <Text style={styles.heroItemName} numberOfLines={1}>
                        {hero.hero_data?.name}
                      </Text>
                      <Text style={styles.heroItemClass}>{hero.hero_data?.hero_class}</Text>
                      <View style={styles.heroItemStats}>
                        <View style={styles.miniStat}>
                          <Text style={styles.miniStatText}>Rank {hero.rank}</Text>
                        </View>
                        <View style={styles.miniStat}>
                          <Text style={styles.miniStatText}>Lv.{hero.level}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.heroPower}>
                      <Text style={styles.heroPowerLabel}>PWR</Text>
                      <Text style={styles.heroPowerValue}>
                        {(() => {
                          const stats = computeCombatStats(hero, hero.hero_data);
                          return computeTeamPower(stats).toLocaleString();
                        })()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
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
  teamDisplay: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearText: {
    color: '#FF6B9D',
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  teamSlotContainer: {
    width: '31%',
    position: 'relative',
  },
  teamSlot: {
    width: '100%',
    aspectRatio: 0.9,
    backgroundColor: '#0f0f1e',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    overflow: 'hidden',
  },
  teamHeroImage: {
    width: '100%',
    height: '65%',
  },
  teamHeroInfo: {
    padding: 4,
    height: '35%',
    alignItems: 'center',
  },
  teamHeroName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  teamHeroRank: {
    fontSize: 10,
    color: '#999',
  },
  emptySlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  // LARGE REMOVE BUTTON
  removeHeroButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
  },
  removeHeroButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  teamStats: {
    marginTop: 16,
    gap: 12,
  },
  powerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f0f1e',
    padding: 12,
    borderRadius: 8,
  },
  powerLabel: {
    fontSize: 12,
    color: '#999',
  },
  powerValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  synergyCard: {
    backgroundColor: '#0f0f1e',
    padding: 12,
    borderRadius: 8,
  },
  synergyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  synergyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  synergyText: {
    fontSize: 12,
    color: '#fff',
  },
  selectionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  heroList: {
    gap: 12,
  },
  heroItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2,
    padding: 8,
    alignItems: 'center',
    position: 'relative',
  },
  heroItemSelected: {
    backgroundColor: '#1a2e1a',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  heroItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  heroItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  heroItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  heroItemClass: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  heroItemStats: {
    flexDirection: 'row',
    gap: 4,
  },
  miniStat: {
    backgroundColor: '#0f0f1e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniStatText: {
    fontSize: 10,
    color: '#999',
  },
  heroPower: {
    alignItems: 'center',
    marginLeft: 8,
  },
  heroPowerLabel: {
    fontSize: 10,
    color: '#999',
  },
  heroPowerValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  loader: {
    marginTop: 50,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
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
  noUserText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});
