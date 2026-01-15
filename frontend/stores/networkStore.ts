// /app/frontend/stores/networkStore.ts
// Minimal network state store for offline detection
import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStore {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  initNetworkListener: () => () => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: true, // Assume online initially
  
  setOnline: (online: boolean) => set({ isOnline: online }),
  
  // Returns unsubscribe function
  initNetworkListener: () => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      set({ isOnline: online });
      if (__DEV__) {
        console.log('[Network] Connection state:', online ? 'ONLINE' : 'OFFLINE');
      }
    });
    return unsubscribe;
  },
}));
