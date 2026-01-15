// /app/frontend/components/ui/DisabledHint.tsx
// Phase 3.19.1: Inline "Requires X" label for disabled states

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { toast } from './Toast';

type HintVariant = 'lock' | 'currency' | 'level' | 'vip' | 'time' | 'custom';

interface DisabledHintProps {
  /** The requirement text, e.g., "VIP 5", "100 Gems", "Complete Ch.3" */
  requirement: string;
  /** Variant determines icon */
  variant?: HintVariant;
  /** Custom icon override */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional onPress - if provided, shows toast with full explanation */
  onPress?: () => void;
  /** Full explanation for toast (optional) */
  explanation?: string;
  /** Inline style override */
  style?: ViewStyle;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

const VARIANT_ICONS: Record<HintVariant, keyof typeof Ionicons.glyphMap> = {
  lock: 'lock-closed',
  currency: 'diamond',
  level: 'trending-up',
  vip: 'star',
  time: 'time',
  custom: 'information-circle',
};

/**
 * Inline disabled state hint with consistent styling.
 * Every disabled CTA should show a reason.
 */
export function DisabledHint({
  requirement,
  variant = 'lock',
  icon,
  onPress,
  explanation,
  style,
  compact = false,
}: DisabledHintProps) {
  const iconName = icon || VARIANT_ICONS[variant];

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (explanation) {
      toast.info(explanation);
    } else {
      toast.info(`Requires: ${requirement}`);
    }
  };

  const content = (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <Ionicons
        name={iconName}
        size={compact ? 10 : 12}
        color="rgba(255, 215, 140, 0.7)"
      />
      <Text style={[styles.text, compact && styles.textCompact]}>
        {requirement}
      </Text>
    </View>
  );

  // If interactive, wrap in TouchableOpacity
  if (onPress || explanation) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// =============================================================================
// PREBUILT DISABLED HINTS
// =============================================================================

export function RequiresVIPHint({ level, onPress }: { level: number; onPress?: () => void }) {
  return (
    <DisabledHint
      requirement={`VIP ${level}`}
      variant="vip"
      explanation={`Unlock VIP ${level} to access this feature.`}
      onPress={onPress}
    />
  );
}

export function RequiresCurrencyHint({
  amount,
  currency,
  onPress,
}: {
  amount: number;
  currency: 'gems' | 'gold' | 'coins' | 'divine_essence';
  onPress?: () => void;
}) {
  const currencyNames: Record<string, string> = {
    gems: 'Crystals',
    gold: 'Gold',
    coins: 'Coins',
    divine_essence: 'Divine Essence',
  };
  return (
    <DisabledHint
      requirement={`${amount.toLocaleString()} ${currencyNames[currency]}`}
      variant="currency"
      explanation={`You need ${amount.toLocaleString()} ${currencyNames[currency]} to proceed.`}
      onPress={onPress}
    />
  );
}

export function RequiresLevelHint({ level, onPress }: { level: number; onPress?: () => void }) {
  return (
    <DisabledHint
      requirement={`Level ${level}`}
      variant="level"
      explanation={`Reach level ${level} to unlock this feature.`}
      onPress={onPress}
    />
  );
}

export function RequiresStarsHint({ stars, onPress }: { stars: number; onPress?: () => void }) {
  return (
    <DisabledHint
      requirement={`${stars}★`}
      variant="level"
      icon="star"
      explanation={`Reach ${stars} stars to unlock this tier.`}
      onPress={onPress}
    />
  );
}

export function RequiresChapterHint({ chapter, onPress }: { chapter: number; onPress?: () => void }) {
  return (
    <DisabledHint
      requirement={`Complete Ch.${chapter}`}
      variant="lock"
      explanation={`Complete Chapter ${chapter} to unlock this content.`}
      onPress={onPress}
    />
  );
}

export function CooldownHint({ timeRemaining }: { timeRemaining: string }) {
  return (
    <DisabledHint
      requirement={timeRemaining}
      variant="time"
      explanation="This action is on cooldown. Please wait."
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 140, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.2)',
  },
  containerCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 215, 140, 0.85)',
  },
  textCompact: {
    fontSize: 9,
  },
});

export default DisabledHint;
