/**
 * Paywall.tsx - Canonical Paywall Component
 * 
 * IMPORTANT: This component uses the strict canonical purchase flow.
 * - All purchase logic goes through PurchaseButton
 * - Product config comes from lib/entitlements/products.ts
 * - Entitlement checks use useHasEntitlement
 * 
 * DO NOT add RevenueCat native paywall logic here.
 * DO NOT implement purchase state or verification here.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { PRODUCTS, type ProductKey } from '../lib/entitlements/products';
import { useHasEntitlement } from '../lib/entitlements/gating';
import PurchaseButton from './PurchaseButton';

interface PaywallProps {
  /** Product to display/purchase (defaults to PREMIUM_CINEMATICS_PACK) */
  productKey?: ProductKey;
  /** Called when user taps close */
  onClose: () => void;
  /** Called after successful purchase */
  onPurchaseComplete?: () => void;
  /** Called when user taps "Not now" - defaults to onClose if not provided */
  onDismiss?: () => void;
  /** Show the "Not now" exit affordance (default: true) */
  showNotNow?: boolean;
}

/**
 * Canonical Paywall Component
 * 
 * Wraps PurchaseButton with product info display.
 * This is the ONLY paywall UI - no alternate purchase surfaces.
 */
export const Paywall: React.FC<PaywallProps> = ({
  productKey = 'PREMIUM_CINEMATICS_PACK',
  onClose,
  onPurchaseComplete,
  onDismiss,
  showNotNow = true,
}) => {
  const product = PRODUCTS[productKey];
  const isOwned = useHasEntitlement(product.entitlementKey);
  
  // Dismiss handler - use onDismiss if provided, otherwise fall back to onClose
  const handleDismiss = onDismiss || onClose;

  // If already owned, show success screen
  if (isOwned) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.primary]} style={styles.gradient}>
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.gold.primary} />
            <Text style={styles.successTitle}>Already Owned! ✓</Text>
            <Text style={styles.successText}>You already have access to {product.displayName}.</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.primary]} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
              <Ionicons name="close" size={28} color={COLORS.cream.pure} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Ionicons name="diamond" size={48} color={COLORS.gold.primary} />
              <Text style={styles.title}>{product.displayName}</Text>
              <Text style={styles.subtitle}>{product.description}</Text>
            </View>
          </View>

          {/* Benefits - shown based on product */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>What You Get</Text>
            {getBenefitsForProduct(productKey).map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Ionicons name={benefit.icon as any} size={20} color={COLORS.gold.primary} />
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>

          {/* Price Display */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>{product.priceFallback}</Text>
          </View>

          {/* Canonical Purchase Button - ALL purchase logic is here */}
          <View style={styles.purchaseContainer}>
            <PurchaseButton
              productKey={productKey}
              onPurchaseComplete={onPurchaseComplete}
              style={styles.purchaseButtonStyle}
            />
          </View>

          {/* Phase 3.18.1: "Not now" exit affordance - reduces friction */}
          {showNotNow && (
            <Pressable
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss paywall"
              style={({ pressed }) => [
                styles.notNowButton,
                pressed && styles.notNowPressed,
              ]}
            >
              <Text style={styles.notNowText}>Not now</Text>
            </Pressable>
          )}

          {/* Platform Note */}
          {Platform.OS === 'web' && (
            <Text style={styles.platformNote}>
              Full purchase flow available on iOS/Android
            </Text>
          )}

          {/* Terms */}
          <Text style={styles.termsText}>
            By purchasing, you agree to our Terms of Service. 
            All sales are final unless required by applicable law.
          </Text>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

/**
 * Get benefits list based on product
 */
function getBenefitsForProduct(productKey: ProductKey): Array<{ icon: string; text: string }> {
  switch (productKey) {
    case 'PREMIUM_CINEMATICS_PACK':
      return [
        { icon: 'videocam', text: 'All Premium Hero Cinematics' },
        { icon: 'stats-chart', text: '+10% HP & +5% ATK for Owned Heroes' },
        { icon: 'infinite', text: 'Lifetime Access' },
        { icon: 'flash', text: 'Exclusive Visual Effects' },
      ];
    case 'PREMIUM_SUBSCRIPTION':
      return [
        { icon: 'flash', text: 'Double Idle Rewards' },
        { icon: 'star', text: 'Exclusive Pro Heroes' },
        { icon: 'gift', text: 'Daily Premium Rewards' },
        { icon: 'remove-circle', text: 'No Ads Forever' },
      ];
    case 'NO_ADS':
      return [
        { icon: 'remove-circle', text: 'Remove All Ads Permanently' },
        { icon: 'flash', text: 'Faster Load Times' },
        { icon: 'heart', text: 'Support Development' },
      ];
    case 'STARTER_PACK':
      return [
        { icon: 'gift', text: 'Bonus Starting Resources' },
        { icon: 'star', text: 'Guaranteed Hero Summon' },
        { icon: 'flash', text: 'One-Time Boost' },
      ];
    default:
      return [
        { icon: 'star', text: 'Premium Content' },
      ];
  }
}

// DEPRECATED: These functions are kept for backwards compatibility but should NOT be used
// They will throw in development to catch accidental usage

/**
 * @deprecated Use <Paywall productKey="..." /> instead
 */
export async function presentNativePaywall(): Promise<boolean> {
  if (__DEV__) {
    console.error(
      '[DEPRECATED] presentNativePaywall is deprecated. ' +
      'Use <Paywall productKey="..." /> or <PurchaseButton /> instead.'
    );
  }
  return false;
}

/**
 * @deprecated Use <Paywall productKey="..." /> instead
 */
export async function presentPaywallForOffering(_offeringIdentifier: string): Promise<boolean> {
  if (__DEV__) {
    console.error(
      '[DEPRECATED] presentPaywallForOffering is deprecated. ' +
      'Use <Paywall productKey="..." /> or <PurchaseButton /> instead.'
    );
  }
  return false;
}

/**
 * @deprecated Use <Paywall productKey="..." /> instead
 */
export const CustomPaywall = Paywall;

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  
  // Header
  header: { marginBottom: 24 },
  closeIcon: { alignSelf: 'flex-end', padding: 8 },
  headerContent: { alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.gold.primary, marginTop: 12 },
  subtitle: { fontSize: 16, color: COLORS.cream.soft, marginTop: 4, textAlign: 'center' },
  
  // Benefits
  benefitsContainer: { 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 24 
  },
  benefitsTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: COLORS.cream.pure, 
    marginBottom: 12 
  },
  benefitRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 8 
  },
  benefitText: { fontSize: 14, color: COLORS.cream.soft },
  
  // Price
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  priceLabel: { fontSize: 16, color: COLORS.cream.soft },
  priceValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary },
  
  // Purchase
  purchaseContainer: { alignItems: 'center', marginBottom: 16 },
  purchaseButtonStyle: { minWidth: 250 },
  
  // Platform note
  platformNote: { 
    fontSize: 12, 
    color: COLORS.cream.dark, 
    textAlign: 'center', 
    marginBottom: 12 
  },
  
  // Terms
  termsText: { 
    fontSize: 10, 
    color: COLORS.cream.dark, 
    textAlign: 'center', 
    marginTop: 16, 
    lineHeight: 14 
  },
  
  // Success
  successContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24 
  },
  successTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: COLORS.gold.primary, 
    marginTop: 16 
  },
  successText: { 
    fontSize: 16, 
    color: COLORS.cream.soft, 
    marginTop: 8, 
    textAlign: 'center' 
  },
  closeButton: { 
    backgroundColor: COLORS.gold.primary, 
    paddingHorizontal: 32, 
    paddingVertical: 12, 
    borderRadius: 8, 
    marginTop: 24 
  },
  closeButtonText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: COLORS.navy.darkest 
  },
});

export default Paywall;
