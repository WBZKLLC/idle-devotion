// =============================================================================
// unityBridge.ts
// Phase 6: Real Unity bridge wrapper for react-native-unity integration
// 
// CONSTRAINT: Does NOT modify motionStateDispatcher.ts - only provides bridge
// =============================================================================

import { motionStateDispatcher } from './motionStateDispatcher';

// Type for Unity message callback
type UnityMessageCallback = (message: string) => void;

// Bridge state
let isInitialized = false;
let unityModule: any = null;

/**
 * Unity Bridge Configuration
 * 
 * This module provides the connection between the Expo motion dispatcher
 * and the Unity Live2D runtime via react-native-unity.
 */
export const UnityBridge = {
  /**
   * Initialize the Unity bridge.
   * Must be called after the UnityView is mounted and Unity is ready.
   * 
   * @param unityModuleRef - Reference to the UnityModule from react-native-unity
   */
  initialize: (unityModuleRef: any): void => {
    if (isInitialized) {
      console.warn('[UnityBridge] Already initialized');
      return;
    }

    unityModule = unityModuleRef;

    // Create bridge interface matching dispatcher expectations
    const bridge = {
      postMessage: (jsonMessage: string): void => {
        if (!unityModule) {
          console.error('[UnityBridge] Unity module not available');
          return;
        }

        try {
          // react-native-unity uses this format:
          // UnityModule.postMessage(gameObjectName, methodName, message)
          unityModule.postMessage(
            'ReactNativeUnity',  // GameObject name in Unity scene
            'ReceiveMessage',    // Method name on the script
            jsonMessage          // JSON string payload
          );
          console.log('[UnityBridge] Sent to Unity:', jsonMessage);
        } catch (error) {
          console.error('[UnityBridge] Failed to send message:', error);
        }
      },
    };

    // Initialize the motion dispatcher with the real bridge
    motionStateDispatcher.initialize(bridge);
    isInitialized = true;
    console.log('[UnityBridge] Initialized successfully');
  },

  /**
   * Handle messages received from Unity.
   * Should be called from UnityView's onUnityMessage prop.
   * 
   * @param message - JSON string message from Unity
   */
  handleUnityMessage: (message: string): void => {
    console.log('[UnityBridge] Received from Unity:', message);
    motionStateDispatcher.handleUnityMessage(message);
  },

  /**
   * Clean up the bridge connection.
   * Should be called when the UnityView unmounts.
   */
  cleanup: (): void => {
    if (isInitialized) {
      motionStateDispatcher.disconnect();
      unityModule = null;
      isInitialized = false;
      console.log('[UnityBridge] Cleaned up');
    }
  },

  /**
   * Check if the bridge is initialized.
   */
  isReady: (): boolean => {
    return isInitialized && unityModule !== null;
  },
};

export default UnityBridge;
