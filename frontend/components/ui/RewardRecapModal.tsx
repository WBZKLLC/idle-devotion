// /app/frontend/components/ui/RewardRecapModal.tsx
// Phase 3.19.9: Unified in-app reward recap modal (replaces blocking Alert.alert)
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryButton } from './PrimaryButton';
import COLORS from '../../theme/colors';

export type RewardRecapData = {
  title: string;
  message: string;
  tone?: 'gold' | 'purple' | 'green' | 'blue';
  buttonText?: string;
};

type Props = {
  visible: boolean;
  data: RewardRecapData | null;
  onClose: () => void;
};

const TONE_GRADIENTS: Record<string, [string, string]> = {
  gold: [COLORS.navy.primary, COLORS.navy.dark],
  purple: ['#2b1b4d', '#12152a'],
  green: ['#1a3d2e', '#0f1f18'],
  blue: ['#1a2d4d', '#0f1825'],
};

export function RewardRecapModal({ visible, data, onClose }: Props) {
  const tone = data?.tone || 'gold';
  const gradientColors = TONE_GRADIENTS[tone] || TONE_GRADIENTS.gold;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => { /* swallow */ }}>
          <LinearGradient colors={gradientColors} style={styles.cardInner}>
            <Text style={styles.title}>{data?.title}</Text>
            <Text style={styles.message}>{data?.message}</Text>

            <View style={{ height: 12 }} />

            <PrimaryButton 
              title={data?.buttonText || 'Continue'} 
              onPress={onClose} 
            />
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.cream.pure,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.cream.soft,
  },
});

export default RewardRecapModal;
