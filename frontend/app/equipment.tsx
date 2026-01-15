import React, { useEffect, useState } from 'react';
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
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { isErrorHandledGlobally } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Centralized API wrappers (no raw axios in screens)
import {
  getUserEquipment,
  getUserRunes,
  getEquipmentHeroes,
  enhanceEquipment as apiEnhanceEquipment,
} from '../lib/api';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  rarity: {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f97316',
  },
};

// API_BASE removed - using centralized lib/api.ts wrappers

const SLOT_ICONS: {[key: string]: string} = {
  weapon: 'flash',
  helmet: 'shield',
  chestplate: 'body',
  gloves: 'hand-left',
  boots: 'footsteps',
  talisman: 'star',
};

const SLOT_ORDER = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'talisman'];

export default function EquipmentScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [runes, setRunes] = useState<any[]>([]);
  const [userHeroes, setUserHeroes] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'sets'>('inventory');
  const [filterSlot, setFilterSlot] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && user) {
      loadData();
    }
  }, [hydrated, user?.username]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Use centralized API wrappers (parallel loads)
      const [equipmentData, runesData, heroesData] = await Promise.all([
        getUserEquipment(user.username),
        getUserRunes(user.username),
        getEquipmentHeroes(user.username),
      ]);
      setEquipment(equipmentData || []);
      setRunes(runesData || []);
      setUserHeroes(heroesData || []);
    } catch (error) {
      console.error('Error loading equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const enhanceEquipment = async (equipmentId: string, levels: number = 1) => {
    if (!user) return;
    try {
      // Use centralized API wrapper
      const result = await apiEnhanceEquipment(user.username, equipmentId, [{ id: 'enhance_stone', qty: levels }]);
      Alert.alert(
        '✨ Enhanced!',
        `Level ${result.new_level}\n${result.gold_spent} Gold\n${result.stones_spent} Stones`
      );
      fetchUser();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Enhancement failed');
    }
  };

  const getRarityColor = (rarity: string) => {
    return COLORS.rarity[rarity as keyof typeof COLORS.rarity] || COLORS.rarity.common;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const filteredEquipment = filterSlot
    ? equipment.filter(e => e.slot === filterSlot)
    : equipment;

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.dark, COLORS.navy.darkest]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.dark, COLORS.navy.darkest]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.dark, COLORS.navy.darkest]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>⚔️ Equipment</Text>
          <View style={styles.resourcesRow}>
            <View style={styles.resourceItem}>
              <Ionicons name="hammer" size={14} color={COLORS.gold.light} />
              <Text style={styles.resourceText}>{formatNumber(user.enhancement_stones || 0)}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'inventory' && styles.tabActive]}
            onPress={() => setActiveTab('inventory')}
          >
            <Ionicons name="grid" size={16} color={activeTab === 'inventory' ? COLORS.gold.primary : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>Inventory</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sets' && styles.tabActive]}
            onPress={() => setActiveTab('sets')}
          >
            <Ionicons name="layers" size={16} color={activeTab === 'sets' ? COLORS.gold.primary : COLORS.cream.dark} />
            <Text style={[styles.tabText, activeTab === 'sets' && styles.tabTextActive]}>Sets</Text>
          </TouchableOpacity>
        </View>

        {/* Slot Filters */}
        {activeTab === 'inventory' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotFilters}>
            <TouchableOpacity
              style={[styles.slotFilter, !filterSlot && styles.slotFilterActive]}
              onPress={() => setFilterSlot(null)}
            >
              <Text style={[styles.slotFilterText, !filterSlot && styles.slotFilterTextActive]}>All</Text>
            </TouchableOpacity>
            {SLOT_ORDER.map(slot => (
              <TouchableOpacity
                key={slot}
                style={[styles.slotFilter, filterSlot === slot && styles.slotFilterActive]}
                onPress={() => setFilterSlot(slot)}
              >
                <Ionicons
                  name={SLOT_ICONS[slot] as any}
                  size={16}
                  color={filterSlot === slot ? COLORS.gold.primary : COLORS.cream.dark}
                />
                <Text style={[styles.slotFilterText, filterSlot === slot && styles.slotFilterTextActive]}>
                  {slot.charAt(0).toUpperCase() + slot.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold.primary} />
            <Text style={styles.loadingText}>Loading equipment...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold.primary} />}
          >
            {activeTab === 'inventory' && (
              <>
                {filteredEquipment.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="cube-outline" size={64} color={COLORS.cream.dark} />
                    <Text style={styles.emptyText}>No equipment found</Text>
                    <Text style={styles.emptySubtext}>Complete dungeons to earn equipment!</Text>
                  </View>
                ) : (
                  <View style={styles.equipmentGrid}>
                    {filteredEquipment.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.equipmentCard, { borderColor: getRarityColor(item.rarity) }]}
                        onPress={() => { setSelectedItem(item); setShowItemModal(true); }}
                      >
                        <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(item.rarity) }]}>
                          <Text style={styles.rarityText}>{item.rarity.toUpperCase()}</Text>
                        </View>
                        <View style={styles.slotIconContainer}>
                          <Ionicons name={SLOT_ICONS[item.slot] as any} size={32} color={getRarityColor(item.rarity)} />
                        </View>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.itemLevel}>+{item.level}</Text>
                        <View style={styles.primaryStat}>
                          <Text style={styles.statText}>
                            {item.primary_stat.toUpperCase()}: +{item.primary_value}
                          </Text>
                        </View>
                        {item.set_id && (
                          <View style={styles.setBadge}>
                            <Text style={styles.setBadgeText}>{item.set_id}</Text>
                          </View>
                        )}
                        {item.equipped_by && (
                          <View style={styles.equippedBadge}>
                            <Ionicons name="checkmark-circle" size={12} color={COLORS.gold.primary} />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {activeTab === 'sets' && (
              <View style={styles.setsContainer}>
                {['warrior', 'mage', 'assassin', 'tank'].map((setId) => {
                  const setEquipment = equipment.filter(e => e.set_id === setId);
                  const pieceCount = setEquipment.length;
                  
                  return (
                    <View key={setId} style={styles.setCard}>
                      <View style={styles.setHeader}>
                        <Text style={styles.setName}>
                          {setId === 'warrior' && "⚔️ Warrior's Might"}
                          {setId === 'mage' && "🔮 Arcane Vestments"}
                          {setId === 'assassin' && "🗡️ Shadow's Edge"}
                          {setId === 'tank' && "🛡️ Guardian's Bastion"}
                        </Text>
                        <Text style={styles.setPieceCount}>{pieceCount}/6</Text>
                      </View>
                      
                      <View style={styles.bonusList}>
                        <View style={[styles.bonusItem, pieceCount >= 2 && styles.bonusActive]}>
                          <Text style={[styles.bonusText, pieceCount >= 2 && styles.bonusTextActive]}>
                            2pc: {setId === 'warrior' ? '+10% ATK' : setId === 'mage' ? '+12% ATK' : setId === 'assassin' ? '+8% CRIT' : '+15% HP'}
                          </Text>
                        </View>
                        <View style={[styles.bonusItem, pieceCount >= 4 && styles.bonusActive]}>
                          <Text style={[styles.bonusText, pieceCount >= 4 && styles.bonusTextActive]}>
                            4pc: {setId === 'warrior' ? '+20% ATK, +10% HP' : setId === 'mage' ? '+25% ATK, +15 SPD' : setId === 'assassin' ? '+15% CRIT, +20% CDMG' : '+25% HP, +15% DEF'}
                          </Text>
                        </View>
                        <View style={[styles.bonusItem, pieceCount >= 6 && styles.bonusActive]}>
                          <Text style={[styles.bonusText, pieceCount >= 6 && styles.bonusTextActive]}>
                            6pc: Full Set Bonus
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.setPieces}>
                        {SLOT_ORDER.map(slot => {
                          const piece = setEquipment.find(e => e.slot === slot);
                          return (
                            <View key={slot} style={[styles.pieceSlot, piece && { borderColor: getRarityColor(piece.rarity) }]}>
                              <Ionicons
                                name={SLOT_ICONS[slot] as any}
                                size={18}
                                color={piece ? getRarityColor(piece.rarity) : COLORS.cream.dark}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* Item Detail Modal */}
        <Modal
          visible={showItemModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowItemModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <LinearGradient colors={[COLORS.navy.primary, COLORS.navy.dark]} style={styles.modalGradient}>
                {selectedItem && (
                  <>
                    <View style={styles.modalHeader}>
                      <View style={[styles.modalRarityBadge, { backgroundColor: getRarityColor(selectedItem.rarity) }]}>
                        <Text style={styles.modalRarityText}>{selectedItem.rarity.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowItemModal(false)}>
                        <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modalItemIcon}>
                      <Ionicons
                        name={SLOT_ICONS[selectedItem.slot] as any}
                        size={48}
                        color={getRarityColor(selectedItem.rarity)}
                      />
                    </View>

                    <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                    <Text style={styles.modalItemLevel}>+{selectedItem.level} / {selectedItem.max_level}</Text>

                    <View style={styles.statsSection}>
                      <Text style={styles.sectionTitle}>Stats</Text>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>{selectedItem.primary_stat.toUpperCase()}</Text>
                        <Text style={styles.statValue}>+{selectedItem.primary_value}</Text>
                      </View>
                      {Object.entries(selectedItem.sub_stats || {}).map(([stat, value]) => (
                        <View key={stat} style={styles.statRow}>
                          <Text style={styles.subStatLabel}>{stat.replace('_', ' ').toUpperCase()}</Text>
                          <Text style={styles.subStatValue}>+{value}%</Text>
                        </View>
                      ))}
                    </View>

                    {selectedItem.sockets > 0 && (
                      <View style={styles.socketsSection}>
                        <Text style={styles.sectionTitle}>Sockets ({selectedItem.equipped_runes?.length || 0}/{selectedItem.sockets})</Text>
                        <View style={styles.socketsRow}>
                          {[...Array(selectedItem.sockets)].map((_, i) => (
                            <View key={i} style={[styles.socket, selectedItem.equipped_runes?.[i] && styles.socketFilled]}>
                              <Ionicons
                                name={selectedItem.equipped_runes?.[i] ? 'diamond' : 'diamond-outline'}
                                size={20}
                                color={selectedItem.equipped_runes?.[i] ? COLORS.gold.primary : COLORS.cream.dark}
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {selectedItem.set_id && (
                      <View style={styles.setInfo}>
                        <Text style={styles.setInfoText}>
                          Set: {selectedItem.set_id.charAt(0).toUpperCase() + selectedItem.set_id.slice(1)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.modalActions}>
                      {selectedItem.level < selectedItem.max_level && (
                        <TouchableOpacity
                          style={styles.enhanceButton}
                          onPress={() => {
                            setShowItemModal(false);
                            enhanceEquipment(selectedItem.id, 1);
                          }}
                        >
                          <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.enhanceButtonGradient}>
                            <Ionicons name="arrow-up" size={18} color={COLORS.navy.darkest} />
                            <Text style={styles.enhanceButtonText}>Enhance +1</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </LinearGradient>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navy.light + '30',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  resourcesRow: { flexDirection: 'row', gap: 12 },
  resourceItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resourceText: { color: COLORS.gold.light, fontWeight: '600', fontSize: 12 },

  tabs: { flexDirection: 'row', padding: 8, gap: 8 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 8,
    backgroundColor: COLORS.navy.medium,
  },
  tabActive: { backgroundColor: COLORS.gold.primary + '30', borderWidth: 1, borderColor: COLORS.gold.primary },
  tabText: { color: COLORS.cream.dark, fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: COLORS.gold.primary },

  slotFilters: { paddingHorizontal: 8, paddingBottom: 8, maxHeight: 50 },
  slotFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.navy.medium,
    marginRight: 8,
  },
  slotFilterActive: { backgroundColor: COLORS.gold.primary + '30', borderWidth: 1, borderColor: COLORS.gold.primary },
  slotFilterText: { color: COLORS.cream.dark, fontSize: 12 },
  slotFilterTextActive: { color: COLORS.gold.primary },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.cream.soft, marginTop: 12 },

  scrollView: { flex: 1, padding: 8 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, color: COLORS.cream.dark, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.cream.dark, marginTop: 4 },

  equipmentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  equipmentCard: {
    width: '48%',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    position: 'relative',
  },
  rarityBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rarityText: { color: COLORS.cream.pure, fontSize: 8, fontWeight: 'bold' },
  slotIconContainer: { marginVertical: 8 },
  itemName: { color: COLORS.cream.pure, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  itemLevel: { color: COLORS.gold.primary, fontSize: 16, fontWeight: 'bold' },
  primaryStat: { marginTop: 4 },
  statText: { color: COLORS.cream.soft, fontSize: 10 },
  setBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: COLORS.navy.dark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  setBadgeText: { color: COLORS.gold.light, fontSize: 8 },
  equippedBadge: { position: 'absolute', top: 8, right: 8 },

  setsContainer: { paddingBottom: 32 },
  setCard: {
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  setHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  setName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  setPieceCount: { fontSize: 14, color: COLORS.gold.primary, fontWeight: '600' },
  bonusList: { marginBottom: 12 },
  bonusItem: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, marginBottom: 4, backgroundColor: COLORS.navy.dark },
  bonusActive: { backgroundColor: COLORS.gold.primary + '30' },
  bonusText: { color: COLORS.cream.dark, fontSize: 12 },
  bonusTextActive: { color: COLORS.gold.primary },
  setPieces: { flexDirection: 'row', justifyContent: 'space-between' },
  pieceSlot: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.navy.light,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 360, borderRadius: 16, overflow: 'hidden' },
  modalGradient: { padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalRarityBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  modalRarityText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 12 },
  modalItemIcon: { alignItems: 'center', marginBottom: 12 },
  modalItemName: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  modalItemLevel: { fontSize: 14, color: COLORS.gold.primary, textAlign: 'center', marginBottom: 16 },
  statsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.soft, marginBottom: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statLabel: { color: COLORS.cream.pure, fontWeight: '600' },
  statValue: { color: COLORS.gold.primary, fontWeight: '600' },
  subStatLabel: { color: COLORS.cream.dark, fontSize: 12 },
  subStatValue: { color: COLORS.gold.light, fontSize: 12 },
  socketsSection: { marginBottom: 16 },
  socketsRow: { flexDirection: 'row', gap: 8 },
  socket: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.navy.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socketFilled: { borderColor: COLORS.gold.primary },
  setInfo: { marginBottom: 16 },
  setInfoText: { color: COLORS.gold.light, fontSize: 12 },
  modalActions: { marginTop: 8 },
  enhanceButton: { borderRadius: 12, overflow: 'hidden' },
  enhanceButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  enhanceButtonText: { color: COLORS.navy.darkest, fontWeight: 'bold', fontSize: 16 },
});
