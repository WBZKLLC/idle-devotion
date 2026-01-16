// /app/frontend/components/ui/Toast.tsx
// Design system toast component for success/info/warning notifications

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, COLORS, PREMIUM_COLORS, SHADOW } from './tokens';

// =============================================================================
// TYPES
// =============================================================================
type ToastVariant = 'success' | 'info' | 'warning' | 'error' | 'premium';

export interface ToastConfig {
  id: string;
  message: string;
  variant?: ToastVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  duration?: number; // ms, default 3000, 0 = sticky
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastItemProps extends ToastConfig {
  onDismiss: (id: string) => void;
}

// =============================================================================
// VARIANT CONFIG
// =============================================================================
const VARIANT_CONFIG = {
  success: {
    bg: 'rgba(34, 197, 94, 0.95)',
    text: '#FFFFFF',
    icon: 'checkmark-circle' as const,
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.95)',
    text: '#FFFFFF',
    icon: 'information-circle' as const,
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.95)',
    text: '#FFFFFF',
    icon: 'warning' as const,
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.95)',
    text: '#FFFFFF',
    icon: 'alert-circle' as const,
  },
  premium: {
    bg: 'rgba(168, 85, 247, 0.95)',
    text: '#FFFFFF',
    icon: 'star' as const,
  },
};

// =============================================================================
// TOAST ITEM (Individual toast)
// =============================================================================
function ToastItem({
  id,
  message,
  variant = 'info',
  icon,
  duration = 3000,
  action,
  onDismiss,
}: ToastItemProps) {
  const config = VARIANT_CONFIG[variant];
  const iconName = icon || config.icon;
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
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
      onDismiss(id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        SHADOW.md,
        {
          backgroundColor: config.bg,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={iconName} size={20} color={config.text} style={styles.icon} />
        <Text style={[styles.message, { color: config.text }]} numberOfLines={2}>
          {message}
        </Text>
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} style={styles.actionButton}>
          <Text style={[styles.actionText, { color: config.text }]}>{action.label}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={dismiss} style={styles.dismissButton}>
        <Ionicons name="close" size={18} color={config.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// TOAST CONTAINER (Manages multiple toasts)
// =============================================================================
interface ToastContainerProps {
  toasts: ToastConfig[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        { top: insets.top + SPACING.sm },
      ]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

// =============================================================================
// TOAST STORE (Global state for toasts)
// =============================================================================
type ToastListener = (toasts: ToastConfig[]) => void;

class ToastStore {
  private toasts: ToastConfig[] = [];
  private listeners: Set<ToastListener> = new Set();
  private counter = 0;

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(config: Omit<ToastConfig, 'id'>) {
    const id = `toast-${++this.counter}-${Date.now()}`;
    const toast: ToastConfig = { id, ...config };
    this.toasts = [toast, ...this.toasts].slice(0, 3); // Max 3 toasts
    this.notify();
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  dismissAll() {
    this.toasts = [];
    this.notify();
  }
}

export const toastStore = new ToastStore();

// =============================================================================
// TOAST HOOK (For components to use)
// =============================================================================
export function useToast() {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  useEffect(() => {
    return toastStore.subscribe(setToasts);
  }, []);

  return {
    toasts,
    dismiss: (id: string) => toastStore.dismiss(id),
  };
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================
export const toast = {
  success: (message: string, options?: Partial<Omit<ToastConfig, 'id' | 'message' | 'variant'>>) =>
    toastStore.show({ message, variant: 'success', ...options }),

  info: (message: string, options?: Partial<Omit<ToastConfig, 'id' | 'message' | 'variant'>>) =>
    toastStore.show({ message, variant: 'info', ...options }),

  warning: (message: string, options?: Partial<Omit<ToastConfig, 'id' | 'message' | 'variant'>>) =>
    toastStore.show({ message, variant: 'warning', ...options }),

  error: (message: string, options?: Partial<Omit<ToastConfig, 'id' | 'message' | 'variant'>>) =>
    toastStore.show({ message, variant: 'error', ...options }),

  premium: (message: string, options?: Partial<Omit<ToastConfig, 'id' | 'message' | 'variant'>>) =>
    toastStore.show({ message, variant: 'premium', ...options }),

  dismiss: (id: string) => toastStore.dismiss(id),
  dismissAll: () => toastStore.dismissAll(),
};

// =============================================================================
// STYLES
// =============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    maxWidth: SCREEN_WIDTH - SPACING.md * 2,
    minWidth: 200,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  message: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  actionButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  actionText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    textDecorationLine: 'underline',
  },
  dismissButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
});
