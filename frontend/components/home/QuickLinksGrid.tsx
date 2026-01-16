import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import type { GradientColors } from '../../lib/ui/gradients';
// Phase 3.22.4: Micro-interaction constants
import { PRESS } from '../../lib/ui/interaction';

type BaseTile = {
  key: string;
  onPress: () => void;
  flex?: 1 | 2;
  gradient: GradientColors;
  gradientStyle?: ViewStyle;
};

type StandardTile = BaseTile & {
  kind: 'standard';
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  labelStyle?: TextStyle;
  showIonicon?: boolean; // default true
  emoji?: string;        // optional replacement for icon
};

type CustomTile = BaseTile & {
  kind: 'custom';
  children: React.ReactNode;
};

export type QuickLinkTile = StandardTile | CustomTile;

export type QuickLinkRow = {
  key: string;
  tiles: QuickLinkTile[];
};

type Props = {
  rows: QuickLinkRow[];
};

export function QuickLinksGrid({ rows }: Props) {
  return (
    <>
      {rows.map((row) => (
        <View key={row.key} style={styles.quickLinksRow}>
          {row.tiles.map((tile) => (
            <Pressable
              key={tile.key}
              style={({ pressed }) => [
                styles.quickLink,
                { flex: tile.flex ?? 1 },
                // Phase 3.22.4: Pressed feedback
                pressed && styles.quickLinkPressed,
              ]}
              onPress={tile.onPress}
            >
              <LinearGradient
                colors={tile.gradient}
                style={[styles.quickLinkGradient, tile.gradientStyle]}
              >
                {tile.kind === 'custom' ? (
                  tile.children
                ) : (
                  <>
                    {tile.emoji ? (
                      <Text style={styles.emoji}>{tile.emoji}</Text>
                    ) : tile.showIonicon === false ? null : (
                      <Ionicons
                        name={tile.icon ?? 'grid'}
                        size={22}
                        color={tile.iconColor ?? COLORS.gold.light}
                      />
                    )}
                    <Text style={[styles.quickLinkText, tile.labelStyle]}>{tile.label}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  quickLinksRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickLink: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Phase 3.22.4: Pressed state feedback
  quickLinkPressed: {
    transform: [{ scale: PRESS.SCALE }],
    opacity: PRESS.OPACITY,
  },
  quickLinkGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '30',
  },
  quickLinkText: {
    color: COLORS.cream.soft,
    fontSize: 12,
    fontWeight: '600',
  },
  emoji: {
    fontSize: 20,
  },
});
