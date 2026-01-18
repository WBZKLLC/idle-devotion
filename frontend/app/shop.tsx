// /app/frontend/app/shop.tsx
// Phase 3.30: Store & Economy Screen
//
// Sanctuary screen for store with purchase intent flow.
// DEV-only redeem produces canonical receipt.
// No real billing in this scaffold.
//
// Tone: "Treasures await."

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';
import { haptic, PRESS } from '../lib/ui/interaction';
import { useGameStore, useHydration } from '../stores/gameStore';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { toast } from '../components/ui/Toast';
import { track, Events } from '../lib/telemetry/events';
import { RewardReceipt, isValidReceipt, formatReceiptItems } from '../lib/types/receipt';
import { triggerBadgeRefresh } from '../lib/ui/badges';
import { getStoreCatalog, createPurchaseIntent, redeemIntent, StoreItem, PurchaseIntent } from '../lib/api/store';

// Check if dev mode (for redeem button)
const IS_DEV = __DEV__;

export default function ShopScreen() {
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalog, setCatalog] = useState<StoreItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [intent, setIntent] = useState<PurchaseIntent | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  
  const loadData = useCallback(async () => {
    try {
      const items = await getStoreCatalog();
      setCatalog(items);
      
      // Emit telemetry
      track(Events.STORE_VIEWED, { itemCount: items.length });
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    if (hydrated && user) {
      loadData();
    } else if (hydrated && !user) {
      setLoading(false);
    }
  }, [hydrated, user, loadData]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);
  
  const handleSelectItem = (item: StoreItem) => {
    track(Events.STORE_ITEM_SELECTED, { sku: item.sku });
    setSelectedItem(item);
    setIntent(null);
    haptic('light');
  };
  
  const handleCreateIntent = async () => {
    if (!selectedItem) return;
    
    setCreatingIntent(true);
    try {
      const newIntent = await createPurchaseIntent(selectedItem.sku);
      setIntent(newIntent);
      toast.success('Purchase intent created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Not now.');
    } finally {
      setCreatingIntent(false);
    }
  };
  
  const handleRedeem = async () => {
    if (!intent) return;
    
    setRedeeming(true);
    try {
      const receipt = await redeemIntent(intent.intentId);
      
      if (isValidReceipt(receipt)) {
        if (receipt.alreadyClaimed) {
          toast.info('Already redeemed.');
        } else {
          toast.success(`Redeemed: ${formatReceiptItems(receipt)}`);
          await fetchUser();
        }
      } else {
        toast.success('Redeemed!');
      }
      
      triggerBadgeRefresh();
      setSelectedItem(null);
      setIntent(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Not now.');
    } finally {
      setRedeeming(false);
    }
  };
  
  // Loading state
  if (!hydrated || (loading && user)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Auth gate
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.authGate}>
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.authGateTitle}>Sign in required</Text>
          <Text style={styles.authGateSubtitle}>Treasures await.</Text>
          <View style={styles.authGateButton}>
            <PrimaryButton 
              title="Go to Login" 
              onPress={() => router.push('/')} 
              variant="gold" 
              size="md" 
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => { haptic('light'); router.back(); }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
        </Pressable>
        <Text style={styles.headerTitle}>Shop</Text>
        <View style={styles.headerRight}>
          {/* Subscription/Pro link */}
          <Pressable 
            style={styles.proButton}
            onPress={() => router.push('/subscription')}
          >
            <Ionicons name="diamond" size={18} color={COLORS.gold.primary} />
            <Text style={styles.proButtonText}>PRO</Text>
          </Pressable>
          {/* Phase 3.49: VIP link */}
          <Pressable 
            style={styles.vipButton}
            onPress={() => router.push('/vip')}
          >
            <Ionicons name="star" size={18} color={COLORS.gold.primary} />
            <Text style={styles.vipButtonText}>VIP</Text>
          </Pressable>
          {IS_DEV && (
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>DEV</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold.primary}
          />
        }
      >
        {catalog.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={48} color={COLORS.cream.dark} />
            <Text style={styles.emptyTitle}>Shop Unavailable</Text>
            <Text style={styles.emptySubtitle}>Check back soon.</Text>
          </View>
        ) : (
          <View style={styles.catalogGrid}>
            {catalog.map((item) => (
              <Pressable
                key={item.sku}
                style={({ pressed }) => [
                  styles.catalogCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleSelectItem(item)}
              >
                {item.tag && (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>{item.tag}</Text>
                  </View>
                )}
                <View style={styles.cardIcon}>
                  <Ionicons 
                    name={item.sku.includes('gem') ? 'diamond' : item.sku.includes('gold') ? 'logo-usd' : 'flash'}
                    size={32} 
                    color={COLORS.gold.primary} 
                  />
                </View>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.desc && <Text style={styles.cardDesc}>{item.desc}</Text>}
                <View style={styles.priceContainer}>
                  <Text style={styles.priceText}>{item.priceText}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      
      {/* Purchase Modal */}
      {selectedItem && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedItem(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedItem(null)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedItem.name}</Text>
                <Text style={styles.modalSubtitle}>{selectedItem.priceText}</Text>
              </View>
              
              {selectedItem.desc && (
                <Text style={styles.modalDesc}>{selectedItem.desc}</Text>
              )}
              
              {!intent ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.buyButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleCreateIntent}
                  disabled={creatingIntent}
                >
                  {creatingIntent ? (
                    <ActivityIndicator size="small" color={COLORS.navy.darkest} />
                  ) : (
                    <Text style={styles.buyButtonText}>Buy</Text>
                  )}
                </Pressable>
              ) : (
                <View style={styles.intentConfirm}>
                  <View style={styles.intentInfo}>
                    <Text style={styles.intentLabel}>Intent Created</Text>
                    <Text style={styles.intentId}>{intent.intentId.slice(0, 8)}...</Text>
                  </View>
                  
                  {IS_DEV && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.redeemButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={handleRedeem}
                      disabled={redeeming}
                    >
                      {redeeming ? (
                        <ActivityIndicator size="small" color={COLORS.cream.pure} />
                      ) : (
                        <Text style={styles.redeemButtonText}>Redeem (DEV)</Text>
                      )}
                    </Pressable>
                  )}
                  
                  <Text style={styles.intentNote}>
                    {IS_DEV 
                      ? 'DEV mode: Redeem without payment'
                      : 'Complete payment in your app store'
                    }
                  </Text>
                </View>
              )}
              
              <Pressable 
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
                onPress={() => { setSelectedItem(null); setIntent(null); }}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
  },
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    gap: 12,
  },
  authGateTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginTop: 8,
  },
  authGateSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  authGateButton: {
    marginTop: 16,
    width: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '08',
  },
  backButton: {
    padding: 4,
    borderRadius: RADIUS.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    letterSpacing: 0.5,
  },
  headerRight: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  devBadge: {
    backgroundColor: COLORS.violet.dark,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  devBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.violet.light,
  },
  // Phase 3.49: VIP button
  vipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.navy.light,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  vipButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.primary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: LAYOUT.SCREEN_PADDING,
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  catalogCard: {
    width: '47%',
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '10',
  },
  tagBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.navy.darkest,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.navy.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.cream.dark,
    textAlign: 'center',
    marginBottom: 8,
  },
  priceContainer: {
    backgroundColor: COLORS.gold.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '40',
  },
  priceText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: LAYOUT.SCREEN_PADDING,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.navy.dark,
    borderRadius: RADIUS.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '30',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gold.primary,
  },
  modalDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.soft,
    textAlign: 'center',
    marginBottom: 16,
  },
  buyButton: {
    backgroundColor: COLORS.gold.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buyButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.navy.darkest,
  },
  intentConfirm: {
    gap: 12,
  },
  intentInfo: {
    backgroundColor: COLORS.navy.darkest,
    padding: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  intentLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    marginBottom: 4,
  },
  intentId: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.soft,
    fontFamily: 'monospace',
  },
  redeemButton: {
    backgroundColor: COLORS.violet.dark,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.violet.light + '40',
  },
  redeemButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
  },
  intentNote: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.cream.dark,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalCloseBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.navy.darkest,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '15',
  },
  modalCloseBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.soft,
  },
  pressed: {
    opacity: PRESS.OPACITY,
    transform: [{ scale: PRESS.SCALE }],
  },
});
