// =============================================================================
// unityBridge.ts
// Phase 6: Real Unity bridge wrapper for react-native-unity integration
// 
// CONSTRAINT: Does NOT modify motionStateDispatcher.ts - only provides bridge
// SECURITY: Implements S-1, S-3, S-5, F16 security controls
// =============================================================================

import { motionStateDispatcher } from './motionStateDispatcher';

// S-1/F16: Session token for authentication (in-memory ONLY)
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

// F16: Track if initialization error has been logged (prevent spam)
let initErrorLogged = false;

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
 * F16: Validate session before allowing command dispatch
 * Returns true if session is valid, false otherwise
 */
function validateSessionForCommand(): boolean {
  if (!isSessionEstablished || !sessionToken) {
    // F16: Log error only once to prevent spam
    if (!initErrorLogged) {
      console.error(
        '[UnityBridge] F16 VIOLATION BLOCKED: Cannot send commands before SESSION_READY received. ' +
        'Wait for Unity to send SESSION_READY message before dispatching commands.'
      );
      initErrorLogged = true;
    }
    return false;
  }
  return true;
}

/**
 * Unity Bridge Configuration
 * 
 * This module provides the connection between the Expo motion dispatcher
 * and the Unity Live2D runtime via react-native-unity.
 * 
 * SECURITY CONTROLS:
 * - S-1: Session token handshake (token stored in-memory only)
 * - S-3: Rate limiting (10 msg/sec)
 * - S-5: Debug-only logging
 * - F16: Commands blocked until SESSION_READY received
 */
export const UnityBridge = {
  /**
   * Initialize the Unity bridge.
   * Must be called after the UnityView is mounted and Unity is ready.
   * 
   * NOTE: This does NOT enable command sending. Commands are blocked until
   * SESSION_READY message is received from Unity (F16 enforcement).
   * 
   * @param unityModuleRef - Reference to the UnityModule from react-native-unity
   */
  initialize: (unityModuleRef: any): void => {
    if (isInitialized) {
      console.warn('[UnityBridge] Already initialized');
      return;
    }

    unityModule = unityModuleRef;
    initErrorLogged = false; // Reset error logging on re-init

    // Create bridge interface matching dispatcher expectations
    // F16: This bridge will block commands until session is established
    const bridge = {
      postMessage: (jsonMessage: string): void => {
        if (!unityModule) {
          console.error('[UnityBridge] Unity module not available');
          return;
        }

        // F16: Block all commands until session is established
        if (!validateSessionForCommand()) {
          return;
        }

        // S-3: Rate limiting check
        if (!checkRateLimit()) {
          console.warn('[UnityBridge] Rate limit exceeded, message dropped');
          return;
        }

        // S-1: Inject session token into message
        let messageToSend = jsonMessage;
        try {
          const parsed = JSON.parse(jsonMessage);
          parsed.sessionToken = sessionToken;
          messageToSend = JSON.stringify(parsed);
        } catch (e) {
          logDebug('Failed to inject session token');
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
    logDebug('Initialized - waiting for SESSION_READY from Unity');
  },

  /**
   * Handle messages received from Unity.
   * Should be called from UnityView's onUnityMessage prop.
   * 
   * SECURITY: Handles SESSION_READY to establish session (F16)
   * 
   * @param message - JSON string message from Unity
   */
  handleUnityMessage: (message: string): void => {
    logDebug('Received from Unity:', message);
    
    try {
      const parsed = JSON.parse(message);
      
      // S-1/F16: Handle SESSION_READY - this enables command sending
      if (parsed.type === 'SESSION_READY' && parsed.sessionToken) {
        sessionToken = parsed.sessionToken; // Store in-memory ONLY
        isSessionEstablished = true;
        initErrorLogged = false; // Clear error flag
        
        console.log('[UnityBridge] SESSION_READY received - commands now enabled');
        logDebug(`Token received: ${parsed.sessionToken.substring(0, 8)}...`);
        
        // Perform handshake to confirm receipt
        UnityBridge.performHandshake(parsed.sessionToken);
        return;
      }

      // S-1: Handle handshake confirmation
      if (parsed.type === 'HANDSHAKE_CONFIRMED') {
        logDebug('Handshake confirmed by Unity');
        return;
      }
      
    } catch (e) {
      // Not valid JSON, let dispatcher handle
    }

    // Forward to dispatcher for normal message handling
    motionStateDispatcher.handleUnityMessage(message);
  },

  /**
   * S-1: Perform handshake with Unity to confirm session
   * Called automatically when SESSION_READY is received
   * @param token - Session token received from Unity
   */
  performHandshake: (token: string): void => {
    if (!unityModule) {
      console.error('[UnityBridge] Cannot handshake: Unity module not available');
      return;
    }

    const handshakeMessage = JSON.stringify({
      type: 'HANDSHAKE',
      sessionToken: token,
    });

    try {
      // Bypass normal postMessage to avoid F16 check for handshake
      unityModule.postMessage('ReactNativeUnity', 'ReceiveMessage', handshakeMessage);
      logDebug('Handshake sent');
    } catch (error) {
      console.error('[UnityBridge] Handshake failed:', error);
    }
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
      
      // S-1: Clear session token from memory
      sessionToken = null;
      isSessionEstablished = false;
      initErrorLogged = false;
      
      // Clear rate limit history
      messageTimestamps.length = 0;
      
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
   * F16: Check if session is established (commands enabled)
   */
  isSessionValid: (): boolean => {
    return isSessionEstablished && sessionToken !== null;
  },

  /**
   * Check if commands can be sent (bridge ready AND session valid)
   */
  canSendCommands: (): boolean => {
    return isInitialized && unityModule !== null && isSessionEstablished && sessionToken !== null;
  },

  /**
   * Get bridge status for debugging
   */
  getStatus: () => ({
    isInitialized,
    isSessionEstablished,
    hasUnityModule: unityModule !== null,
    hasSessionToken: sessionToken !== null,
    messageQueueLength: messageTimestamps.length,
  }),
};

export default UnityBridge;
