// /app/frontend/components/gacha/InsufficientFundsModal.tsx
// Phase 3.35: Insufficient Funds Modal
//
// Displays when user cannot afford a summon.
// Clean modal with:
// - "Not enough {currency}" message
// - Primary: "Go to Shop"
// - Secondary: "Cancel"
// No hidden redirects.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { track, Events } from '../../lib/telemetry/events';
import { haptic } from '../../lib/ui/interaction';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845' },
  gold: { dark: '#b8860b', primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0' },
  red: { primary: '#e74c3c', light: '#ff6b6b' },
};

interface InsufficientFundsModalProps {
  visible: boolean;
  onClose: () => void;
  currency: string;
  required: number;
  available: number;
  deficit: number;
}

export function InsufficientFundsModal({
  visible,
  onClose,
  currency,
  required,
  available,
  deficit,
}: InsufficientFundsModalProps) {
  const handleGoToShop = () => {
    haptic('selection');
    track(Events.GACHA_INSUFFICIENT_FUNDS, {
      action: 'go_to_shop',
      currency,
      deficit,
    });
    onClose();
    router.push('/shop');
  };
  
  const handleCancel = () => {
    haptic('selection');
    track(Events.GACHA_INSUFFICIENT_FUNDS, {
      action: 'cancel',
      currency,
      deficit,
    });
    onClose();
  };
  
  const getCurrencyIcon = (curr: string): string => {
    if (curr === 'coins') return '💰';
    if (curr === 'crystals') return '💎';
    if (curr === 'divine_essence') return '✨';
    return '💎';
  };
  
  const getCurrencyDisplayName = (curr: string): string => {
    if (curr === 'coins') return 'Coins';
    if (curr === 'crystals') return 'Crystals';
    if (curr === 'divine_essence') return 'Divine Essence';
    return curr;
  };
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{getCurrencyIcon(currency)}</Text>
            <View style={styles.iconBadge}>
              <Ionicons name="close" size={16} color={COLORS.red.primary} />
            </View>
          </View>
          
          {/* Title */}
          <Text style={styles.title}>Not Enough {getCurrencyDisplayName(currency)}</Text>
          
          {/* Details */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Required</Text>
              <Text style={styles.detailValue}>{required.toLocaleString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Available</Text>
              <Text style={styles.detailValue}>{available.toLocaleString()}</Text>
            </View>
            <View style={[styles.detailRow, styles.deficitRow]}>
              <Text style={styles.deficitLabel}>Need</Text>
              <Text style={styles.deficitValue}>+{deficit.toLocaleString()}</Text>
            </View>
          </View>
          
          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleGoToShop}
            >
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.primaryButtonGradient}
              >
                <Ionicons name="cart" size={18} color={COLORS.navy.darkest} />
                <Text style={styles.primaryButtonText}>Go to Shop</Text>
              </LinearGradient>
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleCancel}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.red.primary + '40',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.navy.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
  },
  iconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.navy.dark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.red.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream.pure,
    textAlign: 'center',
    marginBottom: 16,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: COLORS.navy.primary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.cream.soft,
  },
  deficitRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 6,
    paddingTop: 12,
  },
  deficitLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.red.light,
  },
  deficitValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.red.light,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy.darkest,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

export default InsufficientFundsModal;
