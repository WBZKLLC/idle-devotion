// /app/frontend/components/ui/Card.tsx
// Design system card component

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, RADIUS, SHADOW, COLORS } from './tokens';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'premium' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const PADDING_MAP = {
  none: 0,
  sm: SPACING.sm,
  md: SPACING.md,
  lg: SPACING.lg,
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
}: CardProps) {
  const paddingValue = PADDING_MAP[padding];

  if (variant === 'premium') {
    return (
      <LinearGradient
        colors={[COLORS.navy.medium, COLORS.navy.primary]}
        style={[
          styles.base,
          SHADOW.md,
          styles.premium,
          { padding: paddingValue },
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && SHADOW.md,
        variant === 'subtle' && styles.subtle,
        variant === 'default' && styles.default,
        { padding: paddingValue },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  default: {
    backgroundColor: COLORS.navy.medium,
    borderWidth: 1,
    borderColor: COLORS.navy.light,
  },
  subtle: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  premium: {
    borderWidth: 1,
    borderColor: COLORS.gold.primary,
  },
});
