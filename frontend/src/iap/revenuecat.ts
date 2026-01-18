/**
 * RevenueCat Core Configuration
 * 
 * Single-source configuration for RevenueCat SDK.
 * Call configureRevenueCat() once at app root.
 * 
 * Products: monthly, yearly, lifetime
 * Entitlement: "Idle Devotion Pro"
 */

import { Platform } from 'react-native';

// Lazy-load SDK to avoid crashes in Expo Go
let Purchases: any = null;
let LOG_LEVEL: any = { VERBOSE: 4, DEBUG: 3, INFO: 2, WARN: 1, ERROR: 0 };
let PURCHASES_ERROR_CODE: any = {};

// Types
export type CustomerInfo = {
  entitlements: {
    active: { [key: string]: any };
    all: { [key: string]: any };
  };
  activeSubscriptions: string[];
  latestExpirationDate?: string;
  originalAppUserId: string;
};

export type PurchasesPackage = {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
};

export type PurchasesOffering = {
  identifier: string;
  serverDescription: string;
  availablePackages: PurchasesPackage[];
  monthly?: PurchasesPackage;
  annual?: PurchasesPackage;
  lifetime?: PurchasesPackage;
};

// Constants
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
export const ENTITLEMENT_ID = 'Idle Devotion Pro';

// State
let configured = false;
let sdkAvailable = false;

/**
 * Load the RevenueCat SDK dynamically
 * Returns false if SDK not available (Expo Go, web)
 */
function loadSDK(): boolean {
  if (Purchases) return true;
  
  // Web platform - SDK not available
  if (Platform.OS === 'web') {
    console.log('[RevenueCat] Web platform - SDK not available');
    return false;
  }
  
  try {
    const RNPurchases = require('react-native-purchases');
    Purchases = RNPurchases.default || RNPurchases;
    LOG_LEVEL = RNPurchases.LOG_LEVEL || LOG_LEVEL;
    PURCHASES_ERROR_CODE = RNPurchases.PURCHASES_ERROR_CODE || {};
    sdkAvailable = true;
    return true;
  } catch (error) {
    console.log('[RevenueCat] Native SDK not available (expected in Expo Go):', error);
    return false;
  }
}

/**
 * Configure RevenueCat SDK - call once at app root
 */
export async function configureRevenueCat(): Promise<boolean> {
  if (configured) {
    console.log('[RevenueCat] Already configured');
    return sdkAvailable;
  }
  
  // Check API key
  if (!API_KEY) {
    console.warn('[RevenueCat] Missing EXPO_PUBLIC_REVENUECAT_API_KEY - purchases disabled');
    configured = true;
    return false;
  }
  
  // Load SDK
  if (!loadSDK()) {
    configured = true;
    return false;
  }
  
  try {
    // Set verbose logging in dev
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }
    
    // Configure with API key
    await Purchases.configure({ apiKey: API_KEY });
    
    configured = true;
    sdkAvailable = true;
    console.log('[RevenueCat] Configured successfully');
    return true;
  } catch (error) {
    console.error('[RevenueCat] Configuration failed:', error);
    configured = true;
    return false;
  }
}

/**
 * Check if SDK is available and configured
 */
export function isSDKAvailable(): boolean {
  return configured && sdkAvailable && Purchases !== null;
}

/**
 * Get customer info safely
 */
export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  if (!isSDKAvailable()) return null;
  
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.warn('[RevenueCat] getCustomerInfo failed:', error);
    return null;
  }
}

/**
 * Check if customer has Pro entitlement
 */
export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
}

/**
 * Refresh and check Pro status
 */
export async function refreshProStatus(): Promise<boolean> {
  const info = await getCustomerInfoSafe();
  return hasProEntitlement(info);
}

/**
 * Log in user (call after your auth confirms user identity)
 */
export async function revenueCatLogIn(appUserId: string): Promise<CustomerInfo | null> {
  if (!isSDKAvailable()) return null;
  
  try {
    const { customerInfo } = await Purchases.logIn(appUserId);
    console.log('[RevenueCat] User logged in:', appUserId);
    return customerInfo;
  } catch (error) {
    console.warn('[RevenueCat] logIn failed:', error);
    return null;
  }
}

/**
 * Log out user
 */
export async function revenueCatLogOut(): Promise<void> {
  if (!isSDKAvailable()) return;
  
  try {
    await Purchases.logOut();
    console.log('[RevenueCat] User logged out');
  } catch (error) {
    console.warn('[RevenueCat] logOut failed:', error);
  }
}

/**
 * Get default offering (contains packages)
 */
export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  if (!isSDKAvailable()) return null;
  
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    console.warn('[RevenueCat] getOfferings failed:', error);
    return null;
  }
}

/**
 * Purchase a package
 */
export async function buyPackage(pkg: PurchasesPackage): Promise<{
  customerInfo: CustomerInfo | null;
  error: any;
  cancelled: boolean;
}> {
  if (!isSDKAvailable()) {
    return { customerInfo: null, error: 'SDK not available', cancelled: false };
  }
  
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, error: null, cancelled: false };
  } catch (error: any) {
    // Check if user cancelled
    const cancelled = error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
                      error.userCancelled === true;
    
    if (cancelled) {
      console.log('[RevenueCat] Purchase cancelled by user');
    } else {
      console.warn('[RevenueCat] Purchase failed:', error);
    }
    
    return { customerInfo: null, error, cancelled };
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isSDKAvailable()) return null;
  
  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('[RevenueCat] Purchases restored');
    return customerInfo;
  } catch (error) {
    console.warn('[RevenueCat] Restore failed:', error);
    return null;
  }
}

/**
 * Add listener for customer info updates
 */
export function addCustomerInfoListener(
  onUpdate: (info: CustomerInfo) => void
): () => void {
  if (!isSDKAvailable()) {
    return () => {}; // No-op cleanup
  }
  
  Purchases.addCustomerInfoUpdateListener(onUpdate);
  return () => Purchases.removeCustomerInfoUpdateListener(onUpdate);
}

/**
 * Debug: Print current state (call from a debug screen)
 */
export async function debugPrintState(): Promise<{
  configured: boolean;
  sdkAvailable: boolean;
  apiKeySet: boolean;
  offering: string | null;
  packages: string[];
  isPro: boolean;
}> {
  const offering = await getDefaultOffering();
  const customerInfo = await getCustomerInfoSafe();
  
  const state = {
    configured,
    sdkAvailable,
    apiKeySet: !!API_KEY,
    offering: offering?.identifier ?? null,
    packages: offering?.availablePackages.map(p => 
      `${p.identifier}: ${p.product.priceString}`
    ) ?? [],
    isPro: hasProEntitlement(customerInfo),
  };
  
  console.log('[RevenueCat] Debug State:', JSON.stringify(state, null, 2));
  return state;
}
