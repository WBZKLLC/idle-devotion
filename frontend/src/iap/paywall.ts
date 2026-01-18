/**
 * RevenueCat Paywall Presenter
 * 
 * Handles presenting the RevenueCat native paywall.
 * Requires: react-native-purchases-ui
 */

import { Platform, Alert } from 'react-native';

// Paywall result types
export enum PAYWALL_RESULT {
  NOT_PRESENTED = 'NOT_PRESENTED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
  PURCHASED = 'PURCHASED',
  RESTORED = 'RESTORED',
}

// Lazy-load RevenueCatUI
let RevenueCatUI: any = null;

function loadRevenueCatUI(): boolean {
  if (RevenueCatUI) return true;
  
  if (Platform.OS === 'web') {
    return false;
  }
  
  try {
    const RCUI = require('react-native-purchases-ui');
    RevenueCatUI = RCUI.default || RCUI;
    return true;
  } catch (error) {
    console.log('[RevenueCat] UI SDK not available:', error);
    return false;
  }
}

/**
 * Present RevenueCat Paywall
 * 
 * On native: Shows the configured RevenueCat paywall
 * On web/dev: Shows an alert with subscription info
 */
export async function presentPaywall(): Promise<PAYWALL_RESULT> {
  // Try to load UI SDK
  if (!loadRevenueCatUI()) {
    console.log('[RevenueCat] Paywall not available - showing fallback');
    
    // Fallback for web/development
    Alert.alert(
      'Upgrade to Idle Devotion Pro',
      'Premium features include:\n\n• Ad-free experience\n• 2x idle rewards\n• Exclusive heroes\n• Priority support\n\nSubscription options:\n• Monthly: $4.99/mo\n• Yearly: $39.99/yr\n• Lifetime: $99.99',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Learn More', onPress: () => console.log('User interested') },
      ]
    );
    
    return PAYWALL_RESULT.NOT_PRESENTED;
  }
  
  try {
    // Present native paywall
    const result = await RevenueCatUI.presentPaywall();
    console.log('[RevenueCat] Paywall result:', result);
    
    // Map RevenueCat result to our enum
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
  } catch (error) {
    console.warn('[RevenueCat] Paywall error:', error);
    return PAYWALL_RESULT.ERROR;
  }
}

/**
 * Present paywall for a specific offering
 */
export async function presentPaywallForOffering(
  offeringIdentifier: string
): Promise<PAYWALL_RESULT> {
  if (!loadRevenueCatUI()) {
    return PAYWALL_RESULT.NOT_PRESENTED;
  }
  
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: offeringIdentifier,
    });
    
    return result === 'PURCHASED' || result === 'RESTORED' 
      ? PAYWALL_RESULT.PURCHASED 
      : PAYWALL_RESULT.NOT_PRESENTED;
  } catch (error) {
    console.warn('[RevenueCat] Paywall for offering error:', error);
    return PAYWALL_RESULT.ERROR;
  }
}
