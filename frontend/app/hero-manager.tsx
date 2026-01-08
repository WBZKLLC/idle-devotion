import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  rarity: {
    N: '#9e9e9e',
    R: '#4CAF50',
    SR: '#2196F3',
    SSR: '#9C27B0',
    'SSR+': '#E91E63',
    UR: '#FF9800',
    'UR+': '#F44336',
  },
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
};

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL 
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
  : '/api';

// Game modes with their team configurations
const GAME_MODES = {
  campaign: { 
    name: 'Campaign', 
    icon: 'map', 
    slots: 6, 
    color: '#22c55e',
    description: 'Story Mode Team'
  },
  arena: { 
    name: 'Arena', 
    icon: 'trophy', 
    slots: 6, 
    color: '#f59e0b',
    description: 'PvP Defense Team'
  },
  abyss: { 
    name: 'Abyss', 
    icon: 'chevron-down-circle', 
    slots: 6, 
    color: '#8b5cf6',
    description: 'Endless Descent Team'
  },
  guild_war: { 
    name: 'Guild War', 
    icon: 'flame', 
    slots: 6, 
    color: '#ef4444',
    description: 'Guild Battle Team'
  },
  dungeons: { 
    name: 'Dungeons', 
    icon: 'flash', 
    slots: 6, 
    color: '#3b82f6',
    description: 'Resource Farming Team'
  },
};

type GameMode = keyof typeof GAME_MODES;

interface TeamSlot {
  slot: number;
  position: 'front' | 'back';
  heroId: string | null;
  heroData: any | null;
}

interface ChangeLog {
  timestamp: Date;
  action: string;
  heroName: string;
  slot: number;
  mode: string;
}

export default function HeroManagerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, userHeroes, fetchUserHeroes, fetchUser } = useGameStore();
  const hydrated = useHydration();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>((params.mode as GameMode) || 'campaign');
  const [slots, setSlots] = useState<TeamSlot[]>([]);
  const [showHeroSelector, setShowHeroSelector] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [teamPower, setTeamPower] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [showChangeLogs, setShowChangeLogs] = useState(false);
  const [modeTeams, setModeTeams] = useState<Record<GameMode, string | null>>({
    campaign: null,
    arena: null,
    abyss: null,
    guild_war: null,
    dungeons: null,
  });

  // Initialize slots based on selected mode
  const initializeSlots = useCallback(() => {
    const modeConfig = GAME_MODES[selectedMode];
    const newSlots: TeamSlot[] = [];
    for (let i = 1; i <= modeConfig.slots; i++) {
      newSlots.push({
        slot: i,
        position: i <= 3 ? 'front' : 'back',
        heroId: null,
        heroData: null,
      });
    }
    setSlots(newSlots);
  }, [selectedMode]);

  useEffect(() => {
    initializeSlots();
  }, [selectedMode, initializeSlots]);

  useEffect(() => {
    if (hydrated && user) {
      loadAllData();
    }
  }, [hydrated, user?.username]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUserHeroes(),
      loadModeTeams(),
    ]);
    setLoading(false);
  };

  const loadModeTeams = async () => {
    if (!user) return;
    
    try {
      // Load teams for all modes
      const response = await axios.get(`${API_BASE}/team/${user.username}/by-mode`);
      const teams = response.data || {};
      
      setModeTeams(teams);
      
      // Load the current mode's team
      if (teams[selectedMode]) {
        await loadTeamIntoSlots(teams[selectedMode]);
      }
    } catch (error) {
      console.error('Error loading mode teams:', error);
      // Try loading generic teams as fallback
      try {
        const response = await axios.get(`${API_BASE}/team/${user.username}`);
        const teams = response.data || [];
        const activeTeam = teams.find((t: any) => t.is_active);
        if (activeTeam) {
          await loadTeamIntoSlots(activeTeam.id);
        }
      } catch (fallbackError) {
        console.error('Fallback team load failed:', fallbackError);
      }
    }
  };

  const loadTeamIntoSlots = async (teamId: string) => {
    if (!user) return;
    
    try {
      const response = await axios.get(`${API_BASE}/team/${user.username}/full`);
      const teams = response.data || [];
      const team = teams.find((t: any) => t.id === teamId);
      
      if (team) {
        const newSlots = [...slots];
        let power = 0;
        
        for (let i = 1; i <= 6; i++) {
          const slotData = team[`slot_${i}_data`];
          if (slotData) {
            newSlots[i - 1] = {
              ...newSlots[i - 1],
              heroId: team[`slot_${i}`],
              heroData: {
                ...slotData.user_hero,
                hero_data: slotData.hero_data,
                hero_info: slotData.hero_data,
              },
            };
            // Calculate power
            if (slotData.hero_data) {
              const levelMult = 1 + (slotData.user_hero?.level || 1 - 1) * 0.05;
              const heroPower = (slotData.hero_data.base_hp + slotData.hero_data.base_atk * 3 + slotData.hero_data.base_def * 2) * levelMult;
              power += heroPower;
            }
          } else {
            newSlots[i - 1] = {
              ...newSlots[i - 1],
              heroId: null,
              heroData: null,
            };
          }
        }
        
        setSlots(newSlots);
        setTeamPower(Math.floor(power));
      }
    } catch (error) {
      console.error('Error loading team slots:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const selectHeroForSlot = (slotNumber: number) => {
    setSelectedSlot(slotNumber);
    setShowHeroSelector(true);
  };

  const assignHeroToSlot = (userHero: any) => {
    if (selectedSlot === null) return;
    
    // Check if hero is already in another slot
    const existingSlotIndex = slots.findIndex(s => s.heroId === userHero.id);
    if (existingSlotIndex !== -1) {
      Alert.alert(
        'Hero Already Assigned',
        `${userHero.hero_data?.name || 'This hero'} is already in Slot ${existingSlotIndex + 1}. Swap positions?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Swap',
            onPress: () => {
              const newSlots = [...slots];
              // Swap the heroes
              const targetSlotData = newSlots[selectedSlot - 1];
              newSlots[existingSlotIndex] = {
                ...newSlots[existingSlotIndex],
                heroId: targetSlotData.heroId,
                heroData: targetSlotData.heroData,
              };
              newSlots[selectedSlot - 1] = {
                ...newSlots[selectedSlot - 1],
                heroId: userHero.id,
                heroData: userHero,
              };
              setSlots(newSlots);
              setHasChanges(true);
              calculateTeamPower(newSlots);
              
              // Log the change
              addChangeLog('swapped', userHero.hero_data?.name || 'Hero', selectedSlot);
              flashSlotAnimation();
            },
          },
        ]
      );
      return;
    }
    
    const newSlots = [...slots];
    const previousHero = newSlots[selectedSlot - 1].heroData;
    
    newSlots[selectedSlot - 1] = {
      ...newSlots[selectedSlot - 1],
      heroId: userHero.id,
      heroData: userHero,
    };
    
    setSlots(newSlots);
    setShowHeroSelector(false);
    setSelectedSlot(null);
    setHasChanges(true);
    calculateTeamPower(newSlots);
    
    // Log the change
    addChangeLog(
      previousHero ? 'replaced' : 'added',
      userHero.hero_data?.name || 'Hero',
      selectedSlot
    );
    flashSlotAnimation();
  };

  const removeHeroFromSlot = (slotNumber: number) => {
    const heroData = slots[slotNumber - 1].heroData;
    if (!heroData) return;
    
    Alert.alert(
      'Remove Hero',
      `Remove ${heroData.hero_data?.name || heroData.hero_info?.name || 'this hero'} from Slot ${slotNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newSlots = [...slots];
            const heroName = heroData.hero_data?.name || heroData.hero_info?.name || 'Hero';
            
            newSlots[slotNumber - 1] = {
              ...newSlots[slotNumber - 1],
              heroId: null,
              heroData: null,
            };
            
            setSlots(newSlots);
            setHasChanges(true);
            calculateTeamPower(newSlots);
            addChangeLog('removed', heroName, slotNumber);
            flashSlotAnimation();
          },
        },
      ]
    );
  };

  const addChangeLog = (action: string, heroName: string, slot: number) => {
    const newLog: ChangeLog = {
      timestamp: new Date(),
      action,
      heroName,
      slot,
      mode: GAME_MODES[selectedMode].name,
    };
    setChangeLogs(prev => [newLog, ...prev.slice(0, 49)]);
  };

  const flashSlotAnimation = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const calculateTeamPower = (currentSlots: TeamSlot[]) => {
    let power = 0;
    currentSlots.forEach(slot => {
      const heroInfo = slot.heroData?.hero_data || slot.heroData?.hero_info;
      if (heroInfo) {
        const level = slot.heroData?.level || 1;
        const levelMult = 1 + (level - 1) * 0.05;
        power += (heroInfo.base_hp + heroInfo.base_atk * 3 + heroInfo.base_def * 2) * levelMult;
      }
    });
    setTeamPower(Math.floor(power));
  };

  const saveTeam = async () => {
    if (!user) return;
    
    setSaving(true);
    
    // Animate save button
    Animated.sequence([
      Animated.timing(saveAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(saveAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    try {
      const slotsData = {
        slot_1: slots[0]?.heroId || null,
        slot_2: slots[1]?.heroId || null,
        slot_3: slots[2]?.heroId || null,
        slot_4: slots[3]?.heroId || null,
        slot_5: slots[4]?.heroId || null,
        slot_6: slots[5]?.heroId || null,
        mode: selectedMode,
      };
      
      const response = await axios.post(
        `${API_BASE}/team/save-mode-team?username=${user.username}&mode=${selectedMode}`,
        slotsData
      );
      
      if (response.data) {
        setHasChanges(false);
        
        // Update mode teams
        setModeTeams(prev => ({
          ...prev,
          [selectedMode]: response.data.id,
        }));
        
        // Log save
        addChangeLog('saved', `${GAME_MODES[selectedMode].name} team`, 0);
        
        Alert.alert(
          '✅ Team Saved!',
          `Your ${GAME_MODES[selectedMode].name} team has been saved and documented.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error saving team:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    return COLORS.rarity[rarity as keyof typeof COLORS.rarity] || COLORS.cream.dark;
  };

  const getPositionLabel = (slot: TeamSlot) => {
    return slot.position === 'front' ? 'Front' : 'Back';
  };

  const getSlotLabel = (slot: TeamSlot) => {
    const pos = slot.slot <= 3 ? slot.slot : slot.slot - 3;
    return `${getPositionLabel(slot)} ${pos}`;
  };

  const renderSlot = (slot: TeamSlot) => {
    const isOccupied = slot.heroData !== null;
    const heroInfo = slot.heroData?.hero_data || slot.heroData?.hero_info;
    const isSelected = selectedSlot === slot.slot;
    
    return (
      <Animated.View 
        key={slot.slot} 
        style={[
          styles.slotWrapper,
          { opacity: flashAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.5],
          }) }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.slot,
            slot.position === 'front' ? styles.frontSlot : styles.backSlot,
            isSelected && styles.slotSelected,
          ]}
          onPress={() => isOccupied ? null : selectHeroForSlot(slot.slot)}
          onLongPress={() => isOccupied ? removeHeroFromSlot(slot.slot) : null}
          activeOpacity={0.8}
        >
          {isOccupied && heroInfo ? (
            <LinearGradient
              colors={[getRarityColor(heroInfo.rarity) + '40', COLORS.navy.dark]}
              style={styles.slotContent}
            >
              {/* Rarity indicator */}
              <View style={[styles.rarityIndicator, { backgroundColor: getRarityColor(heroInfo.rarity) }]}>
                <Text style={styles.rarityIndicatorText}>{heroInfo.rarity}</Text>
              </View>
              
              <Image
                source={{ uri: heroInfo.image_url }}
                style={styles.heroImage}
              />
              
              <View style={styles.heroInfo}>
                <Text 
                  style={[styles.heroName, { color: getRarityColor(heroInfo.rarity) }]} 
                  numberOfLines={1}
                >
                  {heroInfo.name?.split(' ')[0]}
                </Text>
                
                <View style={styles.heroStats}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>Lv.{slot.heroData?.level || 1}</Text>
                  </View>
                  <View style={styles.rankBadge}>
                    <Ionicons name="star" size={8} color={COLORS.gold.primary} />
                    <Text style={styles.rankText}>{slot.heroData?.rank || 1}</Text>
                  </View>
                </View>
              </View>
              
              {/* Remove button */}
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeHeroFromSlot(slot.slot)}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.error} />
              </TouchableOpacity>
              
              {/* Position label */}
              <View style={[styles.positionBadge, { backgroundColor: slot.position === 'front' ? COLORS.gold.primary : COLORS.rarity.UR }]}>
                <Text style={styles.positionText}>{slot.slot}</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.emptySlot}>
              <Ionicons name="add-circle-outline" size={32} color={COLORS.navy.light} />
              <Text style={styles.slotLabel}>{getSlotLabel(slot)}</Text>
              <Text style={styles.slotHint}>Tap to add</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderChangeLog = (log: ChangeLog, index: number) => {
    const getActionIcon = (action: string) => {
      switch (action) {
        case 'added': return 'add-circle';
        case 'removed': return 'remove-circle';
        case 'replaced': return 'swap-horizontal';
        case 'swapped': return 'swap-vertical';
        case 'saved': return 'checkmark-circle';
        default: return 'information-circle';
      }
    };
    
    const getActionColor = (action: string) => {
      switch (action) {
        case 'added': return COLORS.success;
        case 'removed': return COLORS.error;
        case 'replaced': return COLORS.warning;
        case 'swapped': return COLORS.rarity.SSR;
        case 'saved': return COLORS.gold.primary;
        default: return COLORS.cream.dark;
      }
    };
    
    return (
      <View key={index} style={styles.logItem}>
        <Ionicons name={getActionIcon(log.action) as any} size={16} color={getActionColor(log.action)} />
        <View style={styles.logContent}>
          <Text style={styles.logText}>
            <Text style={{ color: getActionColor(log.action), fontWeight: 'bold' }}>
              {log.action.toUpperCase()}
            </Text>
            {' '}{log.heroName}
            {log.slot > 0 && ` in Slot ${log.slot}`}
          </Text>
          <Text style={styles.logTime}>
            {log.mode} • {log.timestamp.toLocaleTimeString()}
          </Text>
        </View>
      </View>
    );
  };

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark, COLORS.navy.primary]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>⚔️ Hero Manager</Text>
            <Text style={styles.headerSubtitle}>Arrange Teams for All Modes</Text>
          </View>
          <TouchableOpacity onPress={() => setShowChangeLogs(true)} style={styles.historyButton}>
            <Ionicons name="time" size={20} color={COLORS.gold.primary} />
            {changeLogs.length > 0 && (
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{Math.min(changeLogs.length, 99)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold.primary} />
            <Text style={styles.loadingText}>Loading heroes...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold.primary} />
            }
          >
            {/* Mode Selector */}
            <View style={styles.modeSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScrollContent}>
                {(Object.keys(GAME_MODES) as GameMode[]).map((mode) => {
                  const config = GAME_MODES[mode];
                  const isSelected = selectedMode === mode;
                  const hasTeam = modeTeams[mode] !== null;
                  
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeCard, isSelected && styles.modeCardSelected]}
                      onPress={() => {
                        if (hasChanges) {
                          Alert.alert(
                            'Unsaved Changes',
                            'You have unsaved changes. Save before switching modes?',
                            [
                              { text: 'Discard', style: 'destructive', onPress: () => setSelectedMode(mode) },
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Save', onPress: async () => { await saveTeam(); setSelectedMode(mode); } },
                            ]
                          );
                        } else {
                          setSelectedMode(mode);
                          if (modeTeams[mode]) {
                            loadTeamIntoSlots(modeTeams[mode]);
                          } else {
                            initializeSlots();
                          }
                        }
                      }}
                    >
                      <LinearGradient
                        colors={isSelected ? [config.color, config.color + '80'] : [COLORS.navy.medium, COLORS.navy.dark]}
                        style={styles.modeCardGradient}
                      >
                        <Ionicons 
                          name={config.icon as any} 
                          size={20} 
                          color={isSelected ? COLORS.cream.pure : config.color} 
                        />
                        <Text style={[styles.modeName, isSelected && styles.modeNameSelected]}>
                          {config.name}
                        </Text>
                        {hasTeam && (
                          <View style={[styles.modeTeamIndicator, { backgroundColor: config.color }]}>
                            <Ionicons name="checkmark" size={10} color={COLORS.cream.pure} />
                          </View>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Mode Info */}
            <View style={[styles.modeInfo, { borderLeftColor: GAME_MODES[selectedMode].color }]}>
              <Ionicons name={GAME_MODES[selectedMode].icon as any} size={24} color={GAME_MODES[selectedMode].color} />
              <View style={styles.modeInfoText}>
                <Text style={styles.modeInfoTitle}>{GAME_MODES[selectedMode].name} Team</Text>
                <Text style={styles.modeInfoDesc}>{GAME_MODES[selectedMode].description}</Text>
              </View>
              <View style={styles.powerBadge}>
                <Ionicons name="flash" size={14} color={COLORS.gold.primary} />
                <Text style={styles.powerText}>{teamPower.toLocaleString()}</Text>
              </View>
            </View>

            {/* Formation */}
            <View style={styles.formationContainer}>
              <Text style={styles.formationLabel}>
                <Ionicons name="shield" size={14} color={COLORS.gold.primary} /> Front Line (Tanks)
              </Text>
              <View style={styles.slotsRow}>
                {slots.filter(s => s.position === 'front').map(renderSlot)}
              </View>
              
              <Text style={styles.formationLabel}>
                <Ionicons name="flame" size={14} color={COLORS.rarity.UR} /> Back Line (DPS/Support)
              </Text>
              <View style={styles.slotsRow}>
                {slots.filter(s => s.position === 'back').map(renderSlot)}
              </View>
            </View>

            {/* Save Button */}
            <Animated.View style={[styles.saveSection, { transform: [{ scale: saveAnim }] }]}>
              <TouchableOpacity
                style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
                onPress={saveTeam}
                disabled={saving || !hasChanges}
              >
                <LinearGradient
                  colors={hasChanges ? [COLORS.gold.primary, COLORS.gold.dark] : [COLORS.navy.medium, COLORS.navy.dark]}
                  style={styles.saveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator color={COLORS.navy.darkest} />
                  ) : (
                    <>
                      <Ionicons name="save" size={20} color={hasChanges ? COLORS.navy.darkest : COLORS.cream.dark} />
                      <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
                        {hasChanges ? 'SAVE TEAM' : 'NO CHANGES'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              {hasChanges && (
                <Text style={styles.unsavedWarning}>
                  <Ionicons name="warning" size={12} color={COLORS.warning} /> Unsaved changes
                </Text>
              )}
            </Animated.View>

            {/* Help Text */}
            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>Tips</Text>
              <Text style={styles.helpText}>• Tap empty slot to add hero</Text>
              <Text style={styles.helpText}>• Long press hero to remove</Text>
              <Text style={styles.helpText}>• Front line takes damage first</Text>
              <Text style={styles.helpText}>• Changes are documented in history</Text>
            </View>
          </ScrollView>
        )}

        {/* Hero Selector Modal */}
        <Modal
          visible={showHeroSelector}
          animationType="slide"
          transparent
          onRequestClose={() => setShowHeroSelector(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Hero for Slot {selectedSlot}</Text>
                <TouchableOpacity onPress={() => setShowHeroSelector(false)}>
                  <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.heroList}>
                {userHeroes.length === 0 ? (
                  <View style={styles.emptyHeroes}>
                    <Ionicons name="people-outline" size={48} color={COLORS.cream.dark} />
                    <Text style={styles.emptyHeroesText}>No heroes available</Text>
                    <Text style={styles.emptyHeroesSubtext}>Summon heroes first!</Text>
                  </View>
                ) : (
                  userHeroes.map((hero) => {
                    const heroInfo = hero.hero_data;
                    const isInTeam = slots.some(s => s.heroId === hero.id);
                    
                    return (
                      <TouchableOpacity
                        key={hero.id}
                        style={[
                          styles.heroListItem,
                          { borderColor: getRarityColor(heroInfo?.rarity || 'SR') + '60' },
                          isInTeam && styles.heroListItemInTeam,
                        ]}
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
                          <View style={styles.heroListPower}>
                            <Ionicons name="flash" size={12} color={COLORS.gold.primary} />
                            <Text style={styles.heroListPowerText}>
                              {((heroInfo?.base_hp || 0) + (heroInfo?.base_atk || 0) * 3 + (heroInfo?.base_def || 0) * 2).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.heroListRight}>
                          <View style={[styles.rarityBadgeLarge, { backgroundColor: getRarityColor(heroInfo?.rarity || 'SR') }]}>
                            <Text style={styles.rarityBadgeText}>{heroInfo?.rarity}</Text>
                          </View>
                          {isInTeam && (
                            <View style={styles.inTeamBadge}>
                              <Text style={styles.inTeamText}>In Team</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Change Log Modal */}
        <Modal
          visible={showChangeLogs}
          animationType="slide"
          transparent
          onRequestClose={() => setShowChangeLogs(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📋 Change History</Text>
                <TouchableOpacity onPress={() => setShowChangeLogs(false)}>
                  <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.logList}>
                {changeLogs.length === 0 ? (
                  <View style={styles.emptyLogs}>
                    <Ionicons name="document-text-outline" size={48} color={COLORS.cream.dark} />
                    <Text style={styles.emptyLogsText}>No changes yet</Text>
                    <Text style={styles.emptyLogsSubtext}>Your team changes will appear here</Text>
                  </View>
                ) : (
                  changeLogs.map(renderChangeLog)
                )}
              </ScrollView>
              
              {changeLogs.length > 0 && (
                <TouchableOpacity
                  style={styles.clearLogsButton}
                  onPress={() => {
                    Alert.alert('Clear History', 'Clear all change history?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear', style: 'destructive', onPress: () => setChangeLogs([]) },
                    ]);
                  }}
                >
                  <Text style={styles.clearLogsText}>Clear History</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold.dark + '30',
  },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  headerSubtitle: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  historyButton: { padding: 8, position: 'relative' },
  historyBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBadgeText: { fontSize: 9, color: COLORS.cream.pure, fontWeight: 'bold' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12 },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Mode Selector
  modeSelector: { marginBottom: 16 },
  modeScrollContent: { gap: 8 },
  modeCard: {
    width: 90,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardSelected: { borderColor: COLORS.gold.primary },
  modeCardGradient: {
    padding: 12,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  modeName: { fontSize: 10, fontWeight: '600', color: COLORS.cream.soft, textAlign: 'center' },
  modeNameSelected: { color: COLORS.cream.pure },
  modeTeamIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mode Info
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    gap: 12,
  },
  modeInfoText: { flex: 1 },
  modeInfoTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  modeInfoDesc: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  powerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  powerText: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary },

  // Formation
  formationContainer: { marginBottom: 20 },
  formationLabel: { fontSize: 14, fontWeight: '600', color: COLORS.cream.soft, marginBottom: 10, marginLeft: 4 },
  slotsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },

  // Slots
  slotWrapper: { flex: 1 },
  slot: {
    aspectRatio: 0.75,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.navy.light + '40',
  },
  frontSlot: { borderColor: COLORS.gold.primary + '40' },
  backSlot: { borderColor: COLORS.rarity.UR + '40' },
  slotSelected: { borderColor: COLORS.gold.primary, borderWidth: 3 },
  slotContent: { flex: 1, padding: 6 },
  emptySlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy.medium,
  },
  slotLabel: { fontSize: 10, color: COLORS.navy.light, marginTop: 4 },
  slotHint: { fontSize: 8, color: COLORS.navy.light, marginTop: 2 },
  heroImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 4 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levelBadge: { backgroundColor: COLORS.navy.darkest, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  levelText: { fontSize: 8, color: COLORS.cream.pure, fontWeight: 'bold' },
  rankBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rankText: { fontSize: 8, color: COLORS.gold.primary, fontWeight: 'bold' },
  removeButton: { position: 'absolute', top: 2, right: 2 },
  positionBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  rarityIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomRightRadius: 6,
  },
  rarityIndicatorText: { fontSize: 7, fontWeight: 'bold', color: COLORS.cream.pure },

  // Save Section
  saveSection: { marginBottom: 16 },
  saveButton: { borderRadius: 12, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest, letterSpacing: 1 },
  saveButtonTextDisabled: { color: COLORS.cream.dark },
  unsavedWarning: { fontSize: 11, color: COLORS.warning, textAlign: 'center', marginTop: 8 },

  // Help Section
  helpSection: {
    backgroundColor: COLORS.navy.medium + '60',
    borderRadius: 12,
    padding: 12,
  },
  helpTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 8 },
  helpText: { fontSize: 11, color: COLORS.cream.dark, marginBottom: 4 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.navy.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold.dark + '30',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },

  // Hero List
  heroList: { padding: 12 },
  heroListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  heroListItemInTeam: { backgroundColor: COLORS.navy.dark, opacity: 0.7 },
  heroListImage: { width: 50, height: 50, borderRadius: 8 },
  heroListInfo: { flex: 1, marginLeft: 12 },
  heroListName: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  heroListStats: { fontSize: 11, color: COLORS.cream.dark },
  heroListPower: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heroListPowerText: { fontSize: 11, color: COLORS.gold.primary, fontWeight: '600' },
  heroListRight: { alignItems: 'flex-end', gap: 4 },
  rarityBadgeLarge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rarityBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  inTeamBadge: { backgroundColor: COLORS.success + '40', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inTeamText: { fontSize: 9, color: COLORS.success, fontWeight: '600' },
  emptyHeroes: { alignItems: 'center', paddingVertical: 40 },
  emptyHeroesText: { fontSize: 16, color: COLORS.cream.soft, marginTop: 12 },
  emptyHeroesSubtext: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },

  // Log List
  logList: { padding: 12, maxHeight: 400 },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  logContent: { flex: 1 },
  logText: { fontSize: 12, color: COLORS.cream.soft },
  logTime: { fontSize: 10, color: COLORS.cream.dark, marginTop: 2 },
  emptyLogs: { alignItems: 'center', paddingVertical: 40 },
  emptyLogsText: { fontSize: 16, color: COLORS.cream.soft, marginTop: 12 },
  emptyLogsSubtext: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
  clearLogsButton: {
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold.dark + '30',
  },
  clearLogsText: { fontSize: 14, color: COLORS.error, fontWeight: '600' },
});
