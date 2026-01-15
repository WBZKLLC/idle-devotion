// /app/frontend/components/ui/Toast.tsx
// Toast notification component for non-blocking feedback

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, FONT_SIZE, PREMIUM_COLORS } from './tokens';

type ToastVariant = 'success' | 'error' | 'info' | 'premium';

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const VARIANT_CONFIG = {
  success: {
    bg: PREMIUM_COLORS.green,
    icon: 'checkmark-circle' as const,
  },
  error: {
    bg: '#EF4444',
    icon: 'alert-circle' as const,
  },
  info: {
    bg: '#3B82F6',
    icon: 'information-circle' as const,
  },
  premium: {
    bg: PREMIUM_COLORS.gold,
    icon: 'star' as const,
  },
};

export function Toast({
  visible,
  message,
  variant = 'info',
  duration = 3000,
  onDismiss,
  action,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = VARIANT_CONFIG[variant];

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [visible, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.bg, transform: [{ translateY }], opacity },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={config.icon} size={20} color="white" />
        <Text style={styles.message}>{message}</Text>
      </View>
      <View style={styles.actions}>
        {action && (
          <TouchableOpacity
            onPress={() => {
              action.onPress();
              handleDismiss();
            }}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    color: 'white',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginLeft: SPACING.sm,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.sm,
  },
  actionText: {
    color: 'white',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
});
