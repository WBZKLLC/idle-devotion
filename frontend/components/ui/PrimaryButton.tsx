// /app/frontend/components/ui/PrimaryButton.tsx
// Design system primary button - use for main CTAs
// Phase 3.19.2: Added accessibility, leftIcon/rightIcon, pressed state

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, COLORS } from './tokens';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** @deprecated Use leftIcon instead */
  icon?: React.ReactNode;
  variant?: 'gold' | 'blue' | 'green' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
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
  leftIcon,
  rightIcon,
  icon, // deprecated, use leftIcon
  variant = 'gold',
  size = 'md',
  style,
  textStyle,
  testID,
}: PrimaryButtonProps) {
  const sizeConfig = SIZES[size];
  const colors = VARIANTS[variant];
  const isDisabled = disabled || loading;
  const resolvedLeftIcon = leftIcon || icon;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {({ pressed }) => (
        <LinearGradient
          colors={isDisabled ? ['#6B7280', '#4B5563'] : colors}
          style={[
            styles.gradient,
            { height: sizeConfig.height, paddingHorizontal: sizeConfig.paddingHorizontal },
            pressed && !isDisabled && styles.gradientPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <View style={styles.content}>
              {resolvedLeftIcon && <View style={styles.leftIcon}>{resolvedLeftIcon}</View>}
              <Text
                style={[
                  styles.text,
                  { fontSize: sizeConfig.fontSize },
                  textStyle,
                ]}
              >
                {title}
              </Text>
              {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
            </View>
          )}
        </LinearGradient>
      )}
    </Pressable>
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
