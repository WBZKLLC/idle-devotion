import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';

type GradientColors = readonly [string, string] | readonly [string, string, string];

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
            <TouchableOpacity
              key={tile.key}
              style={[styles.quickLink, { flex: tile.flex ?? 1 }]}
              onPress={tile.onPress}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={tile.gradient as unknown as string[]} // expo-linear-gradient accepts string[]
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
            </TouchableOpacity>
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
