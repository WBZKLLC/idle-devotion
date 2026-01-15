/**
 * Purchase Flow Integration
 * 
 * Connects purchaseStore + entitlementStore + API for complete purchase flow.
 * This is the ONLY place where purchase verification happens.
 * 
 * Flow:
 * 1. Screen calls startPurchaseFlow(productId, entitlementKey)
 * 2. This generates idempotency key and initiates purchase
 * 3. After IAP completes, screen calls verifyAndApplyPurchase()
 * 4. We call /api/purchases/verify with idempotency key
 * 5. Server returns updated snapshot
 * 6. We apply snapshot to entitlementStore
 * 7. purchaseStore transitions to verified/failed
 */

import { Platform } from 'react-native';
import { usePurchaseStore, generateIdempotencyKey } from '../../stores/purchaseStore';
import { useEntitlementStore } from '../../stores/entitlementStore';
import { verifyPurchase, type PurchaseVerifyRequest } from '../api';
import { track, Events } from '../telemetry/events';

type PurchaseResult = 
  | { success: true; message?: string }
  | { success: false; error: string; shouldRetry: boolean };

/**
 * Start a purchase flow - call this when user taps "Buy" button
 * Returns the idempotency key for use in verifyAndApplyPurchase
 */
export function startPurchaseFlow(
  productId: string,
  entitlementKey: string
): string {
  const purchaseStore = usePurchaseStore.getState();
  
  if (!purchaseStore.canStartPurchase()) {
    throw new Error(`Cannot start purchase in state: ${purchaseStore.state}`);
  }
  
  const idempotencyKey = generateIdempotencyKey();
  purchaseStore.startPurchase(productId, idempotencyKey);
  
  // Store context for verification
  _pendingPurchase = {
    productId,
    entitlementKey,
    idempotencyKey,
    platform: Platform.OS as 'ios' | 'android' | 'web',
  };
  
  return idempotencyKey;
}

// Internal state for pending purchase
let _pendingPurchase: {
  productId: string;
  entitlementKey: string;
  idempotencyKey: string;
  platform: 'ios' | 'android' | 'web';
} | null = null;

/**
 * Call this after IAP SDK confirms purchase is complete
 * @param transactionId - Transaction ID from IAP SDK (optional but recommended)
 * @param receiptData - Receipt data from IAP SDK (optional)
 */
export async function verifyAndApplyPurchase(
  transactionId?: string,
  receiptData?: string
): Promise<PurchaseResult> {
  const purchaseStore = usePurchaseStore.getState();
  const entitlementStore = useEntitlementStore.getState();
  
  if (!_pendingPurchase) {
    purchaseStore.setFailed('UNKNOWN', 'No pending purchase to verify');
    return { success: false, error: 'No pending purchase', shouldRetry: false };
  }
  
  // Transition to pending
  purchaseStore.setPending();
  
  const request: PurchaseVerifyRequest = {
    product_id: _pendingPurchase.productId,
    entitlement_key: _pendingPurchase.entitlementKey,
    idempotency_key: _pendingPurchase.idempotencyKey,
    platform: _pendingPurchase.platform,
    transaction_id: transactionId,
    receipt_data: receiptData,
  };
  
  try {
    const response = await verifyPurchase(request);
    
    if (response.success && response.entitlements_snapshot) {
      // Apply the snapshot from server (this is the source of truth)
      const snap = response.entitlements_snapshot;
      entitlementStore.applySnapshot(snap);
      
      // Mark purchase as verified
      purchaseStore.setVerified();
      
      // Clear pending
      _pendingPurchase = null;
      
      track(Events.PURCHASE_SUCCESS, {
        productId: request.product_id,
        entitlementKey: request.entitlement_key,
      });
      
      return { success: true, message: response.message };
    } else {
      purchaseStore.setFailed('VERIFICATION_FAILED', 'Server did not confirm purchase');
      return { success: false, error: 'Verification failed', shouldRetry: true };
    }
  } catch (error: any) {
    const errorMessage = error?.response?.data?.detail || error?.message || 'Unknown error';
    
    // Determine if this is retryable
    const isNetworkError = !error?.response;
    const shouldRetry = isNetworkError;
    
    if (isNetworkError) {
      purchaseStore.setFailed('NETWORK_ERROR', errorMessage);
    } else if (error?.response?.status === 409) {
      // Conflict - already processed (idempotency)
      // This is actually success - refresh entitlements
      await entitlementStore.refreshFromServer('post_purchase');
      purchaseStore.setVerified();
      _pendingPurchase = null;
      return { success: true, message: 'Purchase already processed' };
    } else {
      purchaseStore.setFailed('VERIFICATION_FAILED', errorMessage);
    }
    
    track(Events.PURCHASE_FAILURE, {
      productId: request.product_id,
      error: errorMessage,
    });
    
    return { success: false, error: errorMessage, shouldRetry };
  }
}

/**
 * Cancel the current purchase flow
 */
export function cancelPurchaseFlow(): void {
  const purchaseStore = usePurchaseStore.getState();
  purchaseStore.setCancelled();
  _pendingPurchase = null;
}

/**
 * Reset purchase state (call after showing success/error UI)
 */
export function resetPurchaseFlow(): void {
  const purchaseStore = usePurchaseStore.getState();
  purchaseStore.reset();
  _pendingPurchase = null;
}

/**
 * Get the current pending purchase context (for retry)
 */
export function getPendingPurchase() {
  return _pendingPurchase ? { ..._pendingPurchase } : null;
}
