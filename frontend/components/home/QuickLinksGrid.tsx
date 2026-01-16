// /app/frontend/components/home/QuickLinksGrid.tsx
// Phase 3.22.6.C: "Desire Without Demand"
// Phase 3.22.7: Restraint Pass — dormant until chosen
// Phase 3.22.11: Elegance Pass — doors, not buttons
//
// Quick links are not buttons — they are doors to other rooms.
// Nothing flashes. Nothing pulses. Only the Idle card breathes.

import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import type { GradientColors } from '../../lib/ui/gradients';
// Phase 3.22.4: Micro-interaction constants
import { PRESS } from '../../lib/ui/interaction';
// Phase 3.22.7: Restraint tokens
import { INVITATION, SECTION_GAP, RADIUS } from '../ui/tokens';

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
  // Phase 3.22.10: Global interaction signal (cancels pending desire accents)
  onAnyInteraction?: () => void;
};

export function QuickLinksGrid({ rows, onAnyInteraction }: Props) {
  return (
    <>
      {rows.map((row, rowIndex) => (
        <View 
          key={row.key} 
          style={[
            styles.quickLinksRow,
            // Phase 3.22.11: First row gets slightly more breathing room from ritual
            rowIndex === 0 && styles.firstRow,
            rowIndex > 0 && styles.rowSpacing,
          ]}
        >
          {row.tiles.map((tile) => (
            <Pressable
              key={tile.key}
              style={({ pressed }) => [
                styles.quickLink,
                { flex: tile.flex ?? 1 },
                pressed && styles.quickLinkPressed,
              ]}
              onPressIn={onAnyInteraction}
              onPress={tile.onPress}
            >
              {/* Phase 3.22.11: Card container with shadow */}
              <View style={styles.cardShadow}>
                <LinearGradient
                  colors={tile.gradient}
                  style={[styles.quickLinkGradient, tile.gradientStyle]}
                >
                  {/* Phase 3.22.11: Soft inner highlight (top edge glow) */}
                  <View style={styles.innerHighlight} />
                  
                  {tile.kind === 'custom' ? (
                    tile.children
                  ) : (
                    <View style={styles.tileContent}>
                      {tile.emoji ? (
                        <Text style={styles.emoji}>{tile.emoji}</Text>
                      ) : tile.showIonicon === false ? null : (
                        <Ionicons
                          name={tile.icon ?? 'grid'}
                          size={18}
                          color={tile.iconColor ?? COLORS.cream.soft}
                          style={styles.tileIcon}
                        />
                      )}
                      <Text style={[styles.quickLinkText, tile.labelStyle]}>{tile.label}</Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
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
    gap: 8, // Phase 3.22.11: Tighter gap for cohesion
    marginBottom: SECTION_GAP.rest,
    // Phase 3.22.11: Submissive — doors, not competition
    opacity: INVITATION.secondary * 0.95,
  },
  // Phase 3.22.11: Breathing room after the ritual (Idle card)
  firstRow: {
    marginTop: SECTION_GAP.breath,
  },
  rowSpacing: {
    marginTop: 2, // Phase 3.22.11: Tighter vertical rhythm
  },
  quickLink: {
    borderRadius: RADIUS.lg, // Phase 3.22.11: Match card family
    overflow: 'hidden',
  },
  quickLinkPressed: {
    transform: [{ scale: PRESS.SCALE }],
    opacity: 1,
  },
  // Phase 3.22.11: Subtle shadow for lift (not flat)
  cardShadow: {
    borderRadius: RADIUS.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      },
    }),
  },
  quickLinkGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    // Phase 3.22.11: Reduced border reliance — shadow does the work
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '08',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  // Phase 3.22.11: Soft inner highlight — glass-like top edge
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.cream.pure,
    opacity: 0.08,
  },
  // Phase 3.22.11: Intentional icon + label composition
  tileContent: {
    alignItems: 'center',
    gap: 4, // Tighter gap
  },
  tileIcon: {
    marginBottom: 1, // Icon slightly higher
  },
  quickLinkText: {
    color: COLORS.cream.soft,
    fontSize: 10, // Phase 3.22.11: Smaller label
    fontWeight: '500',
    letterSpacing: 0.5, // Phase 3.22.11: Increased tracking
    textTransform: 'uppercase', // Phase 3.22.11: More elegant
    opacity: 0.85,
  },
  emoji: {
    fontSize: 16, // Phase 3.22.11: Slightly smaller
  },
});
