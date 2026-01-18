/**
 * RevenueCat Debug Screen
 * 
 * DEV-only screen to verify RevenueCat configuration.
 * Shows: SDK status, offerings, packages, entitlement status.
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';
import { LAYOUT, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../components/ui/tokens';
import { haptic, PRESS } from '../lib/ui/interaction';
import {
  configureRevenueCat,
  isSDKAvailable,
  getDefaultOffering,
  getCustomerInfoSafe,
  hasProEntitlement,
  debugPrintState,
  ENTITLEMENT_ID,
  PurchasesOffering,
  CustomerInfo,
} from '../src/iap/revenuecat';

interface DebugState {
  configured: boolean;
  sdkAvailable: boolean;
  apiKeySet: boolean;
  offering: string | null;
  packages: string[];
  isPro: boolean;
}

export default function RevenueCatDebugScreen() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DebugState | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  
  const loadDebugState = async () => {
    setLoading(true);
    try {
      // Ensure configured
      await configureRevenueCat();
      
      // Get debug state
      const debugState = await debugPrintState();
      setState(debugState);
      
      // Get full offering and customer info
      const off = await getDefaultOffering();
      setOffering(off);
      
      const info = await getCustomerInfoSafe();
      setCustomerInfo(info);
    } catch (error) {
      console.error('Debug load error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadDebugState();
  }, []);
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading RevenueCat state...</Text>
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
        <Text style={styles.headerTitle}>RevenueCat Debug</Text>
        <Pressable 
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          onPress={loadDebugState}
        >
          <Ionicons name="refresh" size={20} color={COLORS.gold.primary} />
        </Pressable>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* SDK Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SDK Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Configured:</Text>
            <StatusBadge value={state?.configured} />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>SDK Available:</Text>
            <StatusBadge value={state?.sdkAvailable} />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>API Key Set:</Text>
            <StatusBadge value={state?.apiKeySet} />
          </View>
        </View>
        
        {/* Entitlement Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entitlement</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>ID:</Text>
            <Text style={styles.statusValue}>{ENTITLEMENT_ID}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Has Pro:</Text>
            <StatusBadge value={state?.isPro} trueLabel="YES" falseLabel="NO" />
          </View>
        </View>
        
        {/* Offering */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Offering</Text>
          {state?.offering ? (
            <>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Identifier:</Text>
                <Text style={styles.statusValue}>{state.offering}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Description:</Text>
                <Text style={styles.statusValue}>{offering?.serverDescription || 'N/A'}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>No offering available</Text>
          )}
        </View>
        
        {/* Packages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Packages</Text>
          {state?.packages && state.packages.length > 0 ? (
            state.packages.map((pkg, idx) => (
              <View key={idx} style={styles.packageRow}>
                <Text style={styles.packageText}>{pkg}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No packages available.{'\n'}
              Check RevenueCat Dashboard → Offerings → Packages.
            </Text>
          )}
        </View>
        
        {/* Active Entitlements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Entitlements</Text>
          {customerInfo?.entitlements?.active && 
           Object.keys(customerInfo.entitlements.active).length > 0 ? (
            Object.keys(customerInfo.entitlements.active).map((key) => (
              <View key={key} style={styles.packageRow}>
                <Text style={styles.packageText}>{key}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active entitlements</Text>
          )}
        </View>
        
        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Info</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Original App User ID:</Text>
            <Text style={styles.statusValueSmall}>
              {customerInfo?.originalAppUserId || 'N/A'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Active Subscriptions:</Text>
            <Text style={styles.statusValue}>
              {customerInfo?.activeSubscriptions?.length || 0}
            </Text>
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            onPress={() => router.push('/subscription')}
          >
            <Text style={styles.actionButtonText}>Go to Subscription Screen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ 
  value, 
  trueLabel = 'YES', 
  falseLabel = 'NO' 
}: { 
  value?: boolean; 
  trueLabel?: string; 
  falseLabel?: string;
}) {
  const isTrue = value === true;
  return (
    <View style={[
      styles.badge,
      isTrue ? styles.badgeSuccess : styles.badgeError
    ]}>
      <Text style={[
        styles.badgeText,
        isTrue ? styles.badgeTextSuccess : styles.badgeTextError
      ]}>
        {isTrue ? trueLabel : falseLabel}
      </Text>
    </View>
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
  refreshButton: {
    padding: 8,
    borderRadius: RADIUS.sm,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: LAYOUT.SCREEN_PADDING,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: COLORS.navy.dark,
    padding: 16,
    borderRadius: RADIUS.lg,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gold.primary,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '10',
  },
  statusLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
  },
  statusValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.pure,
  },
  statusValueSmall: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.cream.soft,
    maxWidth: '50%',
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSuccess: {
    backgroundColor: COLORS.success + '30',
  },
  badgeError: {
    backgroundColor: COLORS.error + '30',
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  badgeTextSuccess: {
    color: COLORS.success,
  },
  badgeTextError: {
    color: COLORS.error,
  },
  packageRow: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '10',
  },
  packageText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.soft,
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  actionButton: {
    backgroundColor: COLORS.gold.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.navy.darkest,
  },
  pressed: {
    opacity: PRESS.OPACITY,
    transform: [{ scale: PRESS.SCALE }],
  },
});
