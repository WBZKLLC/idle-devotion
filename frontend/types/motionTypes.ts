// =============================================================================
// Motion Types - TypeScript definitions for Expo state dispatch
// CONSTRAINT: Types only - NO animation logic, NO profile parsing
// =============================================================================

/**
 * Motion state enum - MUST match Unity MotionState exactly
 * These are the ONLY valid state values
 */
export const MotionState = {
  IDLE: 'idle',
  COMBAT: 'combat',
  BANNER: 'banner',
  SUMMON: 'summon',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  DIALOGUE: 'dialogue',
  SPECIAL: 'special',
} as const;

export type MotionStateType = typeof MotionState[keyof typeof MotionState];

/**
 * Validate if a string is a valid motion state
 * Used to prevent invalid state dispatch
 */
export function isValidMotionState(state: string): state is MotionStateType {
  return Object.values(MotionState).includes(state as MotionStateType);
}

// =============================================================================
// Expo → Unity Message Types (Commands)
// CONSTRAINT: Minimal schema - state name + optional metadata ONLY
// =============================================================================

/**
 * Set motion state command
 * heroId, heroClass, rarity are METADATA for Unity's profile resolution
 * Expo does NOT use these for any logic
 */
export interface SetStateMessage {
  type: 'SET_STATE';
  state: MotionStateType;
  heroId?: string;
  heroClass?: string;
  rarity?: string;
}

/**
 * Set global intensity override
 * Range: 0.0 - 2.0
 */
export interface SetIntensityMessage {
  type: 'SET_INTENSITY';
  value: number;
}

/**
 * Set global speed override
 * Range: 0.1 - 3.0
 */
export interface SetSpeedMessage {
  type: 'SET_SPEED';
  value: number;
}

/**
 * Stop all motion
 */
export interface StopMotionMessage {
  type: 'STOP_MOTION';
}

/**
 * Reset to idle state
 */
export interface ResetToIdleMessage {
  type: 'RESET_TO_IDLE';
}

/**
 * Union type of all valid Expo → Unity messages
 * NO other message types are permitted
 */
export type ExpoToUnityMessage =
  | SetStateMessage
  | SetIntensityMessage
  | SetSpeedMessage
  | StopMotionMessage
  | ResetToIdleMessage;

// =============================================================================
// Unity → Expo Message Types (Status Only)
// CONSTRAINT: Status responses ONLY - NO parameter data
// =============================================================================

/**
 * State change confirmation from Unity
 */
export interface StateChangedMessage {
  type: 'STATE_CHANGED';
  state: MotionStateType;
  profileId: string;
}

/**
 * Blend transition complete notification
 */
export interface BlendCompleteMessage {
  type: 'BLEND_COMPLETE';
}

/**
 * Error from Unity
 */
export interface UnityErrorMessage {
  type: 'ERROR';
  message: string;
}

/**
 * Union type of all valid Unity → Expo messages
 * NO parameter data is ever sent to Expo
 */
export type UnityToExpoMessage =
  | StateChangedMessage
  | BlendCompleteMessage
  | UnityErrorMessage;

// =============================================================================
// Hero Metadata (for Unity profile resolution)
// CONSTRAINT: Expo passes this data but does NOT use it for profile selection
// =============================================================================

/**
 * Hero metadata passed to Unity for profile resolution
 * Expo does NOT resolve profiles - Unity does
 */
export interface HeroMetadata {
  heroId?: string;
  heroClass?: string;
  rarity?: string;
}

// =============================================================================
// Dispatcher Status
// =============================================================================

/**
 * Current dispatcher status
 */
export interface DispatcherStatus {
  isConnected: boolean;
  currentState: MotionStateType | null;
  lastProfileId: string | null;
  lastError: string | null;
}
