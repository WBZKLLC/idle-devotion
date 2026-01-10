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
  Modal,
  Image,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

// Centralized API wrappers (no raw fetch in screens)
import { getTeamsFull, updateTeamSlots, createTeamFull, setActiveTeam } from '../lib/api';

interface TeamSlot {
  slot: number;
  position: 'front' | 'back';
  heroId: string | null;
  heroData: any | null;
}

export default function TeamBuilderScreen() {
  const { user, userHeroes, fetchUserHeroes } = useGameStore();
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [slots, setSlots] = useState<TeamSlot[]>([
    { slot: 1, position: 'front', heroId: null, heroData: null },
    { slot: 2, position: 'front', heroId: null, heroData: null },
    { slot: 3, position: 'front', heroId: null, heroData: null },
    { slot: 4, position: 'back', heroId: null, heroData: null },
    { slot: 5, position: 'back', heroId: null, heroData: null },
    { slot: 6, position: 'back', heroId: null, heroData: null },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHeroSelector, setShowHeroSelector] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [teamPower, setTeamPower] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUserHeroes();
      loadTeams();
    }
  }, [user]);

  const loadTeams = async () => {
    try {
      // Use centralized API wrapper (no raw fetch)
      const data = await getTeamsFull(user?.username || '');
      setTeams(data);
      
      // Load the active team if exists
      const activeTeam = data.find((t: any) => t.is_active);
      if (activeTeam) {
        setSelectedTeamId(activeTeam.id);
        loadTeamSlots(activeTeam);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const loadTeamSlots = (team: any) => {
    const newSlots = [...slots];
    let power = 0;
    
    for (let i = 1; i <= 6; i++) {
      const slotData = team[`slot_${i}_data`];
      if (slotData) {
        newSlots[i - 1].heroId = team[`slot_${i}`];
        newSlots[i - 1].heroData = {
          ...slotData.user_hero,
          hero_info: slotData.hero_data
        };
        // Calculate power
        if (slotData.hero_data) {
          const levelMult = 1 + (slotData.user_hero.level - 1) * 0.05;
          const heroPower = (slotData.hero_data.base_hp + slotData.hero_data.base_atk * 3 + slotData.hero_data.base_def * 2) * levelMult;
          power += heroPower;
        }
      } else {
        newSlots[i - 1].heroId = null;
        newSlots[i - 1].heroData = null;
      }
    }
    
    setSlots(newSlots);
    setTeamPower(Math.floor(power));
  };

  const selectHeroForSlot = (slotNumber: number) => {
    setSelectedSlot(slotNumber);
    setShowHeroSelector(true);
  };

  const assignHeroToSlot = async (userHero: any) => {
    if (selectedSlot === null) return;
    
    // Check if hero is already in another slot
    const existingSlot = slots.find(s => s.heroId === userHero.id);
    if (existingSlot) {
      Alert.alert('Hero Already Assigned', 'This hero is already in another slot. Remove it first.');
      return;
    }
    
    const newSlots = [...slots];
    newSlots[selectedSlot - 1].heroId = userHero.id;
    newSlots[selectedSlot - 1].heroData = userHero;
    setSlots(newSlots);
    setShowHeroSelector(false);
    setSelectedSlot(null);
    
    // Recalculate power
    calculateTeamPower(newSlots);
  };

  const removeHeroFromSlot = (slotNumber: number) => {
    const newSlots = [...slots];
    newSlots[slotNumber - 1].heroId = null;
    newSlots[slotNumber - 1].heroData = null;
    setSlots(newSlots);
    calculateTeamPower(newSlots);
  };

  const calculateTeamPower = (currentSlots: TeamSlot[]) => {
    let power = 0;
    currentSlots.forEach(slot => {
      if (slot.heroData?.hero_data) {
        const heroData = slot.heroData.hero_data;
        const levelMult = 1 + (slot.heroData.level - 1) * 0.05;
        power += (heroData.base_hp + heroData.base_atk * 3 + heroData.base_def * 2) * levelMult;
      }
    });
    setTeamPower(Math.floor(power));
  };

  const saveTeam = async () => {
    setIsLoading(true);
    try {
      const slotsData = {
        slot_1: slots[0].heroId,
        slot_2: slots[1].heroId,
        slot_3: slots[2].heroId,
        slot_4: slots[3].heroId,
        slot_5: slots[4].heroId,
        slot_6: slots[5].heroId,
      };
      
      if (selectedTeamId) {
        // Update existing team - use centralized API wrapper
        await updateTeamSlots(selectedTeamId, user?.username || '', slotsData);
        Alert.alert('Success', 'Team saved successfully!');
        loadTeams();
      } else {
        // Create new team - use centralized API wrapper
        const newTeam = await createTeamFull(user?.username || '', 'Main Team', slotsData);
        setSelectedTeamId(newTeam.id);
        Alert.alert('Success', 'Team created successfully!');
        loadTeams();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save team');
    } finally {
      setIsLoading(false);
    }
  };

  const setAsActiveTeam = async () => {
    if (!selectedTeamId) return;
    
    try {
      await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/team/${selectedTeamId}/set-active?username=${user?.username}`,
        { method: 'PUT' }
      );
      Alert.alert('Success', 'Team set as active!');
      loadTeams();
    } catch (error) {
      Alert.alert('Error', 'Failed to set active team');
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

  const renderSlot = (slot: TeamSlot) => {
    const isOccupied = slot.heroData !== null;
    const heroInfo = slot.heroData?.hero_data || slot.heroData?.hero_info;
    
    return (
      <TouchableOpacity
        key={slot.slot}
        style={[
          styles.slot,
          slot.position === 'front' ? styles.frontSlot : styles.backSlot,
        ]}
        onPress={() => isOccupied ? null : selectHeroForSlot(slot.slot)}
        onLongPress={() => isOccupied ? removeHeroFromSlot(slot.slot) : null}
      >
        {isOccupied && heroInfo ? (
          <LinearGradient
            colors={[getRarityColor(heroInfo.rarity) + '40', COLORS.navy.dark]}
            style={styles.slotContent}
          >
            <Image
              source={{ uri: heroInfo.image_url }}
              style={styles.heroImage}
            />
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, { color: getRarityColor(heroInfo.rarity) }]} numberOfLines={1}>
                {heroInfo.name?.split(' ')[0]}
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lv.{slot.heroData?.level || 1}</Text>
                </View>
                <Ionicons name={getClassIcon(heroInfo.hero_class) as any} size={14} color={COLORS.gold.light} />
              </View>
            </View>
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => removeHeroFromSlot(slot.slot)}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <View style={styles.emptySlot}>
            <Ionicons name="add-circle-outline" size={40} color={COLORS.navy.light} />
            <Text style={styles.slotLabel}>
              {slot.position === 'front' ? 'Front' : 'Back'} {slot.slot <= 3 ? slot.slot : slot.slot - 3}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Team Builder</Text>
          <Text style={styles.subtitle}>Position your heroes for battle</Text>
          
          {/* Team Power Display */}
          <LinearGradient
            colors={[COLORS.gold.primary, COLORS.gold.dark]}
            style={styles.powerCard}
          >
            <Text style={styles.powerLabel}>Team Power</Text>
            <Text style={styles.powerValue}>{teamPower.toLocaleString()}</Text>
          </LinearGradient>
          
          {/* Battle Formation */}
          <View style={styles.formationContainer}>
            <Text style={styles.formationLabel}>Front Line (Tanks)</Text>
            <View style={styles.slotsRow}>
              {slots.filter(s => s.position === 'front').map(renderSlot)}
            </View>
            
            <Text style={styles.formationLabel}>Back Line (DPS)</Text>
            <View style={styles.slotsRow}>
              {slots.filter(s => s.position === 'back').map(renderSlot)}
            </View>
          </View>
          
          {/* Class Advantages */}
          <View style={styles.advantagesCard}>
            <Text style={styles.advantagesTitle}>Class Advantages</Text>
            <View style={styles.advantageRow}>
              <View style={styles.advantageItem}>
                <Ionicons name="shield" size={20} color={COLORS.gold.primary} />
                <Text style={styles.advantageText}>Warrior</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.success} />
              <View style={styles.advantageItem}>
                <Ionicons name="locate" size={20} color={COLORS.rarity.SSR} />
                <Text style={styles.advantageText}>Archer</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.success} />
              <View style={styles.advantageItem}>
                <Ionicons name="flame" size={20} color={COLORS.rarity.UR} />
                <Text style={styles.advantageText}>Mage</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.success} />
              <View style={styles.advantageItem}>
                <Ionicons name="shield" size={20} color={COLORS.gold.primary} />
                <Text style={styles.advantageText}>Warrior</Text>
              </View>
            </View>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveTeam}
              disabled={isLoading}
            >
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.navy.darkest} />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color={COLORS.navy.darkest} />
                    <Text style={styles.buttonText}>Save Team</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            {selectedTeamId && (
              <TouchableOpacity
                style={styles.activeButton}
                onPress={setAsActiveTeam}
              >
                <LinearGradient
                  colors={[COLORS.success, '#0d5c2e']}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.cream.pure} />
                  <Text style={[styles.buttonText, { color: COLORS.cream.pure }]}>Set Active</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.helpText}>
            Tap slot to add hero • Long press to remove
          </Text>
        </ScrollView>
        
        {/* Hero Selector Modal */}
        <Modal
          visible={showHeroSelector}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowHeroSelector(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Hero</Text>
                <TouchableOpacity onPress={() => setShowHeroSelector(false)}>
                  <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.heroList}>
                {userHeroes
                  .filter(h => !slots.some(s => s.heroId === h.id))
                  .map((hero) => {
                    const heroInfo = hero.hero_data;
                    return (
                      <TouchableOpacity
                        key={hero.id}
                        style={styles.heroListItem}
                        onPress={() => assignHeroToSlot(hero)}
                      >
                        <Image
                          source={{ uri: heroInfo?.image_url }}
                          style={styles.heroListImage}
                        />
                        <View style={styles.heroListInfo}>
                          <Text style={[styles.heroListName, { color: getRarityColor(heroInfo?.rarity || 'SR') }]}>
                            {heroInfo?.name}
                          </Text>
                          <Text style={styles.heroListStats}>
                            Lv.{hero.level} • {heroInfo?.hero_class} • {heroInfo?.element}
                          </Text>
                        </View>
                        <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(heroInfo?.rarity || 'SR') }]}>
                          <Text style={styles.rarityText}>{heroInfo?.rarity}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 16 },
  powerCard: { borderRadius: 16, padding: 16, marginBottom: 20, alignItems: 'center' },
  powerLabel: { fontSize: 14, color: COLORS.navy.darkest, marginBottom: 4 },
  powerValue: { fontSize: 32, fontWeight: 'bold', color: COLORS.navy.darkest },
  formationContainer: { marginBottom: 20 },
  formationLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold.light, marginBottom: 12, marginLeft: 4 },
  slotsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  slot: { flex: 1, aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.gold.dark + '40' },
  frontSlot: { borderColor: COLORS.gold.primary + '60' },
  backSlot: { borderColor: COLORS.rarity.UR + '60' },
  slotContent: { flex: 1, padding: 8 },
  emptySlot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy.medium },
  slotLabel: { fontSize: 10, color: COLORS.navy.light, marginTop: 4 },
  heroImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 4 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levelBadge: { backgroundColor: COLORS.navy.darkest, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  levelText: { fontSize: 9, color: COLORS.cream.pure, fontWeight: 'bold' },
  removeButton: { position: 'absolute', top: 4, right: 4 },
  advantagesCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  advantagesTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12, textAlign: 'center' },
  advantageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  advantageItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  advantageText: { fontSize: 12, color: COLORS.cream.soft },
  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  saveButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  activeButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  buttonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  helpText: { fontSize: 12, color: COLORS.cream.dark, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.navy.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.gold.dark + '30' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  heroList: { padding: 16 },
  heroListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  heroListImage: { width: 50, height: 50, borderRadius: 8 },
  heroListInfo: { flex: 1, marginLeft: 12 },
  heroListName: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  heroListStats: { fontSize: 12, color: COLORS.cream.dark },
  rarityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rarityText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
