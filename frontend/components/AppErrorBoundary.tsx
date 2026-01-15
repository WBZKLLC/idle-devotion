// /app/frontend/components/AppErrorBoundary.tsx
// Global error boundary - catches render crashes and provides recovery
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Sentry from 'sentry-expo';

interface State {
  hasError: boolean;
  message?: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: undefined };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Report to Sentry if available
    try {
      Sentry.Native.captureException(error, { 
        extra: { 
          componentStack: errorInfo?.componentStack 
        } 
      });
    } catch {}
    
    // Also log for debugging
    console.error('[AppErrorBoundary] Caught error:', error);
  }

  handleRestart = () => {
    this.setState({ hasError: false, message: undefined });
    try {
      router.replace('/');
    } catch {
      // If router fails, at least clear the error state
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Please restart the app. If this keeps happening, it will be reported automatically.
        </Text>
        {__DEV__ && this.state.message && (
          <Text style={styles.debug}>{this.state.message}</Text>
        )}
        <Pressable onPress={this.handleRestart} style={styles.button}>
          <Text style={styles.buttonText}>Restart App</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a1628',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  debug: {
    fontSize: 12,
    color: '#c9a227',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#c9a227',
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a1628',
  },
});
