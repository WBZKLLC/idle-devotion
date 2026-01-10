import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

// Centralized API wrappers - store actions use these (no direct URL construction)
import {
  getUserHeroes,
  pullGacha as apiPullGacha,
  upgradeHero as apiUpgradeHero,
  registerUser as apiRegisterUser,
  loginAuth,
  triggerDailyLogin,
  setPassword as apiSetPassword,
  verifyAuthToken,
  fetchUser as apiFetchUser,
  fetchAllHeroesCatalog,
  claimIdle,
  getUserCR,
  setProfilePicture,
} from '../lib/api';

// Storage keys
const STORAGE_KEYS = {
  USERNAME: 'divine_heroes_username',
  AUTH_TOKEN: 'divine_heroes_auth_token',
};

interface User {
  id: string;
  username: string;
  gems: number;
  coins: number;
  gold: number;
  divine_essence?: number;
  stamina?: number;
  enhancement_stones?: number;
  skill_essence?: number;
  rune_stones?: number;
  guild_coins?: number;
  arena_tickets?: number;
  blood_crystals?: number;
  pity_counter: number;
  pity_counter_premium?: number;
  pity_counter_divine?: number;
  total_pulls: number;
  login_days: number;
  last_login: string | null;
  daily_summons_claimed: number;
  profile_picture_hero_id: string | null;
  vip_level?: number;
  total_spent?: number;
}

interface Hero {
  id: string;
  name: string;
  rarity: string;
  element: string;
  hero_class: string;
  base_hp: number;
  base_atk: number;
  base_def: number;
  image_url: string;
  description: string;
}

interface UserHero {
  id: string;
  user_id: string;
  hero_id: string;
  level: number;
  rank: number;
  star_level: number;
  duplicates: number;
  current_hp: number;
  current_atk: number;
  current_def: number;
  hero_data?: Hero;
}

interface GameState {
  user: User | null;
  userHeroes: UserHero[];
  allHeroes: Hero[];
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;
  authToken: string | null;
  needsPassword: boolean;  // For legacy accounts without passwords
  
  // Actions
  initUser: (username: string, password?: string) => Promise<void>;
  registerUser: (username: string, password: string) => Promise<{success: boolean; error?: string}>;
  loginWithPassword: (username: string, password: string) => Promise<{success: boolean; error?: string}>;
  setPasswordForLegacyAccount: (username: string, password: string) => Promise<{success: boolean; error?: string}>;
  restoreSession: () => Promise<void>;
  login: () => Promise<any>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  fetchUserHeroes: () => Promise<void>;
  fetchAllHeroes: () => Promise<void>;
  pullGacha: (pullType: 'single' | 'multi', currencyType: 'gems' | 'coins') => Promise<any>;
  upgradeHero: (heroInstanceId: string) => Promise<void>;
  claimIdleRewards: () => Promise<any>;
  fetchCR: () => Promise<{cr: number; hero_count: number}>;
  updateProfilePicture: (heroId: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setHydrated: (value: boolean) => void;
}

// Helper to save auth data
const saveAuthData = async (username: string, token: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.USERNAME, username);
      window.localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username);
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  } catch (e) {
    console.error('Failed to save auth data:', e);
  }
};

// Helper to clear auth data
const clearAuthData = async () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEYS.USERNAME);
      window.localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.USERNAME);
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch (e) {
    console.error('Failed to clear auth data:', e);
  }
};

// Helper to get stored auth data
const getStoredAuthData = async (): Promise<{username: string | null; token: string | null}> => {
  let username = null;
  let token = null;
  
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      username = window.localStorage.getItem(STORAGE_KEYS.USERNAME);
      token = window.localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    }
    if (!username) {
      username = await AsyncStorage.getItem(STORAGE_KEYS.USERNAME);
      token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  } catch (e) {
    console.error('Failed to get stored auth data:', e);
  }
  
  return { username, token };
};

export const useGameStore = create<GameState>((set, get) => ({
  user: null,
  userHeroes: [],
  allHeroes: [],
  isLoading: false,
  error: null,
  isHydrated: false,
  authToken: null,
  needsPassword: false,

  setHydrated: (value: boolean) => set({ isHydrated: value }),

  // Register new user with password
  registerUser: async (username: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const data = await apiRegisterUser({ username, password });
      
      const { user, token } = data;
      
      // Save auth data
      await saveAuthData(username, token);
      
      set({ user, authToken: token, isLoading: false, needsPassword: false });
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  // Login with password
  loginWithPassword: async (username: string, password: string) => {
    try {
      set({ isLoading: true, error: null, needsPassword: false });
      
      const data = await loginAuth({ username, password });
      
      const { user, token } = data;
      
      // Save auth data
      await saveAuthData(username, token);
      
      set({ user, authToken: token, isLoading: false });
      
      // Trigger daily login
      try {
        await triggerDailyLogin(username);
      } catch (e) {
        console.log('Daily login call failed:', e);
      }
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Login failed';
      
      // Check if this is a legacy account needing password
      if (error.response?.status === 403) {
        set({ needsPassword: true, isLoading: false });
        return { success: false, error: 'NEEDS_PASSWORD' };
      }
      
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  // Set password for legacy account
  setPasswordForLegacyAccount: async (username: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const data = await apiSetPassword(username, password);
      
      const { token } = data;
      
      // Now login to get user data
      const userData = await apiFetchUser(username);
      
      // Save auth data
      await saveAuthData(username, token);
      
      set({ user: userData, authToken: token, isLoading: false, needsPassword: false });
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to set password';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  restoreSession: async () => {
    try {
      if (typeof window === 'undefined') {
        set({ isHydrated: true });
        return;
      }
      
      console.log('restoreSession: starting');
      
      const { username, token } = await getStoredAuthData();
      console.log('restoreSession: stored username=', username, 'has token=', !!token);
      
      if (username && token) {
        // Verify token is still valid
        try {
          const verifyData = await verifyAuthToken(token);
          
          if (verifyData.valid) {
            console.log('restoreSession: token valid, user restored');
            set({ user: verifyData.user, authToken: token, isHydrated: true });
            return;
          }
        } catch (e) {
          console.log('restoreSession: token invalid, trying legacy restore');
        }
        
        // Fall back to legacy username-based restore for old accounts
        try {
          const userData = await apiFetchUser(username);
          console.log('restoreSession: legacy user found', userData.username);
          set({ user: userData, isHydrated: true });
          return;
        } catch (error) {
          console.log('restoreSession: user not found, clearing storage');
          await clearAuthData();
        }
      }
      
      set({ isHydrated: true });
    } catch (error) {
      console.error('restoreSession error:', error);
      set({ isHydrated: true });
    }
  },

  // Legacy initUser - now redirects to proper auth flow
  initUser: async (username: string, password?: string) => {
    set({ isLoading: true, error: null });
    
    // If password provided, use the new auth flow
    if (password) {
      const result = await get().loginWithPassword(username, password);
      if (!result.success) {
        throw new Error(result.error);
      }
      return;
    }
    
    // Legacy flow for backwards compatibility (will be phased out)
    try {
      const response = await axios.get(`${BACKEND_URL}/api/user/${username}`);
      set({ user: response.data, isLoading: false });
      await saveAuthData(username, '');  // Save username without token for legacy
    } catch (error: any) {
      set({ error: 'Failed to initialize user', isLoading: false });
      throw error;
    }
  },

  login: async () => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    set({ isLoading: true });
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/user/${user.username}/login`
      );
      await get().fetchUser();
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: 'Failed to login', isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await clearAuthData();
    set({ user: null, userHeroes: [], allHeroes: [], authToken: null, needsPassword: false });
  },

  fetchUser: async () => {
    const { user } = get();
    if (!user) return;
    
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/user/${user.username}`
      );
      set({ user: response.data });
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  },

  fetchUserHeroes: async () => {
    const { user } = get();
    if (!user) return;
    
    set({ isLoading: true });
    try {
      // Uses centralized API wrapper from lib/api.ts
      const heroes = await getUserHeroes(user.username);
      set({ userHeroes: heroes, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch heroes', isLoading: false });
      console.error('Failed to fetch heroes:', error);
    }
  },

  fetchAllHeroes: async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/heroes`);
      set({ allHeroes: response.data });
    } catch (error) {
      console.error('Failed to fetch all heroes:', error);
    }
  },

  pullGacha: async (pullType: 'single' | 'multi', currencyType: 'gems' | 'coins') => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    set({ isLoading: true });
    try {
      // Uses centralized API wrapper from lib/api.ts
      const result = await apiPullGacha(user.username, pullType, currencyType);
      
      // Refresh user and heroes data
      await get().fetchUser();
      await get().fetchUserHeroes();
      
      set({ isLoading: false });
      return result;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || error?.message || 'Failed to pull gacha', isLoading: false });
      throw error;
    }
  },

  upgradeHero: async (heroInstanceId: string) => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    set({ isLoading: true });
    try {
      // Uses centralized API wrapper from lib/api.ts
      await apiUpgradeHero(user.username, heroInstanceId);
      
      // Refresh heroes data
      await get().fetchUserHeroes();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || error?.message || 'Failed to upgrade hero', isLoading: false });
      throw error;
    }
  },

  claimIdleRewards: async () => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/idle/claim?username=${user.username}`
      );
      
      // Refresh user data
      await get().fetchUser();
      return response.data;
    } catch (error) {
      console.error('Failed to claim idle rewards:', error);
      throw error;
    }
  },

  fetchCR: async () => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/user/${user.username}/cr`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch CR:', error);
      return { cr: 0, hero_count: 0 };
    }
  },

  updateProfilePicture: async (heroId: string) => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    set({ isLoading: true });
    try {
      await axios.post(
        `${BACKEND_URL}/api/user/${user.username}/profile-picture?hero_id=${heroId}`
      );
      
      // Refresh user data
      await get().fetchUser();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to update profile picture', isLoading: false });
      throw error;
    }
  },

  setUser: (user: User | null) => set({ user }),
}));

// Hook to handle session restoration
export const useHydration = () => {
  const { isHydrated, restoreSession, user } = useGameStore();
  
  useEffect(() => {
    console.log('useHydration: isHydrated=', isHydrated, 'user=', user?.username);
    if (!isHydrated) {
      console.log('useHydration: calling restoreSession');
      restoreSession();
    }
  }, [isHydrated]);
  
  return isHydrated;
};
