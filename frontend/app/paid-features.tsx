/**
 * Premium Features Screen
 * 
 * Shows purchasable premium features.
 * Currently: Premium Cinematics ($9.99)
 * 
 * CANONICAL PURCHASE FLOW:
 * - Uses PurchaseButton for all purchases
 * - DEV grant/revoke is guarded behind __DEV__
 * - No direct purchase verification calls
 * 
 * Payment flow is NOT implemented yet - this is UI wiring only.
 * DEV mode provides grant/revoke buttons for testing.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ENTITLEMENTS, premiumCinematicOwnedKey } from '../lib/entitlements';
import { ENTITLEMENT_KEYS } from '../lib/entitlements/types';
import { useEntitlementStore } from '../stores/entitlementStore';
import { useHasEntitlement } from '../lib/entitlements/gating';
import { useGameStore } from '../stores/gameStore';
import PurchaseButton from '../components/PurchaseButton';
import COLORS from '../theme/colors';
// Phase 3.18.7: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';
// Phase 3.19.10: Canonical confirm modal
import { ConfirmModal, ConfirmModalData } from '../components/ui/ConfirmModal';

// DEV-only flag - set to false to disable DEV tools even in __DEV__ mode
const ENABLE_DEV_TOOLS = __DEV__;

export default function PaidFeaturesScreen() {
  // Subscribe directly to entitlements state for proper reactivity
  const entitlements = useEntitlementStore(s => s.entitlements);
  const setEntitlement = useEntitlementStore(s => s.setEntitlement);
  const grantDev = useEntitlementStore(s => s.grantEntitlementDevOnly);
  const revokeDev = useEntitlementStore(s => s.revokeEntitlementDevOnly);
  const setHeroPremiumCinematicOwned = useEntitlementStore(s => s.setHeroPremiumCinematicOwned);
  
  // Get user's actual heroes from game store
  const user = useGameStore(s => s.user);
  const userHeroes = useGameStore(s => s.userHeroes);
  const fetchUserHeroes = useGameStore(s => s.fetchUserHeroes);
  
  // Fetch heroes if not already loaded (for DEV tools)
  useEffect(() => {
    if (__DEV__ && user?.username && (!userHeroes || userHeroes.length === 0)) {
      fetchUserHeroes();
    }
  }, [user?.username, userHeroes?.length, fetchUserHeroes]);
  
  const heroList = useMemo(() => {
    return (userHeroes || []).map((h: any) => ({
      id: h.hero_id || h.id || '',
      name: h.hero_data?.name || h.name || 'Unknown',
    })).filter((h: any) => h.id);
  }, [userHeroes]);

  // DEV: text input for custom hero ID
  const [customHeroId, setCustomHeroId] = useState('');

  const item = useMemo(() => ENTITLEMENTS.PREMIUM_CINEMATICS_PACK, []);
  const packOwned = useHasEntitlement(ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK);

  // Count how many heroes have premium cinematics owned
  const ownedHeroCount = useMemo(() => {
    return Object.keys(entitlements || {}).filter(k => k.startsWith('PREMIUM_CINEMATIC_OWNED:')).length;
  }, [entitlements]);

  const handlePurchase = () => {
    toast.info('Payment flow (StoreKit/Play Billing) is not enabled yet. This is the paywall UI wiring only.');
  };

  const handleRestore = () => {
    toast.info('Purchase restoration will be available when payments are enabled.');
  };

  // DEV: Grant/revoke pack (guarded by ENABLE_DEV_TOOLS)
  const handleDevGrantPack = async () => {
    if (!ENABLE_DEV_TOOLS) return;
    try {
      await grantDev(ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK);
      toast.success('[DEV] Granted PREMIUM_CINEMATICS_PACK entitlement.');
    } catch (e: any) {
      if (__DEV__) console.warn('[DEV] Grant pack failed:', e.message);
    }
  };

  const handleDevRevokePack = async () => {
    if (!ENABLE_DEV_TOOLS) return;
    try {
      await revokeDev(ENTITLEMENT_KEYS.PREMIUM_CINEMATICS_PACK);
      toast.success('[DEV] Revoked PREMIUM_CINEMATICS_PACK entitlement.');
    } catch (e: any) {
      if (__DEV__) console.warn('[DEV] Revoke pack failed:', e.message);
    }
  };

  // DEV: Grant per-hero premium cinematic ownership (guarded)
  const handleDevGrantHero = async (heroId: string) => {
    if (!ENABLE_DEV_TOOLS) return;
    if (!heroId.trim()) {
      toast.warning('Please enter a hero ID');
      return;
    }
    try {
      await setHeroPremiumCinematicOwned(heroId.trim(), true);
      toast.success(`[DEV] Granted premium cinematic ownership for: ${heroId.trim()}`);
      setCustomHeroId('');
    } catch (e: any) {
      if (__DEV__) console.warn('[DEV] Grant hero failed:', e.message);
    }
  };

  // DEV: Revoke per-hero premium cinematic ownership (guarded)
  const handleDevRevokeHero = async (heroId: string) => {
    if (!ENABLE_DEV_TOOLS) return;
    try {
      await setHeroPremiumCinematicOwned(heroId, false);
      toast.success(`[DEV] Revoked premium cinematic ownership for: ${heroId}`);
    } catch (e: any) {
      if (__DEV__) console.warn('[DEV] Revoke hero failed:', e.message);
    }
  };

  // Check if a hero has premium cinematic owned
  const isHeroOwned = (heroId: string) => {
    return Boolean(entitlements?.[premiumCinematicOwnedKey(heroId)]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0B10', '#12131A', '#0A0B10']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium Features</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.subtitle}>
            Unlock premium content for Idle Devotion.
          </Text>

          {/* Premium Cinematics Pack Feature Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="videocam" size={28} color={COLORS.gold.primary} />
              </View>
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.badge, packOwned ? styles.badgeOwned : styles.badgeLocked]}>
                  <Text style={styles.badgeText}>{packOwned ? '✓ Owned' : 'Locked'}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>${item.priceUsd.toFixed(2)}</Text>
              <Text style={styles.currency}>USD</Text>
            </View>

            {/* Purchase Button */}
            <TouchableOpacity
              style={[styles.purchaseButton, packOwned && styles.purchaseButtonDisabled]}
              disabled={packOwned}
              onPress={handlePurchase}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={packOwned ? ['#444', '#333'] : ['#9B2CFF', '#7B1FA2']}
                style={styles.purchaseGradient}
              >
                <Ionicons 
                  name={packOwned ? 'checkmark-circle' : 'cart'} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.purchaseText}>
                  {packOwned ? 'Unlocked' : 'Purchase'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* DEV Mode - Pack Controls */}
            {__DEV__ && (
              <View style={styles.devSection}>
                <Text style={styles.devLabel}>DEV MODE — Pack Controls</Text>
                <View style={styles.devButtonRow}>
                  {!packOwned ? (
                    <TouchableOpacity
                      style={styles.devButton}
                      onPress={handleDevGrantPack}
                    >
                      <Text style={styles.devButtonText}>Grant Pack</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.devButton, styles.devButtonRevoke]}
                      onPress={handleDevRevokePack}
                    >
                      <Text style={styles.devButtonText}>Revoke Pack</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* DEV Mode - Per-Hero Ownership */}
          {__DEV__ && (
            <View style={styles.devCard}>
              <Text style={styles.devCardTitle}>DEV: Per-Hero Premium Cinematic Ownership</Text>
              <Text style={styles.devCardSubtitle}>
                Owning a hero's Premium Cinematic grants +10% HP, +5% ATK to that hero.
              </Text>
              <Text style={styles.devCardSubtitle}>
                Currently owned: {ownedHeroCount} hero premium cinematics
              </Text>

              {/* Custom Hero ID Input */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.heroInput}
                  value={customHeroId}
                  onChangeText={setCustomHeroId}
                  placeholder="Enter hero_id..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.grantButton}
                  onPress={() => handleDevGrantHero(customHeroId)}
                >
                  <Text style={styles.grantButtonText}>Grant</Text>
                </TouchableOpacity>
              </View>

              {/* User's Hero List */}
              <Text style={styles.sampleLabel}>Your Heroes (click to toggle):</Text>
              {heroList.length === 0 ? (
                <Text style={styles.noHeroesText}>No heroes found. Login and collect heroes first.</Text>
              ) : (
                <View style={styles.heroList}>
                  {heroList.slice(0, 12).map((hero: any) => {
                    const owned = isHeroOwned(hero.id);
                    return (
                      <TouchableOpacity
                        key={hero.id}
                        style={[styles.heroChip, owned && styles.heroChipOwned]}
                        onPress={() => owned ? handleDevRevokeHero(hero.id) : handleDevGrantHero(hero.id)}
                      >
                        <Text style={[styles.heroChipText, owned && styles.heroChipTextOwned]} numberOfLines={1}>
                          {owned ? '✓ ' : ''}{hero.name.split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Restore Purchases */}
          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Footer Note */}
          <Text style={styles.footerNote}>
            Purchases will be verified server-side when payments are enabled.
            {__DEV__ && ' Use DEV buttons above to test unlock flow and stat bonuses.'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0B10',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.cream.pure,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 100,
  },
  subtitle: {
    color: 'rgba(245,240,232,0.75)',
    fontSize: 14,
    marginBottom: 20,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(243, 201, 105, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.cream.pure,
  },
  badge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeOwned: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
  },
  badgeLocked: {
    backgroundColor: 'rgba(255, 152, 0, 0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.cream.soft,
  },
  description: {
    color: 'rgba(245,240,232,0.75)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  price: {
    color: COLORS.gold.primary,
    fontSize: 28,
    fontWeight: '900',
  },
  currency: {
    color: COLORS.gold.muted,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  purchaseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  purchaseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  devSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  devLabel: {
    color: '#1E7AFF',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  devButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  devButton: {
    flex: 1,
    backgroundColor: '#1E7AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  devButtonRevoke: {
    backgroundColor: '#FF5722',
  },
  devButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  // DEV Card for per-hero ownership
  devCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(30, 122, 255, 0.3)',
  },
  devCardTitle: {
    color: '#1E7AFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  devCardSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  heroInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 8, default: 10 }),
    color: COLORS.cream.pure,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  grantButton: {
    backgroundColor: '#1E7AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  grantButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  sampleLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 16,
    marginBottom: 8,
  },
  heroList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroChipOwned: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  heroChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroChipTextOwned: {
    color: 'rgba(76, 217, 100, 0.95)',
  },
  noHeroesText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  restoreButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreText: {
    color: 'rgba(245,240,232,0.75)',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  footerNote: {
    marginTop: 20,
    color: 'rgba(245,240,232,0.45)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
