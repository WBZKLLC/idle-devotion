// =============================================================================
// Motion State Dispatcher Service
// CONSTRAINT: State dispatch ONLY - NO animation, NO interpolation, NO easing
// =============================================================================

import {
  MotionStateType,
  ExpoToUnityMessage,
  UnityToExpoMessage,
  HeroMetadata,
  DispatcherStatus,
  isValidMotionState,
} from '../types/motionTypes';
import { MotionState, INTENSITY_BOUNDS, SPEED_BOUNDS } from '../constants/motionStates';

/**
 * Callback type for Unity messages
 */
type UnityMessageCallback = (message: UnityToExpoMessage) => void;

/**
 * Motion State Dispatcher
 * 
 * RESPONSIBILITIES:
 * - Send state commands to Unity
 * - Receive status updates from Unity
 * - Validate state values before dispatch
 * 
 * PROHIBITED:
 * - Animation logic
 * - Interpolation
 * - Easing
 * - Profile parsing
 * - Parameter manipulation
 * - Profile resolution
 */
class MotionStateDispatcherService {
  private isConnected: boolean = false;
  private currentState: MotionStateType | null = null;
  private lastProfileId: string | null = null;
  private lastError: string | null = null;
  private messageCallbacks: Set<UnityMessageCallback> = new Set();

  // Unity bridge reference (set when Unity module is available)
  private unityBridge: {
    postMessage: (message: string) => void;
  } | null = null;

  /**
   * Initialize the dispatcher with Unity bridge
   * Called when Unity module becomes available
   */
  initialize(bridge: { postMessage: (message: string) => void }): void {
    this.unityBridge = bridge;
    this.isConnected = true;
    console.log('[MotionDispatcher] Initialized with Unity bridge');
  }

  /**
   * Disconnect from Unity
   */
  disconnect(): void {
    this.unityBridge = null;
    this.isConnected = false;
    this.currentState = null;
    this.lastProfileId = null;
    console.log('[MotionDispatcher] Disconnected');
  }

  /**
   * Get current dispatcher status
   */
  getStatus(): DispatcherStatus {
    return {
      isConnected: this.isConnected,
      currentState: this.currentState,
      lastProfileId: this.lastProfileId,
      lastError: this.lastError,
    };
  }

  // ===========================================================================
  // STATE DISPATCH METHODS
  // These are the ONLY methods that send commands to Unity
  // ===========================================================================

  /**
   * Set motion state
   * This is the PRIMARY interface for triggering state changes
   * 
   * @param state - Target motion state (MUST be valid MotionStateType)
   * @param metadata - Optional hero metadata for Unity's profile resolution
   */
  setState(state: MotionStateType, metadata?: HeroMetadata): boolean {
    // Validate state
    if (!isValidMotionState(state)) {
      this.lastError = `Invalid motion state: ${state}`;
      console.error(`[MotionDispatcher] ${this.lastError}`);
      return false;
    }

    // Dispatch command
    const message: ExpoToUnityMessage = {
      type: 'SET_STATE',
      state,
      ...metadata,
    };

    return this.dispatch(message);
  }

  /**
   * Set global intensity override
   * 
   * @param value - Intensity value (0.0 - 2.0)
   */
  setIntensity(value: number): boolean {
    // Clamp to valid range (Unity enforces, but we validate)
    const clampedValue = Math.max(
      INTENSITY_BOUNDS.MIN,
      Math.min(INTENSITY_BOUNDS.MAX, value)
    );

    if (clampedValue !== value) {
      console.warn(`[MotionDispatcher] Intensity ${value} clamped to ${clampedValue}`);
    }

    const message: ExpoToUnityMessage = {
      type: 'SET_INTENSITY',
      value: clampedValue,
    };

    return this.dispatch(message);
  }

  /**
   * Set global speed override
   * 
   * @param value - Speed value (0.1 - 3.0)
   */
  setSpeed(value: number): boolean {
    // Clamp to valid range (Unity enforces, but we validate)
    const clampedValue = Math.max(
      SPEED_BOUNDS.MIN,
      Math.min(SPEED_BOUNDS.MAX, value)
    );

    if (clampedValue !== value) {
      console.warn(`[MotionDispatcher] Speed ${value} clamped to ${clampedValue}`);
    }

    const message: ExpoToUnityMessage = {
      type: 'SET_SPEED',
      value: clampedValue,
    };

    return this.dispatch(message);
  }

  /**
   * Stop all motion
   */
  stopMotion(): boolean {
    const message: ExpoToUnityMessage = {
      type: 'STOP_MOTION',
    };

    return this.dispatch(message);
  }

  /**
   * Reset to idle state
   */
  resetToIdle(): boolean {
    const message: ExpoToUnityMessage = {
      type: 'RESET_TO_IDLE',
    };

    return this.dispatch(message);
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // Shortcuts for common state transitions
  // ===========================================================================

  enterIdle(metadata?: HeroMetadata): boolean {
    return this.setState(MotionState.IDLE, metadata);
  }

  enterCombat(metadata?: HeroMetadata): boolean {
    return this.setState(MotionState.COMBAT, metadata);
  }

  enterBanner(metadata?: HeroMetadata): boolean {
    return this.setState(MotionState.BANNER, metadata);
  }

  enterSummon(metadata?: HeroMetadata): boolean {
    return this.setState(MotionState.SUMMON, metadata);
  }

  enterVictory(metadata?: HeroMetadata): boolean {
    return this.setState(MotionState.VICTORY, metadata);
  }

  enterDefeat(metadata?: HeroMetadata): boolean {
    return this.setState(MotionState.DEFEAT, metadata);
  }

  enterDialogue(metadata?: HeroMetadata): boolean {
    return this.setState(MotionState.DIALOGUE, metadata);
  }

  // ===========================================================================
  // MESSAGE HANDLING
  // ===========================================================================

  /**
   * Dispatch message to Unity
   * This is the ONLY method that sends data to Unity
   */
  private dispatch(message: ExpoToUnityMessage): boolean {
    if (!this.isConnected || !this.unityBridge) {
      this.lastError = 'Unity bridge not connected';
      console.warn(`[MotionDispatcher] Cannot dispatch: ${this.lastError}`);
      return false;
    }

    try {
      // Serialize and send
      const jsonMessage = JSON.stringify(message);
      this.unityBridge.postMessage(jsonMessage);
      
      console.log(`[MotionDispatcher] Dispatched: ${message.type}`, message);
      this.lastError = null;
      return true;
    } catch (error) {
      this.lastError = `Dispatch failed: ${error}`;
      console.error(`[MotionDispatcher] ${this.lastError}`);
      return false;
    }
  }

  /**
   * Handle message from Unity
   * Called by the Unity bridge when status updates arrive
   */
  handleUnityMessage(jsonMessage: string): void {
    try {
      const message: UnityToExpoMessage = JSON.parse(jsonMessage);

      switch (message.type) {
        case 'STATE_CHANGED':
          this.currentState = message.state;
          this.lastProfileId = message.profileId;
          console.log(`[MotionDispatcher] State changed: ${message.state} (profile: ${message.profileId})`);
          break;

        case 'BLEND_COMPLETE':
          console.log('[MotionDispatcher] Blend complete');
          break;

        case 'ERROR':
          this.lastError = message.message;
          console.error(`[MotionDispatcher] Unity error: ${message.message}`);
          break;
      }

      // Notify callbacks
      this.messageCallbacks.forEach(callback => callback(message));
    } catch (error) {
      console.error('[MotionDispatcher] Failed to parse Unity message:', error);
    }
  }

  /**
   * Subscribe to Unity messages
   */
  subscribe(callback: UnityMessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }
}

// Singleton instance
export const motionStateDispatcher = new MotionStateDispatcherService();

// Export class for testing
export { MotionStateDispatcherService };
