import { create } from 'zustand';
import { useEffect } from 'react';

// Debug logging helpers - only log in development
const dlog = (...args: any[]) => { if (__DEV__) console.log(...args); };

// Telemetry
import { track, Events } from '../lib/telemetry/events';
import { sentrySetUser } from '../lib/telemetry/sentry';

// Auth storage helpers (canonical source for token persistence)
import { 
  saveAuthData, 
  loadAuthToken, 
  loadAuthUsername,
  clearAuthData 
} from '../lib/authStorage';

// Safe mutation wrapper for consistent error handling
import { safeMutation, MutationResult } from '../lib/safeMutation';

// API layer with token setter and global error handling
import {
  getUserHeroes,
  getUserHeroById as apiGetUserHeroById,
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
  apiSetAuthToken,
  apiSetForceLogoutCallback,
} from '../lib/api';

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
  userHeroesById: Record<string, UserHero>;
  allHeroes: Hero[];
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;
  authToken: string | null;
  authEpoch: number;  // Incremented on logout to invalidate in-flight requests
  needsPassword: boolean;  // For legacy accounts without passwords
  
  // Actions
  hydrateAuth: () => Promise<void>;  // Called on app boot to restore auth from storage
  bumpAuthEpoch: () => void;  // Call on logout to invalidate in-flight requests
  initUser: (username: string, password?: string) => Promise<void>;
  registerUser: (username: string, password: string) => Promise<{success: boolean; error?: string}>;
  loginWithPassword: (username: string, password: string) => Promise<{success: boolean; error?: string}>;
  setPasswordForLegacyAccount: (username: string, password: string) => Promise<{success: boolean; error?: string}>;
  restoreSession: () => Promise<void>;
  login: () => Promise<any>;
  logout: () => Promise<void>;
  registerForceLogout: () => void;  // Register callback for API 401 handling
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
  
  // Selectors (computed from state)
  selectUserHeroById: (id: string | undefined) => UserHero | undefined;
  
  // Single-hero ensure: cache-first + API fallback (keeps fetch logic out of screens)
  // Use forceRefresh: true after upgrade/promotion to get fresh data without list fetch
  getUserHeroById: (id: string, opts?: { forceRefresh?: boolean }) => Promise<UserHero>;
  
  // Smart post-gacha refresh: targeted if few heroes, full roster if many
  refreshHeroesAfterGacha: (result: any) => Promise<void>;
}

// Helper to index userHeroes by id for O(1) lookups
function indexUserHeroesById(list: UserHero[] | undefined | null): Record<string, UserHero> {
  const byId: Record<string, UserHero> = {};
  if (!Array.isArray(list)) return byId;
  for (const h of list) {
    const id = String((h as any)?.id ?? '');
    if (!id) continue;
    byId[id] = h;
  }
  return byId;
}

// Helper to set userHeroes AND userHeroesById together (enforces sync invariant)
// Always use this when replacing the entire heroes list
function setUserHeroesState(set: any, heroes: UserHero[]) {
  set({
    userHeroes: heroes,
    userHeroesById: indexUserHeroesById(heroes),
  });
}

export const useGameStore = create<GameState>((set, get) => ({
  user: null,
  userHeroes: [],
  userHeroesById: {},
  allHeroes: [],
  isLoading: false,
  error: null,
  isHydrated: false,
  authToken: null,
  authEpoch: 0,  // Incremented on logout to invalidate in-flight requests
  needsPassword: false,

  setHydrated: (value: boolean) => set({ isHydrated: value }),
  
  // Bump epoch on logout to invalidate any in-flight requests
  bumpAuthEpoch: () => set(s => ({ authEpoch: s.authEpoch + 1 })),

  // Primary auth hydration - called on app boot (idempotent, safe to call multiple times)
  // Loads token from storage, sets axios headers, then fetches user
  hydrateAuth: async () => {
    dlog('[hydrateAuth] Starting...');
    
    const token = await loadAuthToken();
    
    if (!token) {
      dlog('[hydrateAuth] No token found, user needs to login');
      apiSetAuthToken(null);
      set({ authToken: null, user: null, isHydrated: true });
      return;
    }
    
    // Set token on API layer BEFORE any requests
    apiSetAuthToken(token);
    set({ authToken: token });
    dlog('[hydrateAuth] Token loaded, fetching user...');
    
    // Fetch user to validate token and populate state
    try {
      const username = await loadAuthUsername();
      if (!username) throw new Error('No username stored');
      
      const userData = await apiFetchUser(username);
      dlog('[hydrateAuth] User restored:', userData.username);
      set({ user: userData, isHydrated: true });
    } catch (e) {
      // Token invalid or server rejected - hard reset
      dlog('[hydrateAuth] User fetch failed, clearing auth:', e);
      await clearAuthData();
      apiSetAuthToken(null);
      set({ authToken: null, user: null, isHydrated: true });
    }
  },

  // Register new user with password
  registerUser: async (username: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const data = await apiRegisterUser({ username, password });
      
      const { user, token } = data;
      
      // Save auth data AND set on API layer
      await saveAuthData(username, token);
      apiSetAuthToken(token);
      
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
      
      // Save auth data using canonical username from response (not input)
      await saveAuthData(user.username, token);
      apiSetAuthToken(token);
      
      set({ user, authToken: token, isLoading: false });
      
      // Trigger daily login
      try {
        await triggerDailyLogin(user.username);
      } catch (e) {
        dlog('Daily login call failed:', e);
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
      
      // Save auth data AND set on API layer
      await saveAuthData(username, token);
      apiSetAuthToken(token);
      
      set({ user: userData, authToken: token, isLoading: false, needsPassword: false });
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to set password';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  // Legacy restoreSession - kept for compatibility, delegates to hydrateAuth
  restoreSession: async () => {
    await get().hydrateAuth();
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
      const userData = await apiFetchUser(username);
      set({ user: userData, isLoading: false });
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
      const data = await triggerDailyLogin(user.username);
      await get().fetchUser();
      set({ isLoading: false });
      return data;
    } catch (error) {
      set({ error: 'Failed to login', isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    // Bump epoch FIRST to invalidate any in-flight requests
    get().bumpAuthEpoch();
    // Clear persisted storage
    await clearAuthData();
    // Clear in-memory token
    apiSetAuthToken(null);
    // Clear store state
    set({ user: null, userHeroes: [], userHeroesById: {}, allHeroes: [], authToken: null, needsPassword: false });
    dlog('[logout] User logged out, auth and storage cleared, epoch bumped');
  },

  /**
   * Register the force logout callback with the API layer.
   * This should be called once during app initialization.
   * Enables the global API interceptor to force logout on 401.
   * 
   * CRITICAL: The callback clears persisted storage to prevent
   * flash states on next hydration.
   */
  registerForceLogout: () => {
    const { logout } = get();
    apiSetForceLogoutCallback(async () => {
      dlog('[API] Force logout triggered by 401');
      await logout();  // Clears storage + in-memory token + store
      // Navigation to login is handled by the auth state change in the app
    });
  },

  fetchUser: async () => {
    const { user, authEpoch } = get();
    if (!user) return;
    
    const epochAtStart = authEpoch;
    try {
      const userData = await apiFetchUser(user.username);
      // Ignore if logout happened during request
      if (get().authEpoch !== epochAtStart) return;
      set({ user: userData });
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  },

  fetchUserHeroes: async () => {
    const { user, authEpoch } = get();
    if (!user) return;
    
    const epochAtStart = authEpoch;
    if (__DEV__) {
      console.warn(
        "[GameStore.fetchUserHeroes] Full roster fetch called. " +
        "This should be used only by roster screens (e.g. /heroes), not hero-detail."
      );
    }
    
    set({ isLoading: true });
    try {
      // Uses centralized API wrapper from lib/api.ts
      const heroes = await getUserHeroes(user.username);
      // Ignore if logout happened during request
      if (get().authEpoch !== epochAtStart) return;
      setUserHeroesState(set, heroes);
      set({ isLoading: false });
    } catch (error) {
      if (get().authEpoch !== epochAtStart) return;
      set({ error: 'Failed to fetch heroes', isLoading: false });
      console.error('Failed to fetch heroes:', error);
    }
  },

  fetchAllHeroes: async () => {
    try {
      const data = await fetchAllHeroesCatalog();
      set({ allHeroes: data });
    } catch (error) {
      console.error('Failed to fetch all heroes:', error);
    }
  },

  pullGacha: async (pullType: 'single' | 'multi', currencyType: 'gems' | 'coins') => {
    const { user, fetchUser, fetchUserHeroes } = get();
    if (!user) throw new Error('No user found');
    
    set({ isLoading: true, error: null });
    
    const result = await safeMutation(
      'pullGacha',
      () => apiPullGacha(user.username, pullType, currencyType),
      {
        refreshUser: true,
        fetchUserFn: fetchUser,
        onSuccess: async () => {
          // Also refresh heroes after gacha
          await fetchUserHeroes();
        },
      }
    );
    
    set({ isLoading: false });
    
    if (!result.ok) {
      // Server error detail is preserved in result.detail
      set({ error: result.detail || 'Failed to pull gacha' });
      throw new Error(result.detail || 'Gacha pull failed');
    }
    
    return result.data;
  },

  upgradeHero: async (heroInstanceId: string) => {
    const { user, fetchUser, fetchUserHeroes } = get();
    if (!user) throw new Error('No user found');
    
    set({ isLoading: true, error: null });
    
    const result = await safeMutation(
      'upgradeHero',
      () => apiUpgradeHero(user.username, heroInstanceId),
      {
        refreshUser: true,
        fetchUserFn: fetchUser,
        onSuccess: async () => {
          // Also refresh heroes after upgrade
          await fetchUserHeroes();
        },
      }
    );
    
    set({ isLoading: false });
    
    if (!result.ok) {
      set({ error: result.detail || 'Failed to upgrade hero' });
      throw new Error(result.detail || 'Hero upgrade failed');
    }
  },

  claimIdleRewards: async () => {
    const { user, fetchUser } = get();
    if (!user) throw new Error('No user found');
    
    const result = await safeMutation(
      'claimIdleRewards',
      () => claimIdle(user.username),
      {
        refreshUser: true,
        fetchUserFn: fetchUser,
      }
    );
    
    if (!result.ok) {
      throw new Error(result.detail || 'Failed to claim idle rewards');
    }
    
    return result.data;
  },

  fetchCR: async () => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    try {
      const data = await getUserCR(user.username);
      return data;
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
      await setProfilePicture(user.username, heroId);
      
      // Refresh user data
      await get().fetchUser();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to update profile picture', isLoading: false });
      throw error;
    }
  },

  setUser: (user: User | null) => set({ user }),
  
  // Selector: find hero by ID from cache (O(1) primary, O(n) fallback)
  selectUserHeroById: (id: string | undefined) => {
    if (!id) return undefined;
    const key = String(id);
    const { userHeroesById, userHeroes } = get();

    // Primary: O(1) map lookup
    const hit = userHeroesById?.[key];
    if (hit) return hit;

    // Secondary fallback (legacy safety) — should become unnecessary over time
    return userHeroes?.find((h: any) => String(h?.id) === key);
  },

  // Single-hero ensure: cache-first lookup + API fallback (keeps logic out of screens)
  // Use forceRefresh: true after upgrade/promotion to bypass cache
  getUserHeroById: async (id: string, opts?: { forceRefresh?: boolean }) => {
    const forceRefresh = opts?.forceRefresh === true;

    // 1) Check cache first (unless forced)
    const existing = get().selectUserHeroById(id);
    if (existing && !forceRefresh) return existing;

    const { user } = get();
    if (!user) throw new Error('No user found');

    // 2) Fetch single hero via API wrapper
    let fresh;
    try {
      fresh = await apiGetUserHeroById(String(user.username), String(id));
    } catch (e: any) {
      throw new Error(
        `[GameStore.getUserHeroById] Failed to ensure hero. username=${user.username} id=${id}. ` +
        `Original: ${e?.message ?? String(e)}`
      );
    }

    // 3) Cache the result (merge into both list + map)
    set((s) => {
      const idKey = String((fresh as any)?.id);
      const nextById = { ...(s.userHeroesById ?? {}), [idKey]: fresh };

      const nextList = s.userHeroes
        ? (s.userHeroes.some((h: any) => String(h?.id) === idKey)
            ? s.userHeroes.map((h: any) => (String(h?.id) === idKey ? fresh : h))
            : [fresh, ...s.userHeroes])
        : [fresh];

      return {
        userHeroes: nextList,
        userHeroesById: nextById,
      };
    });

    return fresh;
  },

  // Smart post-gacha refresh: targeted if few heroes, full roster if many
  // Known response shape: result.heroes[].id = user-hero instance UUID
  refreshHeroesAfterGacha: async (result: any) => {
    const heroes = Array.isArray(result?.heroes) ? result.heroes : [];
    
    if (__DEV__ && !Array.isArray(result?.heroes)) {
      console.warn('[GameStore.refreshHeroesAfterGacha] Expected result.heroes[] array. Falling back to full roster fetch.');
    }

    // Extract user-hero instance IDs (result.heroes[].id)
    const ids = heroes
      .map((h: any) => h?.id)
      .filter((v: any) => v !== null && v !== undefined)
      .map((v: any) => String(v));

    const uniqueIds = Array.from(new Set(ids));

    // Strategy:
    // - 1..3 heroes -> targeted refresh (cheap: 1-3 API calls)
    // - 4+ heroes   -> full roster refresh (cheaper than 4-10 calls)
    if (uniqueIds.length > 0 && uniqueIds.length <= 3) {
      if (__DEV__) console.log('[refreshHeroesAfterGacha] Targeted refresh for', uniqueIds.length, 'heroes:', uniqueIds);
      for (const id of uniqueIds) {
        await get().getUserHeroById(id, { forceRefresh: true });
      }
      return;
    }

    if (__DEV__) console.log('[refreshHeroesAfterGacha] Full roster refresh (', uniqueIds.length, 'heroes)');
    await get().fetchUserHeroes();
  },
}));

// Hook to handle session restoration
// Pure selector hook - NO side effects
// _layout.tsx is the ONLY place that performs restoration
export const useHydration = () => {
  return useGameStore(s => s.isHydrated);
};
