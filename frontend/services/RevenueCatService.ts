import { Platform } from 'react-native';

// RevenueCat API configuration
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || 'test_GHJByEeqdUHXOWbuvIWFFrQFXjB';

// Product IDs (these need to match your App Store / Play Store products)
export const PRODUCTS = {
  BATTLE_PASS_STANDARD: 'battle_pass_standard', // $9.99
  BATTLE_PASS_PREMIUM: 'battle_pass_premium',   // $19.99
  CRYSTAL_PACK_SMALL: 'crystal_pack_100',       // 100 crystals
  CRYSTAL_PACK_MEDIUM: 'crystal_pack_500',      // 500 crystals
  CRYSTAL_PACK_LARGE: 'crystal_pack_1000',      // 1000 crystals
  DIVINE_PACK_STARTER: 'divine_pack_starter',   // 10 Divine Essence
  DIVINE_PACK_DELUXE: 'divine_pack_deluxe',     // 50 Divine Essence
};

// Entitlements
export const ENTITLEMENTS = {
  BATTLE_PASS: 'battle_pass',
  BATTLE_PASS_PREMIUM: 'battle_pass_premium',
  VIP: 'vip',
};

interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

interface CustomerInfo {
  entitlements: {
    active: { [key: string]: any };
  };
  activeSubscriptions: string[];
  latestExpirationDate?: string;
}

class RevenueCatService {
  private initialized: boolean = false;
  private userId: string | null = null;

  // Initialize RevenueCat
  async initialize(userId: string): Promise<boolean> {
    try {
      // For web preview, we'll mock the initialization
      if (Platform.OS === 'web') {
        console.log('RevenueCat: Web platform - using mock mode');
        this.initialized = true;
        this.userId = userId;
        return true;
      }

      // For native, we would initialize the SDK
      // const Purchases = require('react-native-purchases').default;
      // await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      // await Purchases.logIn(userId);
      
      this.initialized = true;
      this.userId = userId;
      console.log('RevenueCat initialized for user:', userId);
      return true;
    } catch (error) {
      console.error('RevenueCat initialization failed:', error);
      return false;
    }
  }

  // Get available products/offerings
  async getOfferings(): Promise<any[]> {
    if (!this.initialized) {
      console.warn('RevenueCat not initialized');
      return this.getMockOfferings();
    }

    if (Platform.OS === 'web') {
      return this.getMockOfferings();
    }

    try {
      // For native:
      // const Purchases = require('react-native-purchases').default;
      // const offerings = await Purchases.getOfferings();
      // return offerings.current?.availablePackages || [];
      
      return this.getMockOfferings();
    } catch (error) {
      console.error('Failed to get offerings:', error);
      return this.getMockOfferings();
    }
  }

  // Purchase a product
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    if (!this.initialized) {
      return { success: false, error: 'RevenueCat not initialized' };
    }

    if (Platform.OS === 'web') {
      // Simulate purchase on web for testing
      return this.mockPurchase(productId);
    }

    try {
      // For native:
      // const Purchases = require('react-native-purchases').default;
      // const { customerInfo } = await Purchases.purchaseProduct(productId);
      
      return this.mockPurchase(productId);
    } catch (error: any) {
      if (error.userCancelled) {
        return { success: false, error: 'Purchase cancelled' };
      }
      return { success: false, error: error.message || 'Purchase failed' };
    }
  }

  // Purchase Battle Pass
  async purchaseBattlePass(tier: 'standard' | 'premium'): Promise<PurchaseResult> {
    const productId = tier === 'premium' 
      ? PRODUCTS.BATTLE_PASS_PREMIUM 
      : PRODUCTS.BATTLE_PASS_STANDARD;
    
    const result = await this.purchaseProduct(productId);
    
    if (result.success) {
      // Notify backend about the purchase
      await this.notifyBackendPurchase(productId, result.transactionId || '');
    }
    
    return result;
  }

  // Purchase crystals
  async purchaseCrystals(packSize: 'small' | 'medium' | 'large'): Promise<PurchaseResult> {
    const productMap = {
      small: PRODUCTS.CRYSTAL_PACK_SMALL,
      medium: PRODUCTS.CRYSTAL_PACK_MEDIUM,
      large: PRODUCTS.CRYSTAL_PACK_LARGE,
    };
    
    const result = await this.purchaseProduct(productMap[packSize]);
    
    if (result.success) {
      await this.notifyBackendPurchase(productMap[packSize], result.transactionId || '');
    }
    
    return result;
  }

  // Check if user has active Battle Pass
  async hasBattlePass(): Promise<boolean> {
    if (!this.initialized || Platform.OS === 'web') {
      return false; // Mock: no active pass
    }

    try {
      // const Purchases = require('react-native-purchases').default;
      // const customerInfo = await Purchases.getCustomerInfo();
      // return !!customerInfo.entitlements.active[ENTITLEMENTS.BATTLE_PASS];
      
      return false;
    } catch (error) {
      console.error('Failed to check Battle Pass:', error);
      return false;
    }
  }

  // Get customer info
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.initialized) {
      return null;
    }

    if (Platform.OS === 'web') {
      return {
        entitlements: { active: {} },
        activeSubscriptions: [],
      };
    }

    try {
      // const Purchases = require('react-native-purchases').default;
      // return await Purchases.getCustomerInfo();
      
      return {
        entitlements: { active: {} },
        activeSubscriptions: [],
      };
    } catch (error) {
      console.error('Failed to get customer info:', error);
      return null;
    }
  }

  // Restore purchases
  async restorePurchases(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      if (Platform.OS === 'web') {
        console.log('Restore not available on web');
        return false;
      }

      // const Purchases = require('react-native-purchases').default;
      // await Purchases.restorePurchases();
      
      return true;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      return false;
    }
  }

  // Notify backend about purchase
  private async notifyBackendPurchase(productId: string, transactionId: string): Promise<void> {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/purchase/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.userId,
            product_id: productId,
            transaction_id: transactionId,
            platform: Platform.OS,
          }),
        }
      );

      if (!response.ok) {
        console.error('Backend purchase verification failed');
      }
    } catch (error) {
      console.error('Failed to notify backend:', error);
    }
  }

  // Mock offerings for web/testing
  private getMockOfferings(): any[] {
    return [
      {
        identifier: PRODUCTS.BATTLE_PASS_STANDARD,
        product: {
          title: 'Battle Pass',
          description: 'Unlock premium rewards track',
          price: 9.99,
          priceString: '$9.99',
          currencyCode: 'USD',
        },
      },
      {
        identifier: PRODUCTS.BATTLE_PASS_PREMIUM,
        product: {
          title: 'Battle Pass Premium',
          description: 'Battle Pass + 10 Bonus Levels',
          price: 19.99,
          priceString: '$19.99',
          currencyCode: 'USD',
        },
      },
      {
        identifier: PRODUCTS.CRYSTAL_PACK_SMALL,
        product: {
          title: '100 Crystals',
          description: 'Small crystal pack',
          price: 0.99,
          priceString: '$0.99',
          currencyCode: 'USD',
        },
      },
      {
        identifier: PRODUCTS.CRYSTAL_PACK_MEDIUM,
        product: {
          title: '500 Crystals',
          description: 'Medium crystal pack',
          price: 4.99,
          priceString: '$4.99',
          currencyCode: 'USD',
        },
      },
      {
        identifier: PRODUCTS.CRYSTAL_PACK_LARGE,
        product: {
          title: '1000 Crystals',
          description: 'Large crystal pack',
          price: 9.99,
          priceString: '$9.99',
          currencyCode: 'USD',
        },
      },
    ];
  }

  // Mock purchase for testing
  private mockPurchase(productId: string): PurchaseResult {
    console.log('Mock purchase:', productId);
    return {
      success: true,
      productId,
      transactionId: `mock_${Date.now()}`,
    };
  }
}

export const revenueCatService = new RevenueCatService();
export default revenueCatService;
