import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  id: string;
  username: string;
  gems: number;
  coins: number;
  gold: number;
  divine_essence?: number;
  pity_counter: number;
  pity_counter_premium?: number;
  pity_counter_divine?: number;
  total_pulls: number;
  login_days: number;
  last_login: string | null;
  daily_summons_claimed: number;
  profile_picture_hero_id: string | null;
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
  _hasHydrated: boolean;
  
  // Actions
  initUser: (username: string) => Promise<void>;
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
  setHasHydrated: (state: boolean) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      user: null,
      userHeroes: [],
      allHeroes: [],
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      initUser: async (username: string) => {
    set({ isLoading: true, error: null });
    try {
      // Try to get existing user
      const response = await axios.get(`${BACKEND_URL}/api/user/${username}`);
      set({ user: response.data, isLoading: false });
      await AsyncStorage.setItem('username', username);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Register new user
        const registerResponse = await axios.post(
          `${BACKEND_URL}/api/user/register?username=${username}`
        );
        set({ user: registerResponse.data, isLoading: false });
        await AsyncStorage.setItem('username', username);
      } else {
        set({ error: 'Failed to initialize user', isLoading: false });
        throw error;
      }
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
      // Refresh user data after login
      await get().fetchUser();
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: 'Failed to login', isLoading: false });
      throw error;
    }
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
      const response = await axios.get(
        `${BACKEND_URL}/api/user/${user.username}/heroes`
      );
      set({ userHeroes: response.data, isLoading: false });
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
      const response = await axios.post(
        `${BACKEND_URL}/api/gacha/pull?username=${user.username}`,
        {
          pull_type: pullType,
          currency_type: currencyType,
        }
      );
      
      // Refresh user and heroes data
      await get().fetchUser();
      await get().fetchUserHeroes();
      
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to pull gacha', isLoading: false });
      throw error;
    }
  },

  upgradeHero: async (heroInstanceId: string) => {
    const { user } = get();
    if (!user) throw new Error('No user found');
    
    set({ isLoading: true });
    try {
      await axios.post(
        `${BACKEND_URL}/api/user/${user.username}/heroes/${heroInstanceId}/upgrade`
      );
      
      // Refresh heroes data
      await get().fetchUserHeroes();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to upgrade hero', isLoading: false });
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

  logout: async () => {
    await AsyncStorage.removeItem('divine_heroes_username');
    set({ user: null, userHeroes: [], allHeroes: [] });
  },

  setUser: (user: User | null) => set({ user }),
    }),
    {
      name: 'divine-heroes-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        user: state.user,
        // Only persist user data, not loading states or heroes cache
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error rehydrating state:', error);
        }
        // Always set hydrated to true, even if there's an error
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);

// Helper hook to ensure hydration
export const useHydration = () => {
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    // Manual check for hydration
    const unsubFinishHydration = useGameStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    
    // Check if already hydrated
    if (useGameStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    
    return () => {
      unsubFinishHydration();
    };
  }, []);
  
  return hydrated;
};
