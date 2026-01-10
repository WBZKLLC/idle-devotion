// /app/frontend/lib/storage.ts
// Platform-safe storage utilities for web and native
// Uses localStorage on web, AsyncStorage on native

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'divine_heroes_auth_token',
  USERNAME: 'divine_heroes_username',
} as const;

/**
 * Platform-safe storage get
 * Returns null if key doesn't exist or on error
 */
export async function storageGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // Web: use localStorage directly
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(key);
        if (__DEV__) console.log(`[storage.get] web: ${key} = ${value ? '(exists)' : '(null)'}`);
        return value;
      }
      return null;
    } else {
      // Native: use AsyncStorage
      const value = await AsyncStorage.getItem(key);
      if (__DEV__) console.log(`[storage.get] native: ${key} = ${value ? '(exists)' : '(null)'}`);
      return value;
    }
  } catch (e) {
    console.error(`[storage.get] Error reading ${key}:`, e);
    return null;
  }
}

/**
 * Platform-safe storage set
 * Returns true on success, false on error
 */
export async function storageSet(key: string, value: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Web: use localStorage directly
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        if (__DEV__) console.log(`[storage.set] web: ${key} = (saved)`);
        return true;
      }
      console.warn('[storage.set] localStorage not available');
      return false;
    } else {
      // Native: use AsyncStorage
      await AsyncStorage.setItem(key, value);
      if (__DEV__) console.log(`[storage.set] native: ${key} = (saved)`);
      return true;
    }
  } catch (e) {
    console.error(`[storage.set] Error saving ${key}:`, e);
    return false;
  }
}

/**
 * Platform-safe storage remove
 * Returns true on success, false on error
 */
export async function storageRemove(key: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Web: use localStorage directly
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        if (__DEV__) console.log(`[storage.remove] web: ${key} = (removed)`);
        return true;
      }
      return false;
    } else {
      // Native: use AsyncStorage
      await AsyncStorage.removeItem(key);
      if (__DEV__) console.log(`[storage.remove] native: ${key} = (removed)`);
      return true;
    }
  } catch (e) {
    console.error(`[storage.remove] Error removing ${key}:`, e);
    return false;
  }
}

/**
 * Clear all auth-related storage keys
 */
export async function clearAuthStorage(): Promise<void> {
  await storageRemove(STORAGE_KEYS.AUTH_TOKEN);
  await storageRemove(STORAGE_KEYS.USERNAME);
  if (__DEV__) console.log('[storage] All auth storage cleared');
}
