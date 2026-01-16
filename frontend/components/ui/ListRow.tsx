// /app/frontend/components/ui/ListRow.tsx
// Phase 3.22.5: Elegant list row primitive
// Gap-based separation (no borders), consistent padding/height, pressed feedback

import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { LIST, RADIUS } from './tokens';
import COLORS from '../../theme/colors';
import { PRESS, haptic } from '../../lib/ui/interaction';

type Props = {
  /** Row content (title, subtitle, etc.) */
  children: React.ReactNode;
  /** Optional press handler - if provided, row becomes tappable */
  onPress?: () => void;
  /** Leading element (icon, avatar) - auto-sized to LIST.LEADING_SIZE */
  leading?: React.ReactNode;
  /** Trailing element (chevron, badge, button) */
  trailing?: React.ReactNode;
  /** Additional row styles */
  style?: ViewStyle;
  /** Enable haptic feedback on press (default: false) */
  haptics?: boolean;
  /** Disable interaction */
  disabled?: boolean;
  /** Test ID for automation */
  testID?: string;
  /** Background color override (default: COLORS.navy.dark) */
  backgroundColor?: string;
};

export function ListRow({
  children,
  onPress,
  leading,
  trailing,
  style,
  haptics = false,
  disabled = false,
  testID,
  backgroundColor,
}: Props) {
  const rowStyle = [
    styles.row,
    backgroundColor ? { backgroundColor } : null,
    style,
  ];

  const content = (
    <View style={rowStyle}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>{children}</View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  // Non-pressable row
  if (!onPress) {
    return <View testID={testID}>{content}</View>;
  }

  // Pressable row with feedback
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        if (haptics) haptic('light');
        onPress();
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: LIST.ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LIST.ROW_PAD_X,
    paddingVertical: LIST.ROW_PAD_Y,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.navy.dark,
  },
  pressed: {
    transform: [{ scale: PRESS.SCALE }],
    opacity: PRESS.OPACITY,
  },
  leading: {
    width: LIST.LEADING_SIZE,
    height: LIST.LEADING_SIZE,
    borderRadius: LIST.LEADING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: COLORS.navy.primary,
  },
  body: {
    flex: 1,
  },
  trailing: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
