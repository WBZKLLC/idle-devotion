/**
 * Paid Features Screen
 * 
 * Shows purchasable premium features.
 * Currently: Hero Cinematics ($9.99)
 * 
 * Payment flow is NOT implemented yet - this is UI wiring only.
 * DEV mode provides grant/revoke buttons for testing.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ENTITLEMENTS } from '../lib/entitlements';
import { useEntitlementStore } from '../stores/entitlementStore';
import COLORS from '../theme/colors';

export default function PaidFeaturesScreen() {
  // Subscribe directly to entitlements state for proper reactivity
  const entitlements = useEntitlementStore(s => s.entitlements);
  const grantDev = useEntitlementStore(s => s.grantEntitlementDevOnly);
  const revokeDev = useEntitlementStore(s => s.revokeEntitlementDevOnly);

  const item = useMemo(() => ENTITLEMENTS.PAID_CINEMATICS, []);
  const owned = Boolean(entitlements?.PAID_CINEMATICS);

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

  const handleDevGrant = async () => {
    await grantDev('PAID_CINEMATICS');
    Alert.alert('DEV Mode', 'Granted PAID_CINEMATICS entitlement (dev only).');
  };

  const handleDevRevoke = async () => {
    await revokeDev('PAID_CINEMATICS');
    Alert.alert('DEV Mode', 'Revoked PAID_CINEMATICS entitlement (dev only).');
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

          {/* Cinematics Feature Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="videocam" size={28} color={COLORS.gold.primary} />
              </View>
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.badge, owned ? styles.badgeOwned : styles.badgeLocked]}>
                  <Text style={styles.badgeText}>{owned ? '✓ Owned' : 'Locked'}</Text>
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
              style={[styles.purchaseButton, owned && styles.purchaseButtonDisabled]}
              disabled={owned}
              onPress={handlePurchase}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={owned ? ['#444', '#333'] : ['#9B2CFF', '#7B1FA2']}
                style={styles.purchaseGradient}
              >
                <Ionicons 
                  name={owned ? 'checkmark-circle' : 'cart'} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.purchaseText}>
                  {owned ? 'Unlocked' : 'Purchase'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* DEV Mode Buttons */}
            {__DEV__ && (
              <View style={styles.devSection}>
                <Text style={styles.devLabel}>DEV MODE</Text>
                <View style={styles.devButtonRow}>
                  {!owned ? (
                    <TouchableOpacity
                      style={styles.devButton}
                      onPress={handleDevGrant}
                    >
                      <Text style={styles.devButtonText}>Grant Unlock</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.devButton, styles.devButtonRevoke]}
                      onPress={handleDevRevoke}
                    >
                      <Text style={styles.devButtonText}>Revoke Unlock</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Restore Purchases */}
          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Footer Note */}
          <Text style={styles.footerNote}>
            Purchases will be verified server-side when payments are enabled.
            {__DEV__ && ' Use DEV buttons above to test unlock flow.'}
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
