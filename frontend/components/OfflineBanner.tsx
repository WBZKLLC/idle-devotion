// /app/frontend/components/OfflineBanner.tsx
// Offline indicator banner with optional retry action
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNetworkStore } from '../stores/networkStore';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onRetry?: () => void;
}

export const OfflineBanner: React.FC<Props> = ({ onRetry }) => {
  const isOnline = useNetworkStore(s => s.isOnline);
  
  if (isOnline) return null;
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={16} color="#fff" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>You're offline</Text>
          <Text style={styles.subtitle}>Some actions are disabled until connection returns.</Text>
        </View>
      </View>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
