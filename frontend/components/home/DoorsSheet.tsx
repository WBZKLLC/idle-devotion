// /app/frontend/components/home/DoorsSheet.tsx
// Phase 3.22.7.C: The "Doors" Sheet
//
// Contains all the "dashboard stuff" — QuickLinksGrid + pity progress.
// Opens from a single affordance (the "grid" button in the side rail).
// This lets the sanctuary stay clean while depth exists on demand.
//
// "The doors exist. You choose when to open them."

import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Platform, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '../../theme/colors';
import { RADIUS, SPACING, FONT_SIZE, INVITATION } from '../ui/tokens';
import { PRESS, haptic } from '../../lib/ui/interaction';
import { QuickLinksGrid, QuickLinkRow } from './QuickLinksGrid';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type PityData = {
  common: { current: number; max: number };
  premium: { current: number; max: number };
  divine: { current: number; max: number };
};

type Props = {
  visible: boolean;
  onClose: () => void;
  quickLinkRows: QuickLinkRow[];
  pityData: PityData;
  onAnyInteraction?: () => void;
};

/**
 * DoorsSheet — The full menu on demand
 * 
 * Contains QuickLinksGrid + pity tracking.
 * Opens as a bottom sheet / modal.
 */
export function DoorsSheet({ 
  visible, 
  onClose, 
  quickLinkRows, 
  pityData,
  onAnyInteraction,
}: Props) {
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        {/* Backdrop tap to close */}
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        {/* Sheet content - using SafeAreaView for proper inset handling on Android */}
        <View style={[
          styles.sheet, 
          { 
            paddingBottom: Math.max(insets.bottom, 16) + 16,
            marginBottom: Platform.OS === 'android' ? 0 : 0,
          }
        ]}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Doors</Text>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closePressed,
              ]}
              onPress={() => {
                haptic('light');
                onClose();
              }}
            >
              <Ionicons name="close" size={20} color={COLORS.cream.soft} />
            </Pressable>
          </View>
          
          <ScrollView 
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Links Grid */}
            <View style={styles.section}>
              <QuickLinksGrid 
                rows={quickLinkRows} 
                onAnyInteraction={onAnyInteraction}
              />
            </View>
            
            {/* Pity Tracking Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pity Progress</Text>
              <View style={styles.pityCard}>
                <PityRow 
                  label="Common" 
                  current={pityData.common.current} 
                  max={pityData.common.max}
                  color={COLORS.gold.light}
                />
                <PityRow 
                  label="Premium" 
                  current={pityData.premium.current} 
                  max={pityData.premium.max}
                  color="#9b4dca"
                />
                <PityRow 
                  label="Divine" 
                  current={pityData.divine.current} 
                  max={pityData.divine.max}
                  color={COLORS.gold.primary}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Single pity row
 */
function PityRow({ label, current, max, color }: { 
  label: string; 
  current: number; 
  max: number; 
  color: string;
}) {
  const percentage = Math.min((current / max) * 100, 100);
  
  return (
    <View style={styles.pityRow}>
      <View style={styles.pityInfo}>
        <Text style={styles.pityLabel}>{label}</Text>
        <Text style={styles.pityValue}>{current}/{max}</Text>
      </View>
      <View style={styles.pityBarOuter}>
        <View 
          style={[
            styles.pityBarFill, 
            { width: `${percentage}%`, backgroundColor: color }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: COLORS.navy.dark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Use explicit height on Android to avoid layout issues
    ...Platform.select({
      android: {
        height: SCREEN_HEIGHT * 0.75, // 75% of screen height
      },
      ios: {
        maxHeight: '85%',
      },
      web: {
        maxHeight: '85%',
      },
    }),
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cream.pure + '30',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '10',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.cream.pure,
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 8,
    borderRadius: RADIUS.md,
  },
  closePressed: {
    opacity: 0.6,
    backgroundColor: COLORS.cream.pure + '10',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: COLORS.cream.soft,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: INVITATION.dormant,
    marginBottom: SPACING.sm,
  },
  pityCard: {
    backgroundColor: COLORS.navy.darkest + '60',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: COLORS.cream.pure + '06',
  },
  pityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pityInfo: {
    width: 70,
  },
  pityLabel: {
    fontSize: 10,
    color: COLORS.cream.dark,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pityValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.cream.soft,
    opacity: 0.9,
  },
  pityBarOuter: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.navy.darkest + '80',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 10,
  },
  pityBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
