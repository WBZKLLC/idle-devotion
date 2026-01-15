// /app/frontend/components/ui/SecondaryButton.tsx
// Design system secondary button - use for secondary actions
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
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, COLORS } from './tokens';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** @deprecated Use leftIcon instead */
  icon?: React.ReactNode;
  variant?: 'outline' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

const SIZES = {
  sm: { height: 36, paddingHorizontal: SPACING.md, fontSize: FONT_SIZE.sm },
  md: { height: TOUCH_TARGET.min, paddingHorizontal: SPACING.lg, fontSize: FONT_SIZE.md },
  lg: { height: 52, paddingHorizontal: SPACING.xl, fontSize: FONT_SIZE.lg },
} as const;

export function SecondaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  icon, // deprecated, use leftIcon
  variant = 'outline',
  size = 'md',
  style,
  textStyle,
  testID,
}: SecondaryButtonProps) {
  const sizeConfig = SIZES[size];
  const isDisabled = disabled || loading;
  const resolvedLeftIcon = leftIcon || icon;

  const variantStyles = {
    outline: {
      container: styles.outlineContainer,
      containerPressed: styles.outlineContainerPressed,
      text: styles.outlineText,
    },
    ghost: {
      container: styles.ghostContainer,
      containerPressed: styles.ghostContainerPressed,
      text: styles.ghostText,
    },
    subtle: {
      container: styles.subtleContainer,
      containerPressed: styles.subtleContainerPressed,
      text: styles.subtleText,
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        currentVariant.container,
        { height: sizeConfig.height, paddingHorizontal: sizeConfig.paddingHorizontal },
        pressed && !isDisabled && currentVariant.containerPressed,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.gold.primary} size="small" />
      ) : (
        <View style={styles.content}>
          {resolvedLeftIcon && <View style={styles.leftIcon}>{resolvedLeftIcon}</View>}
          <Text
            style={[
              styles.textBase,
              currentVariant.text,
              { fontSize: sizeConfig.fontSize },
              isDisabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      )}
    </Pressable>
  );
}

/** Convenience wrapper for ghost variant */
export function GhostButton(props: Omit<SecondaryButtonProps, 'variant'>) {
  return <SecondaryButton {...props} variant="ghost" />;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBase: {
    fontWeight: FONT_WEIGHT.semibold,
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  rightIcon: {
    marginLeft: SPACING.sm,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  // Outline variant
  outlineContainer: {
    borderWidth: 2,
    borderColor: COLORS.gold.primary,
    backgroundColor: 'transparent',
  },
  outlineContainerPressed: {
    backgroundColor: 'rgba(201, 162, 39, 0.1)',
  },
  outlineText: {
    color: COLORS.gold.primary,
  },
  // Ghost variant
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostContainerPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  ghostText: {
    color: COLORS.gold.primary,
  },
  // Subtle variant
  subtleContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  subtleContainerPressed: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  subtleText: {
    color: COLORS.gold.light,
  },
});
