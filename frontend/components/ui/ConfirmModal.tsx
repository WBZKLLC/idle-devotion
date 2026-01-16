// /app/frontend/components/ui/ConfirmModal.tsx
// Phase 3.19.10: Unified in-app confirmation modal (replaces blocking Alert.alert)
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';

export type ConfirmTone = 'neutral' | 'danger' | 'premium';

export type ConfirmModalData = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel?: () => void;
};

type Props = {
  visible: boolean;
  data: ConfirmModalData | null;
  onClose: () => void;
  busy?: boolean;
};

const TONE_CONFIG: Record<ConfirmTone, {
  gradient: [string, string];
  confirmBg: string;
  confirmText: string;
  iconColor: string;
}> = {
  neutral: {
    gradient: [COLORS.navy.primary, COLORS.navy.dark],
    confirmBg: COLORS.gold.primary,
    confirmText: COLORS.navy.darkest,
    iconColor: COLORS.cream.soft,
  },
  danger: {
    gradient: ['#2d1a1a', '#1a0f0f'],
    confirmBg: '#dc2626',
    confirmText: '#ffffff',
    iconColor: '#f87171',
  },
  premium: {
    gradient: ['#2b1b4d', '#12152a'],
    confirmBg: '#8b5cf6',
    confirmText: '#ffffff',
    iconColor: '#a78bfa',
  },
};

export function ConfirmModal({ visible, data, onClose, busy = false }: Props) {
  const tone = data?.tone || 'neutral';
  const config = TONE_CONFIG[tone];

  const handleConfirm = () => {
    if (busy) return;
    data?.onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (busy) return;
    data?.onCancel?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        <Pressable style={styles.card} onPress={() => { /* swallow */ }}>
          <LinearGradient colors={config.gradient} style={styles.cardInner}>
            {/* Icon (optional) */}
            {data?.icon && (
              <View style={styles.iconContainer}>
                <Ionicons name={data.icon} size={32} color={config.iconColor} />
              </View>
            )}

            {/* Title */}
            <Text style={styles.title}>{data?.title}</Text>

            {/* Message (optional) */}
            {data?.message && (
              <Text style={styles.message}>{data.message}</Text>
            )}

            {/* Button row */}
            <View style={styles.buttonRow}>
              {/* Cancel button (left for danger, secondary style) */}
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={busy}
              >
                <Text style={styles.cancelButtonText}>
                  {data?.cancelText || 'Cancel'}
                </Text>
              </Pressable>

              {/* Confirm button (right, primary style based on tone) */}
              <Pressable
                style={[
                  styles.button,
                  styles.confirmButton,
                  { backgroundColor: config.confirmBg },
                  busy && styles.buttonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={config.confirmText} />
                ) : (
                  <Text style={[styles.confirmButtonText, { color: config.confirmText }]}>
                    {data?.confirmText || 'Confirm'}
                  </Text>
                )}
              </Pressable>
            </View>
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
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.cream.pure,
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.cream.soft,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.cream.soft,
  },
  confirmButton: {
    // backgroundColor set dynamically by tone
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ConfirmModal;
