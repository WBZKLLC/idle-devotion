// /app/frontend/lib/api/store.ts
// Phase 3.30: Store API Layer
//
// Catalog, purchase intent, and dev-only redeem.
// Uses canonical receipt for redeem.

// Auth handled by config.ts
import { RewardReceipt, isValidReceipt } from '../types/receipt';
import { track, Events } from '../telemetry/events';
import { apiUrl, getAuthHeaders } from './config';

// Auth header helper
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await loadAuthToken();
  if (!token) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Store item from catalog
export interface StoreItem {
  sku: string;
  name: string;
  desc?: string;
  priceText: string;
  currency: string;
  tag?: string;
}

// Purchase intent response
export interface PurchaseIntent {
  intentId: string;
  sku: string;
  price: number;
  priceText: string;
  currency: string;
  createdAt: string;
}

/**
 * Get store catalog
 */
export async function getStoreCatalog(): Promise<StoreItem[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl('/api/store/catalog'), { headers });
    if (!res.ok) throw new Error('Failed to fetch catalog');
    const data = await res.json();
    return data.catalog || [];
  } catch {
    return [];
  }
}

/**
 * Create purchase intent
 */
export async function createPurchaseIntent(sku: string): Promise<PurchaseIntent> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ sku });
  
  const res = await fetch(apiUrl(`/api/store/purchase-intent?${params}`), {
    method: 'POST',
    headers,
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to create intent' }));
    throw new Error(error.detail || 'Failed to create intent');
  }
  
  const intent = await res.json();
  
  // Emit telemetry
  track(Events.STORE_PURCHASE_INTENT_CREATED, {
    intentId: intent.intentId,
    sku: intent.sku,
  });
  
  return intent;
}

/**
 * DEV-ONLY: Redeem purchase intent without payment
 * Returns canonical receipt.
 */
export async function redeemIntent(intentId: string): Promise<RewardReceipt> {
  track(Events.STORE_REDEEM_SUBMITTED, { intentId });
  
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ intent_id: intentId });
  
  const res = await fetch(apiUrl(`/api/store/redeem-intent?${params}`), {
    method: 'POST',
    headers,
  });
  
  if (!res.ok) {
    track(Events.STORE_REDEEM_ERROR, { intentId, status: res.status });
    const error = await res.json().catch(() => ({ detail: 'Failed to redeem' }));
    throw new Error(error.detail || 'Failed to redeem');
  }
  
  const receipt = await res.json();
  
  if (isValidReceipt(receipt)) {
    if (receipt.alreadyClaimed) {
      track(Events.STORE_REDEEM_ALREADY_CLAIMED, { intentId });
    } else {
      track(Events.STORE_REDEEM_SUCCESS, { 
        intentId,
        itemCount: receipt.items.length,
      });
    }
  }
  
  return receipt;
}
