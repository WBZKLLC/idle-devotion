// /app/frontend/components/ui/SecondaryButton.tsx
// Design system secondary button - use for secondary actions

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, COLORS } from './tokens';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  variant?: 'outline' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
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
  icon,
  variant = 'outline',
  size = 'md',
  style,
  textStyle,
}: SecondaryButtonProps) {
  const sizeConfig = SIZES[size];

  const variantStyles = {
    outline: {
      container: styles.outlineContainer,
      text: styles.outlineText,
    },
    ghost: {
      container: styles.ghostContainer,
      text: styles.ghostText,
    },
    subtle: {
      container: styles.subtleContainer,
      text: styles.subtleText,
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        currentVariant.container,
        { height: sizeConfig.height, paddingHorizontal: sizeConfig.paddingHorizontal },
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.gold.primary} size="small" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.textBase,
              currentVariant.text,
              { fontSize: sizeConfig.fontSize },
              icon && styles.textWithIcon,
              disabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  textBase: {
    fontWeight: FONT_WEIGHT.semibold,
    textAlign: 'center',
  },
  textWithIcon: {
    marginLeft: SPACING.sm,
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
  outlineText: {
    color: COLORS.gold.primary,
  },
  // Ghost variant
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: COLORS.gold.primary,
  },
  // Subtle variant
  subtleContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  subtleText: {
    color: COLORS.gold.light,
  },
});
