import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

const { width } = Dimensions.get('window');
const SLOT_SIZE = (width - 60) / 3;

interface Hero {
  id: string;
  hero_data?: {
    name: string;
    rarity: string;
    element: string;
    hero_class: string;
    image_url?: string;
    base_hp?: number;
    base_atk?: number;
    base_def?: number;
  };
  level?: number;
  rank?: number;
  stars?: number;
  current_hp?: number;
  current_atk?: number;
  current_def?: number;
}

interface TeamSelectorProps {
  selectedHeroes: Hero[];
  availableHeroes: Hero[];
  maxSlots?: number;
  onTeamChange: (heroes: Hero[]) => void;
  title?: string;
  showPower?: boolean;
}

const RARITY_COLORS: { [key: string]: string } = {
  'N': '#808080',
  'R': '#2196F3',
  'SR': '#4CAF50',
  'SSR': '#9C27B0',
  'SSR+': '#E91E63',
  'UR': '#FF9800',
  'UR+': '#F44336',
};

const ELEMENT_ICONS: { [key: string]: { name: string; color: string } } = {
  'fire': { name: 'flame', color: '#FF5722' },
  'water': { name: 'water', color: '#2196F3' },
  'earth': { name: 'leaf', color: '#4CAF50' },
  'wind': { name: 'cloudy', color: '#9E9E9E' },
  'light': { name: 'sunny', color: '#FFEB3B' },
  'dark': { name: 'moon', color: '#673AB7' },
};

export default function TeamSelector({
  selectedHeroes,
  availableHeroes,
  maxSlots = 6,
  onTeamChange,
  title = 'Select Your Team',
  showPower = true,
}: TeamSelectorProps) {
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [slotToFill, setSlotToFill] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'rarity' | 'element'>('all');
  const [sortBy, setSortBy] = useState<'power' | 'level' | 'rarity'>('power');

  // Calculate team power
  const teamPower = selectedHeroes.reduce((total, hero) => {
    if (!hero) return total;
    const hp = hero.current_hp || hero.hero_data?.base_hp || 1000;
    const atk = hero.current_atk || hero.hero_data?.base_atk || 100;
    const def = hero.current_def || hero.hero_data?.base_def || 100;
    return total + hp + atk * 3 + def * 2;
  }, 0);

  // Remove hero from slot
  const removeHero = (index: number) => {
    const newTeam = [...selectedHeroes];
    newTeam.splice(index, 1);
    onTeamChange(newTeam);
  };

  // Open hero selection modal for a specific slot
  const openSlotSelector = (index: number) => {
    setSlotToFill(index);
    setShowHeroModal(true);
  };

  // Add hero to team
  const addHero = (hero: Hero) => {
    // Check if already in team
    if (selectedHeroes.some(h => h.id === hero.id)) {
      return;
    }

    if (slotToFill !== null && slotToFill < selectedHeroes.length) {
      // Replace hero in specific slot
      const newTeam = [...selectedHeroes];
      newTeam[slotToFill] = hero;
      onTeamChange(newTeam);
    } else {
      // Add to end
      if (selectedHeroes.length < maxSlots) {
        onTeamChange([...selectedHeroes, hero]);
      }
    }
    setShowHeroModal(false);
    setSlotToFill(null);
  };

  // Sort heroes
  const sortedAvailableHeroes = [...availableHeroes].sort((a, b) => {
    if (sortBy === 'power') {
      const powerA = (a.current_atk || 100) * 3 + (a.current_hp || 1000) + (a.current_def || 100) * 2;
      const powerB = (b.current_atk || 100) * 3 + (b.current_hp || 1000) + (b.current_def || 100) * 2;
      return powerB - powerA;
    }
    if (sortBy === 'level') {
      return (b.level || 1) - (a.level || 1);
    }
    if (sortBy === 'rarity') {
      const rarityOrder = ['UR+', 'UR', 'SSR+', 'SSR', 'SR', 'R', 'N'];
      const indexA = rarityOrder.indexOf(a.hero_data?.rarity || 'SR');
      const indexB = rarityOrder.indexOf(b.hero_data?.rarity || 'SR');
      return indexA - indexB;
    }
    return 0;
  });

  // Filter out already selected heroes
  const filteredHeroes = sortedAvailableHeroes.filter(
    hero => !selectedHeroes.some(h => h.id === hero.id)
  );

  const renderTeamSlot = (index: number) => {
    const hero = selectedHeroes[index];
    const rarityColor = hero?.hero_data?.rarity 
      ? RARITY_COLORS[hero.hero_data.rarity] 
      : COLORS.navy.light;

    return (
      <TouchableOpacity
        key={index}
        style={[styles.teamSlot, { borderColor: rarityColor }]}
        onPress={() => openSlotSelector(index)}
        activeOpacity={0.7}
      >
        {hero ? (
          <>
            {/* Hero Image */}
            <Image
              source={{ uri: hero.hero_data?.image_url || 'https://via.placeholder.com/80' }}
              style={styles.heroImage}
            />
            
            {/* Rarity Badge */}
            <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
              <Text style={styles.rarityText}>{hero.hero_data?.rarity || 'SR'}</Text>
            </View>
            
            {/* Level Badge */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.{hero.level || 1}</Text>
            </View>
            
            {/* Hero Name */}
            <Text style={styles.heroName} numberOfLines={1}>
              {hero.hero_data?.name?.split(' ')[0] || 'Hero'}
            </Text>
            
            {/* REMOVE BUTTON - Large and prominent */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={(e) => {
                e.stopPropagation();
                removeHero(index);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LinearGradient
                colors={['#FF4444', '#CC0000']}
                style={styles.removeButtonGradient}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptySlot}>
            <Ionicons name="add-circle-outline" size={36} color={COLORS.cream.dark} />
            <Text style={styles.emptySlotText}>Tap to Add</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeroCard = ({ item: hero }: { item: Hero }) => {
    const rarityColor = RARITY_COLORS[hero.hero_data?.rarity || 'SR'];
    const element = hero.hero_data?.element?.toLowerCase() || 'fire';
    const elementIcon = ELEMENT_ICONS[element] || ELEMENT_ICONS['fire'];
    const power = (hero.current_atk || 100) * 3 + (hero.current_hp || 1000) + (hero.current_def || 100) * 2;

    return (
      <TouchableOpacity
        style={[styles.heroCard, { borderColor: rarityColor }]}
        onPress={() => addHero(hero)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: hero.hero_data?.image_url || 'https://via.placeholder.com/60' }}
          style={styles.heroCardImage}
        />
        <View style={styles.heroCardInfo}>
          <Text style={styles.heroCardName} numberOfLines={1}>
            {hero.hero_data?.name || 'Unknown'}
          </Text>
          <View style={styles.heroCardStats}>
            <View style={[styles.rarityPill, { backgroundColor: rarityColor }]}>
              <Text style={styles.rarityPillText}>{hero.hero_data?.rarity || 'SR'}</Text>
            </View>
            <View style={styles.elementPill}>
              <Ionicons name={elementIcon.name as any} size={12} color={elementIcon.color} />
            </View>
            <Text style={styles.levelPill}>Lv.{hero.level || 1}</Text>
          </View>
          <View style={styles.powerRow}>
            <Ionicons name="flash" size={12} color={COLORS.gold.primary} />
            <Text style={styles.powerText}>{power.toLocaleString()}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => addHero(hero)}>
          <Ionicons name="add" size={24} color={COLORS.gold.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Team Grid */}
      <View style={styles.teamGrid}>
        {[...Array(maxSlots)].map((_, index) => renderTeamSlot(index))}
      </View>

      {/* Team Power */}
      {showPower && selectedHeroes.length > 0 && (
        <View style={styles.powerContainer}>
          <LinearGradient
            colors={[COLORS.gold.dark + '40', COLORS.navy.medium]}
            style={styles.powerGradient}
          >
            <Ionicons name="flash" size={24} color={COLORS.gold.primary} />
            <View>
              <Text style={styles.powerLabel}>Team Power</Text>
              <Text style={styles.powerValue}>{teamPower.toLocaleString()}</Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Quick Add Button */}
      {selectedHeroes.length < maxSlots && (
        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={() => {
            setSlotToFill(null);
            setShowHeroModal(true);
          }}
        >
          <Ionicons name="person-add" size={20} color={COLORS.cream.pure} />
          <Text style={styles.quickAddText}>Add Hero ({selectedHeroes.length}/{maxSlots})</Text>
        </TouchableOpacity>
      )}

      {/* Hero Selection Modal */}
      <Modal
        visible={showHeroModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHeroModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Hero</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowHeroModal(false)}
              >
                <Ionicons name="close-circle" size={32} color={COLORS.cream.soft} />
              </TouchableOpacity>
            </View>

            {/* Sort Options */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              {(['power', 'level', 'rarity'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.sortButton, sortBy === option && styles.sortButtonActive]}
                  onPress={() => setSortBy(option)}
                >
                  <Text style={[styles.sortButtonText, sortBy === option && styles.sortButtonTextActive]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hero List */}
            {filteredHeroes.length === 0 ? (
              <View style={styles.noHeroesContainer}>
                <Ionicons name="sad-outline" size={48} color={COLORS.cream.dark} />
                <Text style={styles.noHeroesText}>No more heroes available</Text>
              </View>
            ) : (
              <FlatList
                data={filteredHeroes}
                keyExtractor={(item) => item.id}
                renderItem={renderHeroCard}
                contentContainerStyle={styles.heroList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
    marginBottom: 12,
    textAlign: 'center',
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  teamSlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE + 20,
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.navy.light,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: SLOT_SIZE - 20,
    height: SLOT_SIZE - 20,
    borderRadius: 8,
  },
  rarityBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  levelBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.navy.darkest + 'CC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.cream.soft,
  },
  heroName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.cream.pure,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  // REMOVE BUTTON - Made larger and more prominent
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 10,
  },
  removeButtonGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontSize: 10,
    color: COLORS.cream.dark,
    marginTop: 4,
  },
  powerContainer: {
    marginTop: 16,
    marginHorizontal: 20,
  },
  powerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  powerLabel: {
    fontSize: 12,
    color: COLORS.cream.dark,
  },
  powerValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold.primary,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold.dark,
    marginHorizontal: 40,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.cream.pure,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.navy.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navy.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
  },
  closeModalButton: {
    padding: 4,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    color: COLORS.cream.dark,
    marginRight: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.navy.medium,
  },
  sortButtonActive: {
    backgroundColor: COLORS.gold.dark,
  },
  sortButtonText: {
    fontSize: 12,
    color: COLORS.cream.dark,
  },
  sortButtonTextActive: {
    color: COLORS.cream.pure,
    fontWeight: '600',
  },
  heroList: {
    padding: 12,
  },
  heroCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    borderWidth: 2,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  heroCardImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  heroCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  heroCardName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
    marginBottom: 4,
  },
  heroCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rarityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rarityPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  elementPill: {
    backgroundColor: COLORS.navy.dark,
    padding: 4,
    borderRadius: 6,
  },
  levelPill: {
    fontSize: 10,
    color: COLORS.cream.soft,
    fontWeight: '600',
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  powerText: {
    fontSize: 12,
    color: COLORS.gold.primary,
    fontWeight: '600',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.navy.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.gold.dark,
  },
  noHeroesContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noHeroesText: {
    fontSize: 16,
    color: COLORS.cream.dark,
    marginTop: 12,
  },
});
