// /app/frontend/components/ui/EmptyState.tsx
// Phase 3.19.1: Themed empty state component with optional CTA
// Phase 3.19.2: Updated to use canonical button components

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface EmptyStateAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  style?: ViewStyle;
  compact?: boolean;
}

/**
 * Themed empty state component matching DivineShell aesthetic.
 * Use for: no heroes, no guild, no messages, no events, etc.
 */
export function EmptyState({
  title,
  subtitle,
  icon = 'folder-open-outline',
  iconColor,
  action,
  secondaryAction,
  style,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {/* Icon with subtle glow */}
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={compact ? 48 : 64}
          color={iconColor || 'rgba(255, 215, 140, 0.6)'}
        />
      </View>

      {/* Title */}
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>

      {/* Subtitle */}
      {subtitle && (
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>
      )}

      {/* Primary Action - using canonical button */}
      {action && (
        <View style={styles.actionButton}>
          {action.variant === 'secondary' ? (
            <SecondaryButton
              title={action.label}
              onPress={action.onPress}
              variant="outline"
              size="md"
            />
          ) : (
            <PrimaryButton
              title={action.label}
              onPress={action.onPress}
              variant="gold"
              size="md"
            />
          )}
        </View>
      )}

      {/* Secondary Action - using canonical ghost button */}
      {secondaryAction && (
        <View style={styles.secondaryAction}>
          <SecondaryButton
            title={secondaryAction.label}
            onPress={secondaryAction.onPress}
            variant="ghost"
            size="sm"
          />
        </View>
      )}
    </View>
  );
}

// =============================================================================
// PREBUILT EMPTY STATES
// =============================================================================

export function NoHeroesEmpty({ onSummon }: { onSummon: () => void }) {
  return (
    <EmptyState
      icon="sparkles-outline"
      title="No Heroes Yet"
      subtitle="Summon your first hero to begin your divine journey!"
      action={{ label: 'Summon Heroes', onPress: onSummon }}
    />
  );
}

export function NoGuildEmpty({ onCreate, onFind }: { onCreate: () => void; onFind: () => void }) {
  return (
    <EmptyState
      icon="shield-outline"
      title="Join a Guild"
      subtitle="Team up with other players for exclusive rewards!"
      action={{ label: 'Create Guild', onPress: onCreate }}
      secondaryAction={{ label: 'Find Guild', onPress: onFind }}
    />
  );
}

export function NoMessagesEmpty() {
  return (
    <EmptyState
      icon="chatbubbles-outline"
      title="No Messages"
      subtitle="Your inbox is empty. Check back later!"
      compact
    />
  );
}

export function NoEventsEmpty() {
  return (
    <EmptyState
      icon="calendar-outline"
      title="No Active Events"
      subtitle="Check back soon for new events and challenges!"
      compact
    />
  );
}

export function NoBannersEmpty() {
  return (
    <EmptyState
      icon="sparkles-outline"
      title="No Banners Available"
      subtitle="New summon banners coming soon!"
      compact
    />
  );
}

export function NoStagesEmpty() {
  return (
    <EmptyState
      icon="map-outline"
      title="No Stages Available"
      subtitle="Complete previous chapters to unlock more stages."
      compact
    />
  );
}

export function FilterNoResultsEmpty({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon="search-outline"
      title="No Results"
      subtitle="No heroes match your current filters."
      action={{ label: 'Clear Filters', onPress: onClear, variant: 'secondary' }}
      compact
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  containerCompact: {
    paddingVertical: 32,
  },
  iconContainer: {
    marginBottom: 16,
    opacity: 0.9,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 17,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  subtitleCompact: {
    fontSize: 13,
  },
  actionButton: {
    marginTop: 24,
  },
  secondaryAction: {
    marginTop: 8,
  },
});

export default EmptyState;
