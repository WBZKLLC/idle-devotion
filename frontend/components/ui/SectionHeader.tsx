// /app/frontend/components/ui/SectionHeader.tsx
// Design system section header

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZE, FONT_WEIGHT, COLORS } from './tokens';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: {
    label: string;
    onPress: () => void;
  };
  style?: ViewStyle;
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={COLORS.gold.primary}
            style={styles.icon}
          />
        )}
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} style={styles.action}>
          <Text style={styles.actionText}>{action.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.gold.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: 'white',
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: '#9CA3AF',
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold.primary,
    marginRight: 4,
  },
});
