// /app/frontend/components/OfflineBanner.tsx
// Simple offline indicator banner - shows when device loses connection
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStore } from '../stores/networkStore';
import { Ionicons } from '@expo/vector-icons';

export const OfflineBanner: React.FC = () => {
  const isOnline = useNetworkStore(s => s.isOnline);
  
  if (isOnline) return null;
  
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline" size={16} color="#fff" />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
