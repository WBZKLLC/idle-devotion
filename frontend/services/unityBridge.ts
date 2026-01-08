// =============================================================================
// unityBridge.ts
// Phase 6: Real Unity bridge wrapper for react-native-unity integration
// 
// CONSTRAINT: Does NOT modify motionStateDispatcher.ts - only provides bridge
// SECURITY: Implements S-1, S-3, S-5 security controls
// =============================================================================

import { motionStateDispatcher } from './motionStateDispatcher';

// Type for Unity message callback
type UnityMessageCallback = (message: string) => void;

// S-1: Session token for authentication
let sessionToken: string | null = null;
let isSessionEstablished = false;

// Bridge state
let isInitialized = false;
let unityModule: any = null;

// S-3: Rate limiting configuration
const RATE_LIMIT_MAX_MESSAGES = 10;
const RATE_LIMIT_WINDOW_MS = 1000;
const messageTimestamps: number[] = [];

// S-5: Debug mode flag (disable in production)
const DEBUG_MODE = __DEV__ ?? false;

/**
 * S-5: Debug-only logging
 */
function logDebug(message: string, ...args: any[]): void {
  if (DEBUG_MODE) {
    console.log(`[UnityBridge] ${message}`, ...args);
  }
}

/**
 * S-3: Check if message is within rate limit
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  
  // Remove timestamps outside the window
  while (messageTimestamps.length > 0 && now - messageTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    messageTimestamps.shift();
  }
  
  // Check if under limit
  if (messageTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    logDebug('Rate limit exceeded');
    return false;
  }
  
  // Record this message
  messageTimestamps.push(now);
  return true;
}

/**
 * Unity Bridge Configuration
 * 
 * This module provides the connection between the Expo motion dispatcher
 * and the Unity Live2D runtime via react-native-unity.
 * 
 * SECURITY CONTROLS:
 * - S-1: Session token handshake
 * - S-3: Rate limiting (10 msg/sec)
 * - S-5: Debug-only logging
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

        // S-3: Rate limiting check
        if (!checkRateLimit()) {
          console.warn('[UnityBridge] Rate limit exceeded, message dropped');
          return;
        }

        // S-1: Inject session token if established
        let messageToSend = jsonMessage;
        if (isSessionEstablished && sessionToken) {
          try {
            const parsed = JSON.parse(jsonMessage);
            parsed.sessionToken = sessionToken;
            messageToSend = JSON.stringify(parsed);
          } catch (e) {
            // If parsing fails, send original message
            logDebug('Failed to inject session token');
          }
        }

        try {
          // react-native-unity uses this format:
          // UnityModule.postMessage(gameObjectName, methodName, message)
          unityModule.postMessage(
            'ReactNativeUnity',  // GameObject name in Unity scene
            'ReceiveMessage',    // Method name on the script
            messageToSend        // JSON string payload
          );
          logDebug('Sent to Unity:', messageToSend);
        } catch (error) {
          console.error('[UnityBridge] Failed to send message:', error);
        }
      },
    };

    // Initialize the motion dispatcher with the real bridge
    motionStateDispatcher.initialize(bridge);
    isInitialized = true;
    logDebug('Initialized successfully');
  },

  /**
   * S-1: Perform handshake with Unity to establish session
   * @param token - Session token received from Unity
   */
  performHandshake: (token: string): void => {
    if (!unityModule) {
      console.error('[UnityBridge] Cannot handshake: Unity module not available');
      return;
    }

    sessionToken = token;
    
    const handshakeMessage = JSON.stringify({
      type: 'HANDSHAKE',
      sessionToken: token,
    });

    try {
      unityModule.postMessage('ReactNativeUnity', 'ReceiveMessage', handshakeMessage);
      logDebug('Handshake sent');
    } catch (error) {
      console.error('[UnityBridge] Handshake failed:', error);
    }
  },

  /**
   * Handle messages received from Unity.
   * Should be called from UnityView's onUnityMessage prop.
   * 
   * @param message - JSON string message from Unity
   */
  handleUnityMessage: (message: string): void => {
    logDebug('Received from Unity:', message);
    
    try {
      const parsed = JSON.parse(message);
      
      // S-1: Handle handshake confirmation
      if (parsed.type === 'HANDSHAKE_CONFIRMED') {
        isSessionEstablished = true;
        logDebug('Session established');
        return;
      }

      // S-1: Handle session token from Unity (for initial handshake)
      if (parsed.type === 'SESSION_TOKEN' && parsed.token) {
        UnityBridge.performHandshake(parsed.token);
        return;
      }
      
    } catch (e) {
      // Not valid JSON, let dispatcher handle
    }

    // Forward to dispatcher for normal message handling
    motionStateDispatcher.handleUnityMessage(message);
  },

  /**
   * Clean up the bridge connection.
   * Should be called when the UnityView unmounts.
   * S-6: Idempotent cleanup
   */
  cleanup: (): void => {
    if (isInitialized) {
      motionStateDispatcher.disconnect();
      unityModule = null;
      isInitialized = false;
      sessionToken = null;
      isSessionEstablished = false;
      messageTimestamps.length = 0; // Clear rate limit history
      logDebug('Cleaned up');
    }
  },

  /**
   * Check if the bridge is initialized.
   */
  isReady: (): boolean => {
    return isInitialized && unityModule !== null;
  },

  /**
   * S-1: Check if session is established
   */
  isSessionValid: (): boolean => {
    return isSessionEstablished && sessionToken !== null;
  },

  /**
   * Get bridge status for debugging
   */
  getStatus: () => ({
    isInitialized,
    isSessionEstablished,
    hasUnityModule: unityModule !== null,
    messageQueueLength: messageTimestamps.length,
  }),
};

export default UnityBridge;
