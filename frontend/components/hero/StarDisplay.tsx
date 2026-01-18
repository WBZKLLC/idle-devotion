// /app/frontend/components/hero/StarDisplay.tsx
// Phase 3.40: Hero Star Display Component
//
// Displays filled/hollow stars.
// Read-only display from server data.
// NO CLIENT-SIDE STAR MUTATIONS.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  gold: { primary: '#c9a227', light: '#e6c666' },
};

interface StarDisplayProps {
  currentStar: number;
  maxStar?: number;
  size?: number;
  showEmpty?: boolean;
}

export function StarDisplay({
  currentStar,
  maxStar = 6,
  size = 16,
  showEmpty = true,
}: StarDisplayProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: maxStar }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < currentStar ? 'star' : 'star-outline'}
          size={size}
          color={i < currentStar ? COLORS.gold.primary : 'rgba(255,255,255,0.3)'}
          style={showEmpty || i < currentStar ? undefined : { display: 'none' }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
  },
});

export default StarDisplay;
