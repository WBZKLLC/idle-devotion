/**
 * PurchaseButton - Golden Path Purchase UI Component
 * 
 * Single deterministic purchase flow for one product/entitlement pair.
 * Uses the strict purchase flow from lib/entitlements/purchase-flow.ts
 * 
 * Strict UX Rules:
 * - Cancel = no toast, just reset
 * - Network fail = retryable state (shows "Try again")
 * - Verify fail (non-network) = non-retryable error
 * - Success = UI updates via useHasEntitlement
 * 
 * Phase 3.18.2: Toast cadence for success/fail feedback
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePurchaseStore } from '../stores/purchaseStore';
import { useHasEntitlement } from '../lib/entitlements/gating';
import { PRODUCTS, type ProductKey } from '../lib/entitlements/products';
import {
  startPurchaseFlow,
  verifyAndApplyPurchase,
  cancelPurchaseFlow,
  resetPurchaseFlow,
  getPendingPurchase,
} from '../lib/entitlements/purchase-flow';
import { useEntitlementStore } from '../stores/entitlementStore';
import COLORS from '../theme/colors';
// Phase 3.18.2: Toast for purchase feedback
import { toast } from './ui/Toast';

interface PurchaseButtonProps {
  /** Which product to purchase (defaults to PREMIUM_CINEMATICS_PACK) */
  productKey?: ProductKey;
  onPurchaseComplete?: () => void;
  onPurchaseError?: (error: string) => void;
  testMode?: boolean; // For testing without real IAP
  /** Custom button style */
  style?: object;
}

export default function PurchaseButton({
  productKey = 'PREMIUM_CINEMATICS_PACK',
  onPurchaseComplete,
  onPurchaseError,
  testMode = false,
  style,
}: PurchaseButtonProps) {
  // Get product from canonical source
  const product = PRODUCTS[productKey];
  
  // Phase 3.19.10: Local modal state for purchase confirm
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  
  // Purchase state from store
  const purchaseState = usePurchaseStore(s => s.state);
  const errorCode = usePurchaseStore(s => s.errorCode);
  const errorMessage = usePurchaseStore(s => s.errorMessage);
  
  // Check if already owned
  const isOwned = useHasEntitlement(product.entitlementKey);
  
  // Refresh entitlements on mount (belt + suspenders)
  const refreshEntitlements = useEntitlementStore(s => s.refreshFromServer);
  useEffect(() => {
    refreshEntitlements('manual').catch(() => {});
  }, [refreshEntitlements]);
  
  // Determine button state
  const isLoading = purchaseState === 'purchase_started' || purchaseState === 'purchase_pending';
  const hasError = purchaseState === 'failed';
  const isRetryable = errorCode === 'NETWORK_ERROR';
  const isVerified = purchaseState === 'purchase_verified';
  
  // Handle success state
  useEffect(() => {
    if (isVerified) {
      // Phase 3.18.2: Success toast - premium feel
      toast.premium('Premium access is now active.');
      
      // Post-purchase reconciliation (belt + suspenders)
      refreshEntitlements('post_purchase').catch(() => {});
      onPurchaseComplete?.();
      
      // Reset after brief delay to allow UI feedback
      const timer = setTimeout(() => {
        resetPurchaseFlow();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVerified, refreshEntitlements, onPurchaseComplete]);
  
  // Handle purchase button press
  const handlePurchase = useCallback(async () => {
    // If retrying, use existing pending purchase context
    const pending = getPendingPurchase();
    
    if (pending && isRetryable) {
      // Retry verification with same idempotency key
      const result = await verifyAndApplyPurchase();
      if (!result.success && !result.shouldRetry) {
        // Phase 3.18.2: Non-retryable error toast
        toast.error('Verification failed. If you were charged, use Restore Purchases.');
        onPurchaseError?.(result.error);
      } else if (!result.success && result.shouldRetry) {
        // Phase 3.18.2: Network error toast (retryable)
        toast.warning('Connection issue. Try again when online.');
      }
      return;
    }
    
    // Start new purchase flow
    try {
      const idempotencyKey = startPurchaseFlow(
        product.productId,
        product.entitlementKey
      );
      
      if (testMode) {
        // In test mode, simulate IAP completion immediately
        // In production, the IAP SDK would call verifyAndApplyPurchase after payment
        console.log('[PurchaseButton] Test mode - simulating IAP completion');
        const result = await verifyAndApplyPurchase('test_txn_' + Date.now());
        if (!result.success && !result.shouldRetry) {
          toast.error('Verification failed. If you were charged, use Restore Purchases.');
          onPurchaseError?.(result.error);
        }
      } else {
        // In production, the app would:
        // 1. Call RevenueCat/IAP SDK to show native purchase UI
        // 2. Wait for purchase completion callback
        // 3. Then call verifyAndApplyPurchase(transactionId)
        
        // Phase 3.19.10: Show inline confirm modal for simulation
        setShowPurchaseConfirm(true);
      }
    } catch (e: any) {
      console.error('[PurchaseButton] Error:', e.message);
      toast.error('Something went wrong. Please try again.');
      onPurchaseError?.(e.message);
    }
  }, [isRetryable, testMode, onPurchaseError]);
  
  // Handle cancel
  const handleCancel = useCallback(() => {
    // Cancel = silent reset (no toast per strict UX rules)
    cancelPurchaseFlow();
  }, []);
  
  // Handle dismiss error
  const handleDismissError = useCallback(() => {
    resetPurchaseFlow();
  }, []);
  
  // Already owned - show "Owned" state
  if (isOwned) {
    return (
      <View style={[styles.button, styles.ownedButton]}>
        <Text style={styles.ownedText}>✓ Owned</Text>
      </View>
    );
  }
  
  // Verified state - show success briefly
  if (isVerified) {
    return (
      <View style={[styles.button, styles.successButton]}>
        <Text style={styles.successText}>✓ Purchase Complete!</Text>
      </View>
    );
  }
  
  // Error state with retry option
  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {isRetryable ? 'Network error. Tap to retry.' : errorMessage || 'Purchase failed'}
        </Text>
        <View style={styles.errorButtons}>
          {isRetryable ? (
            <TouchableOpacity
              style={[styles.button, styles.retryButton]}
              onPress={handlePurchase}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={handleDismissError}
            >
              <Text style={styles.buttonText}>Dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.button, styles.loadingButton]}>
        <ActivityIndicator color="#fff" size="small" />
        <Text style={[styles.buttonText, { marginLeft: 8 }]}>
          {purchaseState === 'purchase_pending' ? 'Verifying...' : 'Processing...'}
        </Text>
      </View>
    );
  }
  
  // Default purchasable state
  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={handlePurchase}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{product.displayName}</Text>
        <Text style={styles.priceText}>{product.priceFallback}</Text>
      </TouchableOpacity>
      
      {/* Phase 3.19.10: Purchase confirmation modal (simulation mode) */}
      <Modal
        visible={showPurchaseConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPurchaseConfirm(false);
          cancelPurchaseFlow();
        }}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => {
            setShowPurchaseConfirm(false);
            cancelPurchaseFlow();
          }}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <LinearGradient colors={['#2b1b4d', '#12152a']} style={styles.modalCardInner}>
              <Text style={styles.modalTitle}>Purchase Flow</Text>
              <Text style={styles.modalMessage}>
                This would open the native purchase UI.{'\n\n'}
                Transaction ID would be passed to verifyAndApplyPurchase() on completion.
              </Text>
              <View style={styles.modalButtonRow}>
                <Pressable 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowPurchaseConfirm(false);
                    cancelPurchaseFlow();
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable 
                  style={styles.modalConfirmButton}
                  onPress={async () => {
                    setShowPurchaseConfirm(false);
                    const result = await verifyAndApplyPurchase('simulated_txn_' + Date.now());
                    if (!result.success && !result.shouldRetry) {
                      toast.error('Verification failed. If you were charged, use Restore Purchases.');
                      onPurchaseError?.(result.error);
                    }
                  }}
                >
                  <Text style={styles.modalConfirmText}>Simulate Success</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.gold.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  ownedButton: {
    backgroundColor: COLORS.success || '#22c55e',
    opacity: 0.8,
  },
  successButton: {
    backgroundColor: COLORS.success || '#22c55e',
  },
  loadingButton: {
    opacity: 0.8,
  },
  retryButton: {
    backgroundColor: COLORS.gold.primary,
  },
  dismissButton: {
    backgroundColor: COLORS.navy?.medium || '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  priceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 8,
    opacity: 0.9,
  },
  ownedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.error || '#ef4444',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  // Phase 3.19.10: Modal styles
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalCardInner: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  modalMessage: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
