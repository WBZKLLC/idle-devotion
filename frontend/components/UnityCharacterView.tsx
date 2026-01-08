// =============================================================================
// UnityCharacterView.tsx
// Phase 6: React Native component wrapping the Unity Live2D view
// 
// This component integrates react-native-unity into the Expo app.
// =============================================================================

import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { UnityBridge } from '../services/unityBridge';

// Conditional import - react-native-unity only works in native builds
let UnityView: any = null;
let UnityModule: any = null;

try {
  // This will fail in Expo Go but work in development builds
  const unityPackage = require('@azesmway/react-native-unity');
  UnityView = unityPackage.default || unityPackage.UnityView;
  UnityModule = unityPackage.UnityModule;
} catch (error) {
  console.log('[UnityCharacterView] react-native-unity not available (expected in Expo Go)');
}

interface UnityCharacterViewProps {
  style?: object;
  onReady?: () => void;
  onError?: (error: string) => void;
}

/**
 * UnityCharacterView Component
 * 
 * Wraps the Unity Live2D view and handles bridge initialization.
 * 
 * RESPONSIBILITIES:
 * - Mount Unity view
 * - Initialize bridge when Unity is ready
 * - Forward Unity messages to dispatcher
 * - Clean up on unmount
 * 
 * PROHIBITED:
 * - Animation logic
 * - Profile loading
 * - Parameter manipulation
 */
export function UnityCharacterView({ 
  style, 
  onReady, 
  onError 
}: UnityCharacterViewProps) {
  const unityRef = useRef<any>(null);

  // Handle Unity messages
  const handleUnityMessage = useCallback((message: string) => {
    console.log('[UnityCharacterView] Unity message:', message);
    UnityBridge.handleUnityMessage(message);

    // Check for ready signal
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'STATE_CHANGED' && parsed.profileId === 'unity_ready') {
        console.log('[UnityCharacterView] Unity is ready');
        onReady?.();
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }, [onReady]);

  // Initialize bridge when component mounts
  useEffect(() => {
    if (UnityModule) {
      // Small delay to ensure Unity is fully loaded
      const timer = setTimeout(() => {
        try {
          UnityBridge.initialize(UnityModule);
          console.log('[UnityCharacterView] Bridge initialized');
        } catch (error) {
          console.error('[UnityCharacterView] Bridge initialization failed:', error);
          onError?.(`Bridge initialization failed: ${error}`);
        }
      }, 1000);

      return () => {
        clearTimeout(timer);
        UnityBridge.cleanup();
      };
    }
  }, [onError]);

  // Fallback for Expo Go or when Unity is not available
  if (!UnityView) {
    return (
      <View style={[styles.container, styles.fallback, style]}>
        <Text style={styles.fallbackText}>Unity View</Text>
        <Text style={styles.fallbackSubtext}>
          {Platform.OS === 'web' 
            ? 'Unity not supported on web'
            : 'Requires development build with Unity'
          }
        </Text>
        <Text style={styles.fallbackNote}>
          Run with EAS Build to enable Live2D
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <UnityView
        ref={unityRef}
        style={styles.unityView}
        onUnityMessage={handleUnityMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  unityView: {
    flex: 1,
  },
  fallback: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#8B5CF6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fallbackSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  fallbackNote: {
    color: '#444',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default UnityCharacterView;
