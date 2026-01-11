/**
 * Paid Features Screen
 * 
 * Shows purchasable premium features.
 * Currently: Hero Cinematics Pack ($9.99)
 * 
 * Payment flow is NOT implemented yet - this is UI wiring only.
 * DEV mode provides grant/revoke buttons for testing.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ENTITLEMENTS, cinematicOwnedKey } from '../lib/entitlements';
import { useEntitlementStore } from '../stores/entitlementStore';
import COLORS from '../theme/colors';

// Sample hero IDs for DEV testing (common ones)
const SAMPLE_HERO_IDS = [
  'michael_the_archangel',
  'gabriel_herald_of_dawn',
  'raphael_divine_healer',
  'lucifer_fallen_star',
  'athena_goddess_of_wisdom',
  'zeus_lord_of_thunder',
  'hades_lord_of_underworld',
];

export default function PaidFeaturesScreen() {
  // Subscribe directly to entitlements state for proper reactivity
  const entitlements = useEntitlementStore(s => s.entitlements);
  const setEntitlement = useEntitlementStore(s => s.setEntitlement);
  const grantDev = useEntitlementStore(s => s.grantEntitlementDevOnly);
  const revokeDev = useEntitlementStore(s => s.revokeEntitlementDevOnly);
  const setHeroCinematicOwned = useEntitlementStore(s => s.setHeroCinematicOwned);

  // DEV: text input for custom hero ID
  const [customHeroId, setCustomHeroId] = useState('');

  const item = useMemo(() => ENTITLEMENTS.PAID_CINEMATICS_PACK, []);
  const packOwned = Boolean(entitlements?.['PAID_CINEMATICS_PACK']);

  // Count how many heroes have cinematics owned
  const ownedHeroCount = useMemo(() => {
    return Object.keys(entitlements || {}).filter(k => k.startsWith('CINEMATIC_OWNED:')).length;
  }, [entitlements]);

  const handlePurchase = () => {
    Alert.alert(
      'Purchase Coming Soon',
      'Payment flow (StoreKit/Play Billing) is not enabled yet. This is the paywall UI wiring only.',
      [{ text: 'OK' }]
    );
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore Purchases',
      'Purchase restoration will be available when payments are enabled.',
      [{ text: 'OK' }]
    );
  };

  // DEV: Grant/revoke pack
  const handleDevGrantPack = async () => {
    await grantDev('PAID_CINEMATICS_PACK');
    Alert.alert('DEV Mode', 'Granted PAID_CINEMATICS_PACK entitlement.');
  };

  const handleDevRevokePack = async () => {
    await revokeDev('PAID_CINEMATICS_PACK');
    Alert.alert('DEV Mode', 'Revoked PAID_CINEMATICS_PACK entitlement.');
  };

  // DEV: Grant per-hero ownership
  const handleDevGrantHero = async (heroId: string) => {
    if (!heroId.trim()) {
      Alert.alert('Error', 'Please enter a hero ID');
      return;
    }
    await setHeroCinematicOwned(heroId.trim(), true);
    Alert.alert('DEV Mode', `Granted cinematic ownership for: ${heroId.trim()}`);
    setCustomHeroId('');
  };

  // DEV: Revoke per-hero ownership
  const handleDevRevokeHero = async (heroId: string) => {
    await setHeroCinematicOwned(heroId, false);
    Alert.alert('DEV Mode', `Revoked cinematic ownership for: ${heroId}`);
  };

  // Check if a hero has cinematic owned
  const isHeroOwned = (heroId: string) => {
    return Boolean(entitlements?.[cinematicOwnedKey(heroId)]);
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
          <Text style={styles.headerTitle}>Paid Features</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.subtitle}>
            Unlock premium content for Idle Devotion.
          </Text>

          {/* Cinematics Pack Feature Card */}
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
              <Text style={styles.devCardTitle}>DEV: Per-Hero Cinematic Ownership</Text>
              <Text style={styles.devCardSubtitle}>
                Owning a hero's cinematic grants +10% HP, +5% ATK to that hero.
              </Text>
              <Text style={styles.devCardSubtitle}>
                Currently owned: {ownedHeroCount} hero cinematics
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

              {/* Sample Hero List */}
              <Text style={styles.sampleLabel}>Quick Grant/Revoke:</Text>
              <View style={styles.heroList}>
                {SAMPLE_HERO_IDS.map((heroId) => {
                  const owned = isHeroOwned(heroId);
                  return (
                    <TouchableOpacity
                      key={heroId}
                      style={[styles.heroChip, owned && styles.heroChipOwned]}
                      onPress={() => owned ? handleDevRevokeHero(heroId) : handleDevGrantHero(heroId)}
                    >
                      <Text style={[styles.heroChipText, owned && styles.heroChipTextOwned]}>
                        {owned ? '✓ ' : ''}{heroId.split('_')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
