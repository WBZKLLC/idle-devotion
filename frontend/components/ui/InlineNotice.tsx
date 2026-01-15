// /app/frontend/components/ui/InlineNotice.tsx
// Design system inline notice/banner component

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, FONT_SIZE, COLORS, PREMIUM_COLORS } from './tokens';

type NoticeVariant = 'info' | 'success' | 'warning' | 'error' | 'premium';

interface InlineNoticeProps {
  message: string;
  variant?: NoticeVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: {
    label: string;
    onPress: () => void;
  };
  onDismiss?: () => void;
  style?: ViewStyle;
}

const VARIANT_CONFIG = {
  info: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: '#3B82F6',
    text: '#93C5FD',
    icon: 'information-circle' as const,
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: PREMIUM_COLORS.green,
    text: '#86EFAC',
    icon: 'checkmark-circle' as const,
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: PREMIUM_COLORS.amber,
    text: '#FCD34D',
    icon: 'warning' as const,
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.15)',
    border: '#EF4444',
    text: '#FCA5A5',
    icon: 'alert-circle' as const,
  },
  premium: {
    bg: 'rgba(255, 215, 0, 0.1)',
    border: COLORS.gold.primary,
    text: COLORS.gold.light,
    icon: 'star' as const,
  },
};

export function InlineNotice({
  message,
  variant = 'info',
  icon,
  action,
  onDismiss,
  style,
}: InlineNoticeProps) {
  const config = VARIANT_CONFIG[variant];
  const iconName = icon || config.icon;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={iconName}
          size={18}
          color={config.border}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: config.text }]}>{message}</Text>
      </View>
      <View style={styles.actions}>
        {action && (
          <TouchableOpacity onPress={action.onPress} style={styles.actionButton}>
            <Text style={[styles.actionText, { color: config.border }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        )}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Ionicons name="close" size={18} color={config.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  message: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: SPACING.sm,
  },
  actionText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  dismissButton: {
    marginLeft: SPACING.sm,
    padding: 4,
  },
});
