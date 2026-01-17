// /app/frontend/lib/hero/camera.ts
// Phase 3.23.9: Hero Camera Framing Modes (Static Constants)
//
// Defines camera positions for hero presentation.
// Only 'standard' is active now; others are reserved for future affinity unlocks.
//
// "We define positions, not animations."

export type CameraMode = 'distant' | 'standard' | 'intimate';

export const CAMERA = {
  /**
   * Distant: Full body view, slightly pulled back
   * Use case: Gallery view, hero selection
   */
  distant: {
    scale: 0.88,
    translateY: -20,
    translateX: 0,
  },
  
  /**
   * Standard: Default presentation view
   * Use case: Hero detail, normal viewing
   * THIS IS THE ONLY ACTIVE MODE FOR NOW
   */
  standard: {
    scale: 1.0,
    translateY: 0,
    translateX: 0,
  },
  
  /**
   * Intimate: Closer framing, subtle zoom
   * Use case: Future affinity unlocks, private view
   * LOCKED - requires affinity threshold
   */
  intimate: {
    scale: 1.08,
    translateY: 24,
    translateX: 0,
  },
} as const;

/**
 * Get camera transform for a given mode
 * Returns transform array for Animated.View style
 */
export function getCameraTransform(mode: CameraMode) {
  const cam = CAMERA[mode];
  return [
    { scale: cam.scale },
    { translateY: cam.translateY },
    { translateX: cam.translateX },
  ];
}

/**
 * Check if a camera mode is unlocked for a hero
 * For now, only 'standard' is always unlocked
 */
export function isCameraModeUnlocked(mode: CameraMode, affinityLevel: number = 0): boolean {
  switch (mode) {
    case 'distant':
      return true; // Always available
    case 'standard':
      return true; // Always available
    case 'intimate':
      return affinityLevel >= 3; // Requires affinity level 3+
    default:
      return false;
  }
}

export default CAMERA;
