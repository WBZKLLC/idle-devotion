import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { useRevenueCatStore, formatPrice, PRODUCT_IDS } from '../stores/revenueCatStore';

// Safely import RevenueCat UI - may not be available in Expo Go
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = {
  NOT_PRESENTED: 'NOT_PRESENTED',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
  PURCHASED: 'PURCHASED',
  RESTORED: 'RESTORED',
};

try {
  const RNPurchasesUI = require('react-native-purchases-ui');
  RevenueCatUI = RNPurchasesUI.default || RNPurchasesUI;
  PAYWALL_RESULT = RNPurchasesUI.PAYWALL_RESULT || PAYWALL_RESULT;
} catch (e) {
  console.log('[RevenueCat UI] Native module not available:', e);
}

// Type for packages
type PurchasesPackage = any;

interface PaywallProps {
  onClose: () => void;
  onPurchaseComplete?: () => void;
}

// RevenueCat Native Paywall (uses dashboard-configured paywall)
export async function presentNativePaywall(): Promise<boolean> {
  if (!RevenueCatUI || !RevenueCatUI.presentPaywall) {
    console.log('[Paywall] RevenueCatUI not available');
    return false;
  }
  
  try {
    const paywallResult = await RevenueCatUI.presentPaywall();

    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
      default:
        return false;
    }
  } catch (error) {
    console.error('[Paywall] Error presenting native paywall:', error);
    return false;
  }
}

// Present paywall for a specific offering
export async function presentPaywallForOffering(offeringIdentifier: string): Promise<boolean> {
  try {
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: 'DivineHeros Pro',
    });

    return paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED;
  } catch (error) {
    console.error('[Paywall] Error presenting paywall for offering:', error);
    return false;
  }
}

// Custom Paywall Component (fallback if native paywall not configured)
export const CustomPaywall: React.FC<PaywallProps> = ({ onClose, onPurchaseComplete }) => {
  const {
    packages,
    isPro,
    isLoading,
    error,
    purchasePackage,
    restorePurchases,
    clearError,
    getOfferings,
  } = useRevenueCatStore();

  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    // Load offerings if not already loaded
    if (packages.length === 0) {
      getOfferings();
    }
    // Pre-select yearly as best value
    const yearly = packages.find(p => p.identifier === PRODUCT_IDS.YEARLY || p.product.identifier === PRODUCT_IDS.YEARLY);
    if (yearly) setSelectedPackage(yearly);
  }, [packages]);

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Select a Plan', 'Please select a subscription plan first.');
      return;
    }

    const success = await purchasePackage(selectedPackage);
    if (success) {
      Alert.alert('Success! 🎉', 'Welcome to DivineHeros Pro! Enjoy your premium benefits.', [
        { text: 'Awesome!', onPress: onPurchaseComplete },
      ]);
    }
  };

  const handleRestore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      Alert.alert('Restored!', 'Your purchases have been restored successfully.', [
        { text: 'Great!', onPress: onPurchaseComplete },
      ]);
    } else {
      Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
    }
  };

  const getPackageLabel = (pkg: PurchasesPackage): string => {
    const id = pkg.identifier || pkg.product.identifier;
    switch (id) {
      case PRODUCT_IDS.MONTHLY:
        return 'Monthly';
      case PRODUCT_IDS.YEARLY:
        return 'Yearly';
      case PRODUCT_IDS.LIFETIME:
        return 'Lifetime';
      default:
        return pkg.product.title || 'Plan';
    }
  };

  const getPackageSubtitle = (pkg: PurchasesPackage): string => {
    const id = pkg.identifier || pkg.product.identifier;
    switch (id) {
      case PRODUCT_IDS.MONTHLY:
        return 'Billed monthly';
      case PRODUCT_IDS.YEARLY:
        return 'Save 40%! Best Value';
      case PRODUCT_IDS.LIFETIME:
        return 'One-time purchase';
      default:
        return pkg.product.description || '';
    }
  };

  const isSelected = (pkg: PurchasesPackage): boolean => {
    return selectedPackage?.identifier === pkg.identifier;
  };

  // If already pro, show success screen
  if (isPro) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.primary]} style={styles.gradient}>
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.gold.primary} />
            <Text style={styles.successTitle}>You're a Pro! 👑</Text>
            <Text style={styles.successText}>Enjoy all premium features of DivineHeros.</Text>
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
              <Text style={styles.title}>DivineHeros Pro</Text>
              <Text style={styles.subtitle}>Unlock the full divine experience</Text>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Pro Benefits</Text>
            {[
              { icon: 'flash', text: 'Double Idle Rewards' },
              { icon: 'star', text: 'Exclusive Pro Heroes' },
              { icon: 'gift', text: 'Daily Premium Rewards' },
              { icon: 'shield-checkmark', text: '2x Guild Boss Damage' },
              { icon: 'infinite', text: 'Unlimited Summon Rerolls' },
              { icon: 'remove-circle', text: 'No Ads Forever' },
            ].map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Ionicons name={benefit.icon as any} size={20} color={COLORS.gold.primary} />
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.dismissError}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Package Selection */}
          <View style={styles.packagesContainer}>
            {isLoading && packages.length === 0 ? (
              <ActivityIndicator size="large" color={COLORS.gold.primary} />
            ) : packages.length > 0 ? (
              packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.packageCard, isSelected(pkg) && styles.packageCardSelected]}
                  onPress={() => setSelectedPackage(pkg)}
                  disabled={isLoading}
                >
                  {isSelected(pkg) && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.gold.primary} />
                    </View>
                  )}
                  <View style={styles.packageInfo}>
                    <Text style={[styles.packageLabel, isSelected(pkg) && styles.packageLabelSelected]}>
                      {getPackageLabel(pkg)}
                    </Text>
                    <Text style={styles.packageSubtitle}>{getPackageSubtitle(pkg)}</Text>
                  </View>
                  <Text style={[styles.packagePrice, isSelected(pkg) && styles.packagePriceSelected]}>
                    {formatPrice(pkg)}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noPackages}>
                <Text style={styles.noPackagesText}>
                  {Platform.OS === 'web'
                    ? 'Subscriptions available on iOS/Android only'
                    : 'No subscription plans available'}
                </Text>
              </View>
            )}
          </View>

          {/* Purchase Button */}
          {packages.length > 0 && (
            <TouchableOpacity
              style={[styles.purchaseButton, isLoading && styles.purchaseButtonDisabled]}
              onPress={handlePurchase}
              disabled={isLoading || !selectedPackage}
            >
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.purchaseGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.navy.darkest} />
                ) : (
                  <>
                    <Ionicons name="diamond" size={20} color={COLORS.navy.darkest} />
                    <Text style={styles.purchaseText}>Subscribe Now</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Restore Purchases */}
          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={isLoading}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            Subscriptions will be charged to your payment method. Subscriptions automatically renew
            unless canceled 24 hours before the end of the current period. Manage subscriptions in
            your device settings.
          </Text>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  
  // Header
  header: { marginBottom: 24 },
  closeIcon: { alignSelf: 'flex-end', padding: 8 },
  headerContent: { alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.gold.primary, marginTop: 12 },
  subtitle: { fontSize: 16, color: COLORS.cream.soft, marginTop: 4 },
  
  // Benefits
  benefitsContainer: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 24 },
  benefitsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  benefitText: { fontSize: 14, color: COLORS.cream.soft },
  
  // Error
  errorContainer: { backgroundColor: '#c0392b', borderRadius: 8, padding: 12, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { color: '#fff', fontSize: 14, flex: 1 },
  dismissError: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  
  // Packages
  packagesContainer: { gap: 12, marginBottom: 24 },
  packageCard: {
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardSelected: { borderColor: COLORS.gold.primary, backgroundColor: COLORS.navy.dark },
  selectedBadge: { position: 'absolute', top: -8, right: -8 },
  packageInfo: { flex: 1 },
  packageLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  packageLabelSelected: { color: COLORS.gold.primary },
  packageSubtitle: { fontSize: 12, color: COLORS.cream.dark, marginTop: 2 },
  packagePrice: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.soft },
  packagePriceSelected: { color: COLORS.gold.primary },
  noPackages: { padding: 24, alignItems: 'center' },
  noPackagesText: { color: COLORS.cream.dark, textAlign: 'center' },
  
  // Purchase Button
  purchaseButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  purchaseButtonDisabled: { opacity: 0.6 },
  purchaseGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  purchaseText: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy.darkest },
  
  // Restore
  restoreButton: { alignItems: 'center', padding: 12 },
  restoreText: { fontSize: 14, color: COLORS.gold.light, textDecorationLine: 'underline' },
  
  // Terms
  termsText: { fontSize: 10, color: COLORS.cream.dark, textAlign: 'center', marginTop: 16, lineHeight: 14 },
  
  // Success
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.gold.primary, marginTop: 16 },
  successText: { fontSize: 16, color: COLORS.cream.soft, marginTop: 8, textAlign: 'center' },
  closeButton: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, marginTop: 24 },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
});

export default CustomPaywall;
