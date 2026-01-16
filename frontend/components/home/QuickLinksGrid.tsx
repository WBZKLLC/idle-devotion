// /app/frontend/components/home/QuickLinksGrid.tsx
// Phase 3.22.6.C: "Desire Without Demand"
// Phase 3.22.7: Restraint Pass — dormant until chosen
//
// Quick links are not buttons — they are rituals you may or may not perform today.
// Nothing flashes. Nothing pulses. Only the Idle card breathes.

import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import type { GradientColors } from '../../lib/ui/gradients';
// Phase 3.22.4: Micro-interaction constants
import { PRESS } from '../../lib/ui/interaction';
// Phase 3.22.7: Restraint tokens
import { INVITATION, SECTION_GAP } from '../ui/tokens';

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
      {rows.map((row, rowIndex) => (
        <View 
          key={row.key} 
          style={[
            styles.quickLinksRow,
            // Phase 3.22.6.C: Increased vertical spacing between rows
            rowIndex > 0 && styles.rowSpacing,
          ]}
        >
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
                        size={20}
                        color={tile.iconColor ?? COLORS.cream.soft}
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
    gap: 10,
    marginBottom: 12,
  },
  // Phase 3.22.6.C: More breathing room between sections
  rowSpacing: {
    marginTop: 4,
  },
  quickLink: {
    borderRadius: 14, // slightly more rounded
    overflow: 'hidden',
  },
  // Phase 3.22.4: Pressed state feedback
  quickLinkPressed: {
    transform: [{ scale: PRESS.SCALE }],
    opacity: PRESS.OPACITY,
  },
  quickLinkGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.gold.dark + '20', // softer border
    borderRadius: 14,
  },
  quickLinkText: {
    color: COLORS.cream.soft,
    fontSize: 11,
    fontWeight: '500', // slightly lighter
    letterSpacing: 0.3,
  },
  emoji: {
    fontSize: 18,
  },
});
