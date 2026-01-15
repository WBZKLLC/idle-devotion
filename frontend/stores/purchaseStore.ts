// /app/frontend/stores/purchaseStore.ts
// Purchase State Machine - single source of truth for purchase flow
// NO ad-hoc flags in screens - all purchase state lives here

import { create } from 'zustand';
import { track, Events } from '../lib/telemetry/events';

/**
 * Purchase states - strict state machine
 */
export type PurchaseState = 
  | 'idle'
  | 'paywall_viewed'
  | 'purchase_started'
  | 'purchase_pending'      // Waiting for store/server verification
  | 'purchase_verified'     // Success - entitlement granted
  | 'purchase_failed'       // Failed - show error
  | 'purchase_cancelled'    // User cancelled
  | 'purchase_refunded';    // Previously owned, now revoked

/**
 * Purchase error types for consistent handling
 */
export type PurchaseError = 
  | 'CANCELLED'
  | 'NETWORK_ERROR'
  | 'VERIFICATION_FAILED'
  | 'ALREADY_OWNED'
  | 'NOT_AVAILABLE'
  | 'INSUFFICIENT_FUNDS'
  | 'UNKNOWN';

interface PurchaseStoreState {
  // Current state
  state: PurchaseState;
  
  // Active purchase context
  activeProductId: string | null;
  activeIdempotencyKey: string | null;
  
  // Error info
  error: PurchaseError | null;
  errorMessage: string | null;
  
  // Actions
  viewPaywall: () => void;
  startPurchase: (productId: string, idempotencyKey: string) => void;
  setPending: () => void;
  setVerified: () => void;
  setFailed: (error: PurchaseError, message?: string) => void;
  setCancelled: () => void;
  reset: () => void;
  
  // Computed
  isProcessing: () => boolean;
  canStartPurchase: () => boolean;
}

export const usePurchaseStore = create<PurchaseStoreState>((set, get) => ({
  state: 'idle',
  activeProductId: null,
  activeIdempotencyKey: null,
  error: null,
  errorMessage: null,

  viewPaywall: () => {
    set({ state: 'paywall_viewed', error: null, errorMessage: null });
  },

  startPurchase: (productId: string, idempotencyKey: string) => {
    const current = get().state;
    
    // Can only start from idle or paywall_viewed
    if (current !== 'idle' && current !== 'paywall_viewed' && current !== 'purchase_failed' && current !== 'purchase_cancelled') {
      console.warn(`[purchaseStore] Cannot start purchase in state: ${current}`);
      return;
    }
    
    track(Events.PURCHASE_ATTEMPT, { productId });
    
    set({
      state: 'purchase_started',
      activeProductId: productId,
      activeIdempotencyKey: idempotencyKey,
      error: null,
      errorMessage: null,
    });
  },

  setPending: () => {
    const current = get().state;
    if (current !== 'purchase_started') {
      console.warn(`[purchaseStore] Cannot set pending in state: ${current}`);
      return;
    }
    set({ state: 'purchase_pending' });
  },

  setVerified: () => {
    const { activeProductId } = get();
    
    track(Events.PURCHASE_SUCCESS, { productId: activeProductId });
    
    set({
      state: 'purchase_verified',
      error: null,
      errorMessage: null,
    });
  },

  setFailed: (error: PurchaseError, message?: string) => {
    const { activeProductId } = get();
    
    track(Events.PURCHASE_FAILURE, { productId: activeProductId, error });
    
    set({
      state: 'purchase_failed',
      error,
      errorMessage: message || getDefaultErrorMessage(error),
    });
  },

  setCancelled: () => {
    set({
      state: 'purchase_cancelled',
      error: 'CANCELLED',
      errorMessage: null,
    });
  },

  reset: () => {
    set({
      state: 'idle',
      activeProductId: null,
      activeIdempotencyKey: null,
      error: null,
      errorMessage: null,
    });
  },

  isProcessing: () => {
    const { state } = get();
    return state === 'purchase_started' || state === 'purchase_pending';
  },

  canStartPurchase: () => {
    const { state } = get();
    return state === 'idle' || state === 'paywall_viewed' || state === 'purchase_failed' || state === 'purchase_cancelled';
  },
}));

function getDefaultErrorMessage(error: PurchaseError): string {
  switch (error) {
    case 'CANCELLED':
      return 'Purchase was cancelled';
    case 'NETWORK_ERROR':
      return 'Network error. Please check your connection and try again.';
    case 'VERIFICATION_FAILED':
      return 'Purchase verification failed. Please contact support if you were charged.';
    case 'ALREADY_OWNED':
      return 'You already own this item';
    case 'NOT_AVAILABLE':
      return 'This item is not available for purchase';
    case 'INSUFFICIENT_FUNDS':
      return 'Insufficient funds';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Generate idempotency key for purchase
 */
export function generateIdempotencyKey(): string {
  return `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
