import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
// Phase 3.18.4: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';
// Phase 3.19.10: Canonical confirm modal
import { ConfirmModal, ConfirmModalData } from '../components/ui/ConfirmModal';

interface ResourceItem {
  id: string;
  name: string;
  type: 'currency' | 'material' | 'consumable' | 'ticket';
  amount: number;
  icon: string;
  description: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export default function ResourceBagScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'currency' | 'material' | 'consumable' | 'ticket'>('all');
  const [selectedItem, setSelectedItem] = useState<ResourceItem | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);

  useEffect(() => {
    if (hydrated && user) {
      buildResourceList();
    }
  }, [hydrated, user]);

  const buildResourceList = () => {
    if (!user) return;
    
    const items: ResourceItem[] = [
      // Currencies
      { id: 'gems', name: 'Gems', type: 'currency', amount: user.gems || 0, icon: '💎', description: 'Premium currency for gacha pulls and special purchases', rarity: 'epic' },
      { id: 'gold', name: 'Gold', type: 'currency', amount: user.gold || 0, icon: '⭐', description: 'Used for hero upgrades and enhancements', rarity: 'rare' },
      { id: 'coins', name: 'Coins', type: 'currency', amount: user.coins || 0, icon: '🪙', description: 'Basic currency for everyday purchases', rarity: 'common' },
      { id: 'crystals', name: 'Crystals', type: 'currency', amount: user.crystals || 0, icon: '🔮', description: 'Used for awakening and transcendence', rarity: 'legendary' },
      { id: 'divine_essence', name: 'Divine Essence', type: 'currency', amount: user.divine_essence || 0, icon: '✨', description: 'Rare essence for divine summons', rarity: 'legendary' },
      { id: 'arena_coins', name: 'Arena Coins', type: 'currency', amount: user.arena_coins || 0, icon: '🏆', description: 'Earned from PvP Arena battles', rarity: 'rare' },
      { id: 'guild_coins', name: 'Guild Coins', type: 'currency', amount: user.guild_coins || 0, icon: '⚔️', description: 'Earned from Guild activities', rarity: 'rare' },
      
      // Materials
      { id: 'enhancement_stones', name: 'Enhancement Stones', type: 'material', amount: user.enhancement_stones || 100, icon: '🔶', description: 'Used to level up equipment', rarity: 'common' },
      { id: 'awakening_shards', name: 'Awakening Shards', type: 'material', amount: user.awakening_shards || 50, icon: '💫', description: 'Required for hero awakening', rarity: 'epic' },
      { id: 'skill_books', name: 'Skill Books', type: 'material', amount: user.skill_books || 25, icon: '📖', description: 'Level up hero skills', rarity: 'rare' },
      { id: 'rune_essence', name: 'Rune Essence', type: 'material', amount: user.rune_essence || 30, icon: '🔮', description: 'Craft and upgrade runes', rarity: 'epic' },
      
      // Consumables
      { id: 'stamina_potion', name: 'Stamina Potion', type: 'consumable', amount: user.stamina_potions || 10, icon: '⚡', description: 'Restores 60 stamina', rarity: 'common' },
      { id: 'exp_boost', name: 'EXP Boost (2x)', type: 'consumable', amount: user.exp_boosts || 5, icon: '📊', description: '2x EXP for 1 hour', rarity: 'rare' },
      { id: 'gold_boost', name: 'Gold Boost (2x)', type: 'consumable', amount: user.gold_boosts || 3, icon: '💰', description: '2x Gold for 1 hour', rarity: 'rare' },
      
      // Tickets
      { id: 'hero_ticket', name: 'Hero Ticket', type: 'ticket', amount: user.hero_tickets || 5, icon: '🎫', description: 'One free gacha pull', rarity: 'epic' },
      { id: 'legendary_ticket', name: 'Legendary Ticket', type: 'ticket', amount: user.legendary_tickets || 1, icon: '🌟', description: 'Guaranteed SR+ hero', rarity: 'legendary' },
      { id: 'equipment_ticket', name: 'Equipment Ticket', type: 'ticket', amount: user.equipment_tickets || 3, icon: '📦', description: 'Free equipment draw', rarity: 'rare' },
    ];
    
    setResources(items);
  };

  const useConsumable = async (item: ResourceItem) => {
    if (item.type !== 'consumable' || item.amount <= 0) return;
    
    // ALERT_ALLOWED: purchase_confirm
    Alert.alert(
      `Use ${item.name}?`,
      item.description,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Use', 
          onPress: () => {
            // Update local state
            setResources(prev => prev.map(r => 
              r.id === item.id ? { ...r, amount: r.amount - 1 } : r
            ));
            setSelectedItem(null);
            // Phase 3.18.4: Toast for success feedback
            toast.success(`${item.name} activated!`);
          }
        },
      ]
    );
  };

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'legendary': return ['#FFD700', '#FFA500'];
      case 'epic': return ['#9333ea', '#7c3aed'];
      case 'rare': return ['#3b82f6', '#2563eb'];
      default: return [COLORS.navy.light, COLORS.navy.medium];
    }
  };

  const filteredResources = activeTab === 'all' 
    ? resources 
    : resources.filter(r => r.type === activeTab);

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading Inventory...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const renderItem = ({ item }: { item: ResourceItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => setSelectedItem(item)}
    >
      <LinearGradient colors={getRarityColor(item.rarity)} style={styles.itemGradient}>
        <Text style={styles.itemIcon}>{item.icon}</Text>
        <Text style={styles.itemAmount}>{item.amount.toLocaleString()}</Text>
      </LinearGradient>
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🎒 Resource Bag</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal style={styles.tabsContainer} showsHorizontalScrollIndicator={false}>
          {(['all', 'currency', 'material', 'consumable', 'ticket'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Resources Grid */}
        <FlatList
          data={filteredResources}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={4}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={COLORS.cream.dark} />
              <Text style={styles.emptyText}>No items in this category</Text>
            </View>
          }
        />

        {/* Item Detail Modal */}
        <Modal
          visible={!!selectedItem}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedItem(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.itemModal}>
              <LinearGradient colors={[COLORS.navy.primary, COLORS.navy.dark]} style={styles.modalGradient}>
                {selectedItem && (
                  <>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedItem(null)}>
                      <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                    </TouchableOpacity>
                    
                    <View style={styles.modalIconContainer}>
                      <LinearGradient colors={getRarityColor(selectedItem.rarity)} style={styles.modalIconBg}>
                        <Text style={styles.modalIcon}>{selectedItem.icon}</Text>
                      </LinearGradient>
                    </View>
                    
                    <Text style={styles.modalName}>{selectedItem.name}</Text>
                    <Text style={styles.modalAmount}>x{selectedItem.amount.toLocaleString()}</Text>
                    
                    <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(selectedItem.rarity)[0] + '40' }]}>
                      <Text style={[styles.rarityText, { color: getRarityColor(selectedItem.rarity)[0] }]}>
                        {selectedItem.rarity?.toUpperCase() || 'COMMON'}
                      </Text>
                    </View>
                    
                    <Text style={styles.modalDesc}>{selectedItem.description}</Text>
                    
                    {selectedItem.type === 'consumable' && selectedItem.amount > 0 && (
                      <TouchableOpacity style={styles.useButton} onPress={() => useConsumable(selectedItem)}>
                        <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.useButtonGradient}>
                          <Text style={styles.useButtonText}>Use Item</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    
                    {selectedItem.type === 'ticket' && selectedItem.amount > 0 && (
                      <TouchableOpacity style={styles.useButton} onPress={() => {
                        setSelectedItem(null);
                        router.push('/gacha');
                      }}>
                        <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.useButtonGradient}>
                          <Text style={styles.useButtonText}>Go to Gacha</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  loginBtn: { marginTop: 16, backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: COLORS.navy.darkest, fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gold.primary + '30' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },

  tabsContainer: { maxHeight: 50, paddingHorizontal: 12, paddingVertical: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: COLORS.navy.medium },
  tabActive: { backgroundColor: COLORS.gold.primary },
  tabText: { fontSize: 12, color: COLORS.cream.dark, fontWeight: '600' },
  tabTextActive: { color: COLORS.navy.darkest },

  gridContainer: { padding: 12 },
  itemCard: { width: '25%', padding: 6 },
  itemGradient: { aspectRatio: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 8 },
  itemIcon: { fontSize: 24, marginBottom: 4 },
  itemAmount: { fontSize: 11, color: '#fff', fontWeight: 'bold' },
  itemName: { fontSize: 10, color: COLORS.cream.dark, textAlign: 'center', marginTop: 4 },

  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.cream.dark, marginTop: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  itemModal: { width: '100%', maxWidth: 320, borderRadius: 20, overflow: 'hidden' },
  modalGradient: { padding: 24, alignItems: 'center' },
  modalClose: { position: 'absolute', top: 16, right: 16 },
  modalIconContainer: { marginBottom: 16 },
  modalIconBg: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  modalIcon: { fontSize: 40 },
  modalName: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 4 },
  modalAmount: { fontSize: 16, color: COLORS.gold.primary, fontWeight: '600', marginBottom: 12 },
  rarityBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12 },
  rarityText: { fontSize: 11, fontWeight: 'bold' },
  modalDesc: { fontSize: 13, color: COLORS.cream.dark, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  useButton: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  useButtonGradient: { paddingVertical: 14, alignItems: 'center' },
  useButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});