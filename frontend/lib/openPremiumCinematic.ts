/**
 * openPremiumCinematic.ts
 * 
 * Future-proof placeholder for Premium Cinematic playback.
 * 
 * Currently: Cinematics are DISABLED. This function will navigate to
 * the paywall if the user doesn't have access.
 * 
 * Future: When payments are enabled, this will open the cinematic modal
 * for heroes with owned premium cinematics.
 * 
 * Requirements for playback:
 * 1. User has PREMIUM_CINEMATICS_PACK entitlement (global pack)
 * 2. HERO_CINEMATICS feature flag is enabled
 * 3. User has PREMIUM_CINEMATIC_OWNED:<heroId> entitlement (per-hero)
 */

import { router } from 'expo-router';
import { canAccessCinematics, hasHeroPremiumCinematicOwned } from './cinematicsAccess';

export interface OpenCinematicResult {
  success: boolean;
  reason?: 'no_pack' | 'feature_disabled' | 'hero_not_owned' | 'not_implemented';
}

/**
 * Attempt to open the premium cinematic for a hero.
 * 
 * Currently: Always navigates to paywall or shows error.
 * Future: Will open the cinematic modal.
 * 
 * @param heroId - The hero's stable ID
 * @param stableId - User's stable ID for feature flag rollout
 * @returns Result indicating success or reason for failure
 */
export function openPremiumCinematic(
  heroId: string,
  stableId?: string
): OpenCinematicResult {
  // Check if user can access cinematics system (pack + feature flag)
  if (!canAccessCinematics(stableId)) {
    // Navigate to paywall
    router.push('/paid-features');
    return { success: false, reason: 'no_pack' };
  }
  
  // Check if user owns this hero's cinematic
  if (!hasHeroPremiumCinematicOwned(heroId)) {
    // Navigate to paywall
    router.push('/paid-features');
    return { success: false, reason: 'hero_not_owned' };
  }
  
  // TODO: When cinematics are re-enabled, open the modal here
  // For now, return not_implemented
  console.log('[openPremiumCinematic] Cinematics playback not yet implemented');
  return { success: false, reason: 'not_implemented' };
}

/**
 * Check if a hero's cinematic can be played (all requirements met)
 * This is a convenience wrapper for UI to show "playable" state.
 * 
 * @param heroId - The hero's stable ID
 * @param stableId - User's stable ID for feature flag rollout
 * @returns true if all requirements are met for playback
 */
export function canPlayHeroCinematic(
  heroId: string,
  stableId?: string
): boolean {
  return canAccessCinematics(stableId) && hasHeroPremiumCinematicOwned(heroId);
}
