/**
 * useRevenueCat Hook
 * 
 * Comprehensive RevenueCat integration with:
 * - SDK initialization
 * - Entitlement checking (Idle Devotion Pro)
 * - Paywall presentation (RevenueCatUI)
 * - Customer info management
 * - Restore purchases
 * 
 * Products: monthly, yearly, lifetime
 * Entitlement: "Idle Devotion Pro"
 */

import { useEffect, useCallback, useState } from 'react';
import { Platform, Alert } from 'react-native';
import { useGameStore } from '../stores/gameStore';

// Debug logging
const dlog = (...args: any[]) => { if (__DEV__) console.log('[RevenueCat]', ...args); };
const derror = (...args: any[]) => { console.error('[RevenueCat]', ...args); };

// RevenueCat API Key
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || 'test_XatWwbfGglZHujsLmVeIhyBpMKy';

// Entitlement identifier
const PRO_ENTITLEMENT_ID = 'Idle Devotion Pro';

// Paywall result types
export enum PAYWALL_RESULT {
  NOT_PRESENTED = 'NOT_PRESENTED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
  PURCHASED = 'PURCHASED',
  RESTORED = 'RESTORED',
}

// Types
interface CustomerInfo {
  entitlements: {
    active: { [key: string]: any };
    all: { [key: string]: any };
  };
  activeSubscriptions: string[];
  latestExpirationDate?: string;
  originalAppUserId: string;
}

interface Package {
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
}

interface Offering {
  identifier: string;
  serverDescription: string;
  availablePackages: Package[];
  monthly?: Package;
  annual?: Package;
  lifetime?: Package;
}

// Lazy load RevenueCat SDK to avoid crashes in Expo Go
let Purchases: any = null;
let RevenueCatUI: any = null;
let LOG_LEVEL: any = { VERBOSE: 4, DEBUG: 3, INFO: 2, WARN: 1, ERROR: 0 };
let PURCHASES_ERROR_CODE: any = { PURCHASE_CANCELLED_ERROR: 1 };

const loadRevenueCatSDK = () => {
  if (Purchases) return true;
  
  try {
    const RNPurchases = require('react-native-purchases');
    Purchases = RNPurchases.default || RNPurchases;
    LOG_LEVEL = RNPurchases.LOG_LEVEL || LOG_LEVEL;
    PURCHASES_ERROR_CODE = RNPurchases.PURCHASES_ERROR_CODE || PURCHASES_ERROR_CODE;
    
    // Try to load RevenueCat UI
    try {
      const RCUI = require('react-native-purchases-ui');
      RevenueCatUI = RCUI.default || RCUI;
    } catch (uiError) {
      dlog('RevenueCat UI not available:', uiError);
    }
    
    return true;
  } catch (error) {
    dlog('RevenueCat SDK not available (expected in Expo Go):', error);
    return false;
  }
};

export interface UseRevenueCatReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: Offering | null;
  packages: Package[];
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  checkProStatus: () => Promise<boolean>;
  presentPaywall: () => Promise<PAYWALL_RESULT>;
  purchasePackage: (pkg: Package) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  syncUserId: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useRevenueCat(): UseRevenueCatReturn {
  const { user } = useGameStore();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<Offering | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Check if user has Pro entitlement
  const checkProFromCustomerInfo = useCallback((info: CustomerInfo | null): boolean => {
    if (!info) return false;
    return typeof info.entitlements?.active?.[PRO_ENTITLEMENT_ID] !== 'undefined';
  }, []);
  
  // Initialize RevenueCat
  const initialize = useCallback(async () => {
    if (isInitialized) {
      dlog('Already initialized');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Check platform support
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        dlog('Platform not supported:', Platform.OS, '- running in mock mode');
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }
      
      // Load SDK
      const sdkLoaded = loadRevenueCatSDK();
      if (!sdkLoaded || !Purchases || typeof Purchases.configure !== 'function') {
        dlog('SDK not available - running in development/Expo Go mode');
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }
      
      // Set log level for debugging
      if (__DEV__) {
        try {
          Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        } catch (e) {
          dlog('Could not set log level:', e);
        }
      }
      
      // Configure RevenueCat
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      dlog('SDK configured successfully');
      
      // Listen for customer info updates
      Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
        dlog('Customer info updated');
        setCustomerInfo(info);
        setIsPro(checkProFromCustomerInfo(info));
      });
      
      // Get initial customer info
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      setIsPro(checkProFromCustomerInfo(info));
      
      // Get offerings
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setCurrentOffering(offerings.current);
        setPackages(offerings.current.availablePackages || []);
      }
      
      setIsInitialized(true);
      dlog('Initialization complete. Pro:', checkProFromCustomerInfo(info));
    } catch (err: any) {
      derror('Initialization error:', err);
      setError(err.message || 'Failed to initialize RevenueCat');
      setIsInitialized(true); // Still mark as initialized to prevent retry loops
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, checkProFromCustomerInfo]);
  
  // Check Pro status
  const checkProStatus = useCallback(async (): Promise<boolean> => {
    if (!Purchases) return false;
    
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const hasPro = checkProFromCustomerInfo(info);
      setIsPro(hasPro);
      return hasPro;
    } catch (err: any) {
      derror('Error checking pro status:', err);
      return false;
    }
  }, [checkProFromCustomerInfo]);
  
  // Present RevenueCat Paywall
  const presentPaywall = useCallback(async (): Promise<PAYWALL_RESULT> => {
    // Web/development fallback
    if (Platform.OS === 'web' || !RevenueCatUI) {
      dlog('Paywall not available on web/development');
      Alert.alert(
        'Subscription Required',
        'Upgrade to Idle Devotion Pro to unlock premium features!\n\n• Monthly: $4.99/month\n• Yearly: $39.99/year\n• Lifetime: $99.99',
        [{ text: 'OK' }]
      );
      return PAYWALL_RESULT.NOT_PRESENTED;
    }
    
    try {
      setIsLoading(true);
      
      // Present the paywall
      const result = await RevenueCatUI.presentPaywall();
      dlog('Paywall result:', result);
      
      // Refresh customer info after paywall interaction
      await checkProStatus();
      
      // Map to our enum
      switch (result) {
        case 'PURCHASED':
          return PAYWALL_RESULT.PURCHASED;
        case 'RESTORED':
          return PAYWALL_RESULT.RESTORED;
        case 'CANCELLED':
          return PAYWALL_RESULT.CANCELLED;
        case 'ERROR':
          return PAYWALL_RESULT.ERROR;
        default:
          return PAYWALL_RESULT.NOT_PRESENTED;
      }
    } catch (err: any) {
      derror('Paywall error:', err);
      setError(err.message || 'Failed to present paywall');
      return PAYWALL_RESULT.ERROR;
    } finally {
      setIsLoading(false);
    }
  }, [checkProStatus]);
  
  // Purchase a package
  const purchasePackage = useCallback(async (pkg: Package): Promise<boolean> => {
    if (!Purchases) {
      dlog('SDK not available for purchase');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      const hasPro = checkProFromCustomerInfo(info);
      setIsPro(hasPro);
      
      dlog('Purchase successful. Pro:', hasPro);
      return hasPro;
    } catch (err: any) {
      // Handle user cancellation
      if (err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || err.userCancelled) {
        dlog('Purchase cancelled by user');
        return false;
      }
      
      derror('Purchase error:', err);
      setError(err.message || 'Purchase failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkProFromCustomerInfo]);
  
  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Purchases) {
      dlog('SDK not available for restore');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const hasPro = checkProFromCustomerInfo(info);
      setIsPro(hasPro);
      
      dlog('Restore successful. Pro:', hasPro);
      return hasPro;
    } catch (err: any) {
      derror('Restore error:', err);
      setError(err.message || 'Failed to restore purchases');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkProFromCustomerInfo]);
  
  // Sync user ID with RevenueCat
  const syncUserId = useCallback(async (userId: string) => {
    if (!Purchases) return;
    
    try {
      const { customerInfo: info } = await Purchases.logIn(userId);
      setCustomerInfo(info);
      setIsPro(checkProFromCustomerInfo(info));
      dlog('User synced:', userId);
    } catch (err: any) {
      derror('Error syncing user:', err);
    }
  }, [checkProFromCustomerInfo]);
  
  // Logout
  const logout = useCallback(async () => {
    if (!Purchases) return;
    
    try {
      const info = await Purchases.logOut();
      setCustomerInfo(info);
      setIsPro(false);
      dlog('User logged out');
    } catch (err: any) {
      derror('Error logging out:', err);
    }
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Auto-initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);
  
  // Sync user ID when user changes
  useEffect(() => {
    if (isInitialized && user?.id) {
      syncUserId(user.id);
    }
  }, [isInitialized, user?.id, syncUserId]);
  
  return {
    isInitialized,
    isLoading,
    isPro,
    customerInfo,
    currentOffering,
    packages,
    error,
    initialize,
    checkProStatus,
    presentPaywall,
    purchasePackage,
    restorePurchases,
    syncUserId,
    logout,
    clearError,
  };
}

// Export entitlement ID
export { PRO_ENTITLEMENT_ID };
