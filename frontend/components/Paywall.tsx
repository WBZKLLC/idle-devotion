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
 * 
 * Phase 3.19.4: Enhanced with trust signals, restore purchases, and first-purchase framing.
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
import { useHasEntitlement, useEntitlementStore } from '../lib/entitlements/gating';
import PurchaseButton from './PurchaseButton';
import { SecondaryButton } from './ui/SecondaryButton';
import { toast } from './ui/Toast';

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
  /** Flag indicating if this is user's first purchase ever (for first-purchase framing) */
  isFirstPurchase?: boolean;
}

/**
 * Canonical Paywall Component
 * 
 * Wraps PurchaseButton with product info display.
 * This is the ONLY paywall UI - no alternate purchase surfaces.
 * 
 * Phase 3.19.4: Structure: Header → Benefits → Trust → Price → Purchase → Restore → Not Now
 */
export const Paywall: React.FC<PaywallProps> = ({
  productKey = 'PREMIUM_CINEMATICS_PACK',
  onClose,
  onPurchaseComplete,
  onDismiss,
  showNotNow = true,
  isFirstPurchase = false,
}) => {
  const product = PRODUCTS[productKey];
  const isOwned = useHasEntitlement(product.entitlementKey);
  const { restorePurchases } = useEntitlementStore();
  const [isRestoring, setIsRestoring] = React.useState(false);
  
  // Dismiss handler - use onDismiss if provided, otherwise fall back to onClose
  const handleDismiss = onDismiss || onClose;
  
  // Handle restore purchases
  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
      toast.success('Purchases restored successfully!');
    } catch (error) {
      toast.error('Could not restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* === SECTION 1: Header === */}
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
          
          {/* === Phase 3.19.4: First Purchase Badge === */}
          {isFirstPurchase && (
            <View style={styles.firstPurchaseBadge}>
              <Ionicons name="gift" size={16} color={COLORS.navy.darkest} />
              <Text style={styles.firstPurchaseText}>First Purchase</Text>
            </View>
          )}

          {/* === SECTION 2: Benefits (3-6 bullets) === */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>What You Get</Text>
            {getBenefitsForProduct(productKey).map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={benefit.icon as any} size={18} color={COLORS.gold.primary} />
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>

          {/* === SECTION 3: Trust / Reassurance Row === */}
          <View style={styles.trustContainer}>
            <View style={styles.trustRow}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
              <Text style={styles.trustText}>
                {Platform.OS === 'ios' ? 'Secure purchase via App Store' : 
                 Platform.OS === 'android' ? 'Secure purchase via Google Play' : 
                 'Secure checkout'}
              </Text>
            </View>
            <View style={styles.trustRow}>
              <Ionicons name="refresh" size={14} color={COLORS.gold.light} />
              <Text style={styles.trustText}>Restore purchases anytime</Text>
            </View>
            {!product.isSubscription && (
              <View style={styles.trustRow}>
                <Ionicons name="infinite" size={14} color={COLORS.gold.light} />
                <Text style={styles.trustText}>One-time purchase. Keep forever.</Text>
              </View>
            )}
          </View>

          {/* === SECTION 4: Price Display with Ethical Anchoring === */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price</Text>
            <View style={styles.priceRight}>
              <Text style={styles.priceValue}>{product.priceFallback}</Text>
              {!product.isSubscription && (
                <Text style={styles.priceNote}>One-time</Text>
              )}
            </View>
          </View>

          {/* === SECTION 5: Purchase Button (canonical) === */}
          <View style={styles.purchaseContainer}>
            <PurchaseButton
              productKey={productKey}
              onPurchaseComplete={onPurchaseComplete}
              style={styles.purchaseButtonStyle}
            />
          </View>
          
          {/* === Phase 3.19.4: First Purchase Reassurance === */}
          {isFirstPurchase && (
            <Text style={styles.firstPurchaseReassurance}>
              If anything goes wrong, you can restore purchases.
            </Text>
          )}

          {/* === SECTION 6: Restore Purchases === */}
          <View style={styles.restoreContainer}>
            <SecondaryButton
              title={isRestoring ? "Restoring..." : "Restore Purchases"}
              onPress={handleRestore}
              disabled={isRestoring}
              loading={isRestoring}
              variant="ghost"
              size="sm"
              leftIcon={<Ionicons name="refresh" size={14} color={COLORS.gold.primary} />}
            />
            <Text style={styles.restoreHint}>
              Reinstalling? Switching devices? Restore here.
            </Text>
          </View>

          {/* === SECTION 7: "Not now" exit affordance === */}
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
  header: { marginBottom: 20 },
  closeIcon: { alignSelf: 'flex-end', padding: 8 },
  headerContent: { alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.gold.primary, marginTop: 12 },
  subtitle: { fontSize: 15, color: COLORS.cream.soft, marginTop: 4, textAlign: 'center', lineHeight: 20 },
  
  // Phase 3.19.4: First Purchase Badge
  firstPurchaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  firstPurchaseText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  
  // Benefits
  benefitsContainer: { 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16,
  },
  benefitsTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: COLORS.cream.pure, 
    marginBottom: 12,
  },
  benefitRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 8,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { fontSize: 14, color: COLORS.cream.soft, flex: 1 },
  
  // Phase 3.19.4: Trust/Reassurance Row
  trustContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  
  // Price
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  priceLabel: { fontSize: 15, color: COLORS.cream.soft },
  priceRight: { alignItems: 'flex-end' },
  priceValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary },
  priceNote: { fontSize: 11, color: COLORS.cream.dark, marginTop: 2 },
  
  // Purchase
  purchaseContainer: { alignItems: 'center', marginBottom: 12 },
  purchaseButtonStyle: { minWidth: 250 },
  
  // Phase 3.19.4: First Purchase Reassurance
  firstPurchaseReassurance: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  
  // Phase 3.19.4: Restore Purchases
  restoreContainer: {
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  restoreHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 6,
    textAlign: 'center',
  },
  
  // Platform note
  platformNote: { 
    fontSize: 12, 
    color: COLORS.cream.dark, 
    textAlign: 'center', 
    marginBottom: 12,
  },
  
  // Terms
  termsText: { 
    fontSize: 10, 
    color: COLORS.cream.dark, 
    textAlign: 'center', 
    marginTop: 16, 
    lineHeight: 14,
  },
  
  // Success
  successContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24,
  },
  successTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: COLORS.gold.primary, 
    marginTop: 16,
  },
  successText: { 
    fontSize: 16, 
    color: COLORS.cream.soft, 
    marginTop: 8, 
    textAlign: 'center',
  },
  closeButton: { 
    backgroundColor: COLORS.gold.primary, 
    paddingHorizontal: 32, 
    paddingVertical: 12, 
    borderRadius: 8, 
    marginTop: 24,
  },
  closeButtonText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: COLORS.navy.darkest,
  },
  
  // "Not now" exit affordance
  notNowButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  notNowPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  notNowText: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default Paywall;
