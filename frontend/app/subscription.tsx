/**
 * Subscription Screen - Idle Devotion Pro
 * 
 * Features:
 * - RevenueCat Paywall presentation
 * - Manual package selection fallback
 * - Pro status display
 * - Restore purchases
 */

import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
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
import { useRevenueCat, PAYWALL_RESULT } from '../hooks/useRevenueCat';

export default function SubscriptionScreen() {
  const { user } = useGameStore();
  const hydrated = useHydration();
  const {
    isInitialized,
    isLoading,
    isPro,
    packages,
    currentOffering,
    error,
    presentPaywall,
    purchasePackage,
    restorePurchases,
    clearError,
  } = useRevenueCat();
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Just wait a moment since RevenueCat auto-refreshes
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);
  
  // Handle paywall presentation
  const handleShowPaywall = async () => {
    haptic('medium');
    track(Events.STORE_ITEM_SELECTED, { sku: 'paywall_open' });
    
    const result = await presentPaywall();
    
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        toast.success('Welcome to Idle Devotion Pro!');
        track(Events.IAP_PURCHASE_SUCCESS, { sku: 'pro_subscription' });
        break;
      case PAYWALL_RESULT.RESTORED:
        toast.success('Purchases restored successfully!');
        break;
      case PAYWALL_RESULT.CANCELLED:
        // User cancelled - no message needed
        break;
      case PAYWALL_RESULT.ERROR:
        toast.error('Something went wrong. Please try again.');
        break;
    }
  };
  
  // Handle manual package purchase
  const handlePurchasePackage = async (pkg: any) => {
    haptic('medium');
    track(Events.STORE_ITEM_SELECTED, { sku: pkg.identifier });
    
    const success = await purchasePackage(pkg);
    if (success) {
      toast.success('Welcome to Idle Devotion Pro!');
      track(Events.IAP_PURCHASE_SUCCESS, { sku: pkg.identifier });
    }
  };
  
  // Handle restore
  const handleRestore = async () => {
    haptic('light');
    const success = await restorePurchases();
    if (success) {
      toast.success('Purchases restored!');
    } else {
      toast.info('No purchases to restore.');
    }
  };
  
  // Loading state
  if (!hydrated || !isInitialized) {
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
          <Text style={styles.authGateSubtitle}>Join to unlock premium features.</Text>
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
        <Text style={styles.headerTitle}>Idle Devotion Pro</Text>
        <View style={styles.headerRight}>
          {isPro && (
            <View style={styles.proBadge}>
              <Ionicons name="star" size={14} color={COLORS.gold.primary} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
      </View>
      
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
        {isPro ? (
          // Pro user view
          <View style={styles.proSection}>
            <View style={styles.proIconContainer}>
              <Ionicons name="star" size={64} color={COLORS.gold.primary} />
            </View>
            <Text style={styles.proTitle}>You're a Pro!</Text>
            <Text style={styles.proSubtitle}>Thank you for supporting Idle Devotion</Text>
            
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.benefitText}>Ad-free experience</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.benefitText}>2x idle rewards</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.benefitText}>Exclusive heroes</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.benefitText}>Priority support</Text>
              </View>
            </View>
          </View>
        ) : (
          // Non-pro view
          <>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <View style={styles.heroIconContainer}>
                <Ionicons name="diamond" size={48} color={COLORS.gold.primary} />
              </View>
              <Text style={styles.heroTitle}>Upgrade to Pro</Text>
              <Text style={styles.heroSubtitle}>
                Unlock the full potential of your heroes
              </Text>
            </View>
            
            {/* Benefits */}
            <View style={styles.benefitsSection}>
              <Text style={styles.sectionTitle}>Pro Benefits</Text>
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Ionicons name="ban" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.benefitText}>Remove all ads</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="flash" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.benefitText}>2x idle rewards</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="people" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.benefitText}>Exclusive Pro heroes</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="headset" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.benefitText}>Priority support</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="infinite" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.benefitText}>Unlimited team slots</Text>
                </View>
              </View>
            </View>
            
            {/* Paywall button */}
            <View style={styles.paywallSection}>
              <Pressable
                style={({ pressed }) => [
                  styles.paywallButton,
                  pressed && styles.pressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleShowPaywall}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={COLORS.navy.darkest} />
                ) : (
                  <>
                    <Ionicons name="star" size={20} color={COLORS.navy.darkest} />
                    <Text style={styles.paywallButtonText}>View Subscription Options</Text>
                  </>
                )}
              </Pressable>
            </View>
            
            {/* Manual package selection (fallback) */}
            {packages.length > 0 && (
              <View style={styles.packagesSection}>
                <Text style={styles.sectionTitle}>Choose Your Plan</Text>
                <View style={styles.packagesList}>
                  {packages.map((pkg: any) => (
                    <Pressable
                      key={pkg.identifier}
                      style={({ pressed }) => [
                        styles.packageCard,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => handlePurchasePackage(pkg)}
                    >
                      <Text style={styles.packageTitle}>
                        {pkg.product?.title || pkg.identifier}
                      </Text>
                      <Text style={styles.packagePrice}>
                        {pkg.product?.priceString || 'N/A'}
                      </Text>
                      {pkg.product?.description && (
                        <Text style={styles.packageDesc}>
                          {pkg.product.description}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            
            {/* Restore purchases */}
            <View style={styles.restoreSection}>
              <Pressable
                style={({ pressed }) => [
                  styles.restoreButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleRestore}
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </Pressable>
            </View>
          </>
        )}
        
        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={clearError}>
              <Text style={styles.errorDismiss}>Dismiss</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '40',
  },
  proBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gold.primary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: LAYOUT.SCREEN_PADDING,
    paddingBottom: 40,
  },
  // Pro user section
  proSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  proIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.gold.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.gold.primary + '40',
  },
  proTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gold.primary,
    marginBottom: 8,
  },
  proSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.soft,
    marginBottom: 24,
  },
  // Non-pro hero section
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gold.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.cream.pure,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.dark,
    textAlign: 'center',
  },
  // Benefits section
  benefitsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.navy.dark,
    padding: 12,
    borderRadius: RADIUS.md,
  },
  benefitText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.cream.soft,
    flex: 1,
  },
  // Paywall section
  paywallSection: {
    marginBottom: 24,
  },
  paywallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.gold.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
  },
  paywallButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.navy.darkest,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Packages section
  packagesSection: {
    marginBottom: 24,
  },
  packagesList: {
    gap: 12,
  },
  packageCard: {
    backgroundColor: COLORS.navy.dark,
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '15',
  },
  packageTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.cream.pure,
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gold.primary,
    marginBottom: 4,
  },
  packageDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  // Restore section
  restoreSection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  restoreButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    textDecorationLine: 'underline',
  },
  // Error display
  errorContainer: {
    backgroundColor: COLORS.error + '20',
    padding: 12,
    borderRadius: RADIUS.md,
    marginTop: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    marginBottom: 8,
  },
  errorDismiss: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.soft,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: PRESS.OPACITY,
    transform: [{ scale: PRESS.SCALE }],
  },
});
