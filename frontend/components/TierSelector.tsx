import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DisplayTier } from '../lib/tier';

const TIER_LABELS: { tier: DisplayTier; label: string }[] = [
  { tier: 1, label: '1★' },
  { tier: 2, label: '2★' },
  { tier: 3, label: '3★' },
  { tier: 4, label: '4★' },
  { tier: 5, label: '5★' },
  { tier: 6, label: '5★+' },
];

type Props = {
  value: DisplayTier;
  maxUnlocked: DisplayTier;
  onChange: (t: DisplayTier) => void;
  hint?: boolean;
  compact?: boolean;
};

export default function TierSelector({ value, maxUnlocked, onChange, hint = true, compact = false }: Props) {
  const [rowW, setRowW] = useState(0);

  const underlineX = useRef(new Animated.Value(0)).current;
  const underlineOpacity = useRef(new Animated.Value(0)).current;

  const idx = useMemo(() => TIER_LABELS.findIndex(t => t.tier === value), [value]);
  const chipW = useMemo(() => (rowW > 0 ? rowW / TIER_LABELS.length : 0), [rowW]);

  useEffect(() => {
    if (!rowW || chipW <= 0 || idx < 0) return;

    Animated.parallel([
      Animated.timing(underlineOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(underlineX, { toValue: idx * chipW, useNativeDriver: true, speed: 22, bounciness: 10 }),
    ]).start();
  }, [rowW, chipW, idx, underlineX, underlineOpacity]);

  return (
    <View style={styles.wrap}>
      <View style={styles.rowHeader}>
        <Text style={[styles.label, compact && styles.labelCompact]}>Display Tier</Text>
        {hint && (
          <Text style={[styles.hint, compact && styles.hintCompact]}>
            Unlocked: {TIER_LABELS.find(t => t.tier === maxUnlocked)?.label}
          </Text>
        )}
      </View>

      <View
        style={[styles.rowOuter, compact && styles.rowOuterCompact]}
        onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
      >
        {/* Animated underline */}
        {rowW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.underline,
              compact && styles.underlineCompact,
              {
                width: Math.max(1, chipW),
                transform: [{ translateX: underlineX }],
                opacity: underlineOpacity,
              },
            ]}
          />
        )}

        {/* Chips */}
        <ScrollView horizontal={false} scrollEnabled={false} contentContainerStyle={styles.row}>
          {TIER_LABELS.map(({ tier, label }) => {
            const locked = tier > maxUnlocked;
            const active = tier === value;

            return (
              <TierChip
                key={tier}
                tier={tier}
                label={label}
                active={active}
                locked={locked}
                compact={compact}
                chipW={chipW}
                onPress={() => !locked && onChange(tier)}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// Separate component to properly use hooks
function TierChip({ 
  tier, 
  label, 
  active, 
  locked, 
  compact, 
  chipW, 
  onPress 
}: { 
  tier: DisplayTier; 
  label: string; 
  active: boolean; 
  locked: boolean; 
  compact: boolean; 
  chipW: number; 
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (locked) return;
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={{ width: chipW || undefined, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.chip,
          compact && styles.chipCompact,
          active && styles.chipActive,
          locked && styles.chipLocked,
        ]}
      >
        <Text
          style={[
            styles.chipText,
            compact && styles.chipTextCompact,
            active && styles.chipTextActive,
            locked && styles.chipTextLocked,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 8 },
  rowHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '900' },
  hint: { color: 'rgba(255,255,255,0.40)', fontSize: 11, fontWeight: '800' },

  rowOuter: {
    position: 'relative',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },

  underline: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 215, 140, 0.22)',
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.35)',
  },

  chip: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  chipActive: {},
  chipLocked: { opacity: 0.35 },

  chipText: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: 'rgba(255, 215, 140, 0.92)' },
  chipTextLocked: { color: 'rgba(255,255,255,0.55)' },

  // Compact mode (Hero Detail)
  labelCompact: { fontSize: 11 },
  hintCompact: { fontSize: 10 },
  rowOuterCompact: { borderRadius: 16 },
  underlineCompact: {},
  chipCompact: { paddingVertical: 8 },
  chipTextCompact: { fontSize: 11 },
});
