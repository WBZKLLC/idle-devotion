// =============================================================================
// Motion State Constants
// CONSTRAINT: Constants only - NO logic, NO animation
// =============================================================================

import { MotionState, MotionStateType } from '../types/motionTypes';

/**
 * Re-export MotionState for convenience
 */
export { MotionState };
export type { MotionStateType };

/**
 * Default state when no state is specified
 */
export const DEFAULT_MOTION_STATE: MotionStateType = MotionState.IDLE;

/**
 * States that are typically looping
 */
export const LOOPING_STATES: readonly MotionStateType[] = [
  MotionState.IDLE,
  MotionState.COMBAT,
  MotionState.SUMMON,
  MotionState.DIALOGUE,
] as const;

/**
 * States that are typically one-shot (non-looping)
 */
export const ONE_SHOT_STATES: readonly MotionStateType[] = [
  MotionState.BANNER,
  MotionState.VICTORY,
  MotionState.DEFEAT,
] as const;

/**
 * Intensity bounds (for validation)
 * NOTE: These are hints - Unity enforces actual bounds
 */
export const INTENSITY_BOUNDS = {
  MIN: 0.0,
  MAX: 2.0,
  DEFAULT: 1.0,
} as const;

/**
 * Speed bounds (for validation)
 * NOTE: These are hints - Unity enforces actual bounds
 */
export const SPEED_BOUNDS = {
  MIN: 0.1,
  MAX: 3.0,
  DEFAULT: 1.0,
} as const;
