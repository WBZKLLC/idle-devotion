// /app/frontend/components/ui/PrimaryButton.tsx
// Design system primary button - use for main CTAs

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, COLORS } from './tokens';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  variant?: 'gold' | 'blue' | 'green' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const VARIANTS = {
  gold: [COLORS.gold.primary, COLORS.gold.dark],
  blue: ['#3B82F6', '#1D4ED8'],
  green: ['#22C55E', '#15803D'],
  purple: ['#A855F7', '#7C3AED'],
} as const;

const SIZES = {
  sm: { height: 36, paddingHorizontal: SPACING.md, fontSize: FONT_SIZE.sm },
  md: { height: TOUCH_TARGET.min, paddingHorizontal: SPACING.lg, fontSize: FONT_SIZE.md },
  lg: { height: 52, paddingHorizontal: SPACING.xl, fontSize: FONT_SIZE.lg },
} as const;

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'gold',
  size = 'md',
  style,
  textStyle,
}: PrimaryButtonProps) {
  const sizeConfig = SIZES[size];
  const colors = VARIANTS[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={disabled ? ['#6B7280', '#4B5563'] : colors}
        style={[
          styles.gradient,
          { height: sizeConfig.height, paddingHorizontal: sizeConfig.paddingHorizontal },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <>
            {icon && <>{icon}</>}
            <Text
              style={[
                styles.text,
                { fontSize: sizeConfig.fontSize },
                icon && styles.textWithIcon,
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  text: {
    color: 'white',
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  textWithIcon: {
    marginLeft: SPACING.sm,
  },
});
