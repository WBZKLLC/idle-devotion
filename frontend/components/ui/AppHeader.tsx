// /app/frontend/components/ui/AppHeader.tsx
// Phase 3.19.6: Canonical header component for consistent UX across key screens

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';

// =============================================================================
// CANONICAL LAYOUT CONSTANTS (Phase 3.19.6)
// =============================================================================
export const LAYOUT = {
  SCREEN_PADDING: 16,
  SECTION_GAP: 12,
  MAJOR_SECTION_GAP: 24,
  HEADER_HEIGHT: 56,
  CARD_RADIUS: 16,
  BUTTON_RADIUS: 14,
} as const;

// =============================================================================
// TYPES
// =============================================================================
type LeftAction = {
  type: 'back' | 'home' | 'close' | 'none';
  onPress?: () => void;
};

interface AppHeaderProps {
  /** Screen title displayed in center */
  title: string;
  /** Optional subtitle (smaller, muted) */
  subtitle?: string;
  /** Left action button configuration */
  left?: LeftAction;
  /** Right slot content (optional action icons) */
  right?: React.ReactNode;
  /** Use transparent background (for overlay on hero images) */
  transparent?: boolean;
  /** Custom background color override */
  backgroundColor?: string;
  /** Custom style for the container */
  style?: ViewStyle;
  /** Include safe area padding at top */
  includeSafeArea?: boolean;
  /** Center the title (default: true for standard screens) */
  centerTitle?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================
export function AppHeader({
  title,
  subtitle,
  left = { type: 'none' },
  right,
  transparent = false,
  backgroundColor,
  style,
  includeSafeArea = true,
  centerTitle = true,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Default handlers for left actions
  const handleLeftPress = () => {
    if (left.onPress) {
      left.onPress();
    } else {
      switch (left.type) {
        case 'back':
          router.back();
          break;
        case 'home':
          router.replace('/');
          break;
        case 'close':
          router.back();
          break;
      }
    }
  };

  // Left icon based on type
  const getLeftIcon = (): keyof typeof Ionicons.glyphMap | null => {
    switch (left.type) {
      case 'back':
        return Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back';
      case 'home':
        return 'home';
      case 'close':
        return 'close';
      default:
        return null;
    }
  };

  const leftIcon = getLeftIcon();

  return (
    <View
      style={[
        styles.container,
        includeSafeArea && { paddingTop: insets.top },
        !transparent && { backgroundColor: backgroundColor || COLORS.navy.darkest },
        transparent && styles.transparent,
        style,
      ]}
    >
      <View style={styles.content}>
        {/* Left Slot */}
        <View style={styles.leftSlot}>
          {leftIcon && (
            <TouchableOpacity
              onPress={handleLeftPress}
              style={styles.iconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={left.type === 'back' ? 'Go back' : left.type === 'home' ? 'Go home' : 'Close'}
            >
              <Ionicons name={leftIcon} size={24} color={COLORS.cream.pure} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center Title */}
        <View style={styles.centerSlot}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Right Slot */}
        <View style={styles.rightSlot}>
          {right}
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================
const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 10,
  },
  transparent: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
  },
  leftSlot: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.cream.pure,
    letterSpacing: 0.3,
  },
});

export default AppHeader;
