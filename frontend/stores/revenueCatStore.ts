import { create } from 'zustand';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

// RevenueCat API Key - same for both platforms in this case
const REVENUECAT_API_KEY = 'test_IZyOoxmCinuIynJgzhXakqWWiyY';

// Entitlement identifier from RevenueCat dashboard
const PRO_ENTITLEMENT_ID = 'DivineHeros Pro';

// Product identifiers
export const PRODUCT_IDS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
};

interface RevenueCatState {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  packages: PurchasesPackage[];
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  checkProStatus: () => Promise<boolean>;
  getOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  getCustomerInfo: () => Promise<CustomerInfo | null>;
  setUserId: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useRevenueCatStore = create<RevenueCatState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isLoading: false,
  isPro: false,
  customerInfo: null,
  currentOffering: null,
  packages: [],
  error: null,

  // Initialize RevenueCat SDK
  initialize: async () => {
    if (get().isInitialized) {
      console.log('[RevenueCat] Already initialized');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Set log level for debugging
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

      // Configure based on platform
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        console.log('[RevenueCat] Configured successfully');
      } else {
        console.log('[RevenueCat] Platform not supported:', Platform.OS);
        set({ isInitialized: true, isLoading: false });
        return;
      }

      // Listen for customer info updates
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        console.log('[RevenueCat] Customer info updated');
        const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
        set({ customerInfo, isPro });
      });

      // Get initial customer info
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

      // Get offerings
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      const packages = currentOffering?.availablePackages || [];

      set({
        isInitialized: true,
        isLoading: false,
        customerInfo,
        isPro,
        currentOffering,
        packages,
      });

      console.log('[RevenueCat] Initialization complete');
      console.log('[RevenueCat] Pro status:', isPro);
      console.log('[RevenueCat] Available packages:', packages.length);
    } catch (error: any) {
      console.error('[RevenueCat] Initialization error:', error);
      set({
        isInitialized: true,
        isLoading: false,
        error: error.message || 'Failed to initialize RevenueCat',
      });
    }
  },

  // Check if user has Pro entitlement
  checkProStatus: async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
      set({ customerInfo, isPro });
      return isPro;
    } catch (error: any) {
      console.error('[RevenueCat] Error checking pro status:', error);
      return false;
    }
  },

  // Get available offerings/packages
  getOfferings: async () => {
    set({ isLoading: true, error: null });

    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      const packages = currentOffering?.availablePackages || [];

      set({
        isLoading: false,
        currentOffering,
        packages,
      });

      console.log('[RevenueCat] Offerings loaded:', offerings);
    } catch (error: any) {
      console.error('[RevenueCat] Error getting offerings:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to get offerings',
      });
    }
  },

  // Purchase a package
  purchasePackage: async (pkg: PurchasesPackage) => {
    set({ isLoading: true, error: null });

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

      set({
        isLoading: false,
        customerInfo,
        isPro,
      });

      console.log('[RevenueCat] Purchase successful, Pro status:', isPro);
      return isPro;
    } catch (error: any) {
      // Handle user cancellation gracefully
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        console.log('[RevenueCat] Purchase cancelled by user');
        set({ isLoading: false });
        return false;
      }

      console.error('[RevenueCat] Purchase error:', error);
      set({
        isLoading: false,
        error: error.message || 'Purchase failed',
      });
      return false;
    }
  },

  // Restore previous purchases
  restorePurchases: async () => {
    set({ isLoading: true, error: null });

    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';

      set({
        isLoading: false,
        customerInfo,
        isPro,
      });

      console.log('[RevenueCat] Restore successful, Pro status:', isPro);
      return isPro;
    } catch (error: any) {
      console.error('[RevenueCat] Restore error:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to restore purchases',
      });
      return false;
    }
  },

  // Get customer info
  getCustomerInfo: async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
      set({ customerInfo, isPro });
      return customerInfo;
    } catch (error: any) {
      console.error('[RevenueCat] Error getting customer info:', error);
      return null;
    }
  },

  // Set user ID for cross-platform sync
  setUserId: async (userId: string) => {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
      set({ customerInfo, isPro });
      console.log('[RevenueCat] User logged in:', userId);
    } catch (error: any) {
      console.error('[RevenueCat] Error setting user ID:', error);
    }
  },

  // Logout user
  logout: async () => {
    try {
      const customerInfo = await Purchases.logOut();
      set({ customerInfo, isPro: false });
      console.log('[RevenueCat] User logged out');
    } catch (error: any) {
      console.error('[RevenueCat] Error logging out:', error);
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

// Helper function to format price
export const formatPrice = (pkg: PurchasesPackage): string => {
  return pkg.product.priceString;
};

// Helper function to get package by identifier
export const getPackageById = (packages: PurchasesPackage[], id: string): PurchasesPackage | undefined => {
  return packages.find((pkg) => pkg.identifier === id || pkg.product.identifier === id);
};

// Export entitlement ID for use elsewhere
export { PRO_ENTITLEMENT_ID };
