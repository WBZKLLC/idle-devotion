// /app/frontend/components/ui/ToastProvider.tsx
// Provider component that renders toasts at the app root level

import React from 'react';
import { ToastContainer, useToast } from './Toast';

/**
 * ToastProvider - Renders the toast container at the app level
 * 
 * Usage:
 * 1. Wrap your app root with this provider (in _layout.tsx)
 * 2. Use `toast.success()`, `toast.error()`, etc. anywhere in your app
 * 
 * Example:
 * ```tsx
 * // In _layout.tsx
 * import { ToastProvider } from '../components/ui/ToastProvider';
 * 
 * export default function RootLayout() {
 *   return (
 *     <>
 *       <Stack />
 *       <ToastProvider />
 *     </>
 *   );
 * }
 * 
 * // Anywhere in your app
 * import { toast } from '../components/ui/Toast';
 * 
 * toast.success('Purchase complete!');
 * toast.premium('Premium unlocked!');
 * ```
 */
export function ToastProvider() {
  const { toasts, dismiss } = useToast();

  return <ToastContainer toasts={toasts} onDismiss={dismiss} />;
}
