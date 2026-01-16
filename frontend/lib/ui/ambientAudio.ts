// /app/frontend/lib/ui/ambientAudio.ts
// Phase 3.22.10.A: Sensory Mastering — Audio Cues
//
// Goals:
// - Warm + noticeable, never sharp
// - Low frequency, high meaning
// - Nothing triggers twice by accident (rate-limit + per-event cooldown)
//
// Rules:
// - Respect system silent / ringer settings (best-effort)
// - Respect Reduce Motion accessibility
// - User toggle (Ambient Sound on/off)
//
// Hard caps:
// - Signature/presence cue: max 1 per SESSION
// - Collect cue: max 1 per 2.5s
// - Tab press: haptic only, no sound

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AccessibilityInfo } from 'react-native';

// Storage key for ambient sound preference
const AMBIENT_ENABLED_KEY = 'ambientSoundEnabled';

// Rate limiting (global)
const MIN_INTERVAL_MS = 2500; // 2.5 seconds between cues
let lastPlayTime = 0;

// Session caps
let signaturePlayedThisSession = false;

// State
let isLoaded = false;
let isEnabled = true; // default ON
let reduceMotionEnabled = false;

/**
 * Initialize ambient audio system
 * Call once on app start (after auth)
 */
export async function initAmbientAudio(): Promise<void> {
  if (isLoaded) return;

  try {
    // Load preference
    const stored = await AsyncStorage.getItem(AMBIENT_ENABLED_KEY);
    if (stored !== null) {
      isEnabled = stored === 'true';
    }

    // Check Reduce Motion accessibility setting
    reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
    
    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        reduceMotionEnabled = enabled;
      }
    );

    // Configure audio mode (best-effort, may fail on web)
    if (Platform.OS !== 'web') {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false, // Respect silent mode
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch {
        // Silent fail — audio config not critical
      }
    }

    isLoaded = true;
  } catch (error) {
    // Silent fail — init non-critical
    isLoaded = true; // Mark loaded to prevent retry spam
  }
}

/**
 * Check if enough time has passed since last cue
 */
function canPlayRateLimited(): boolean {
  if (!isEnabled) return false;
  const now = Date.now();
  if (now - lastPlayTime < MIN_INTERVAL_MS) return false;
  return true;
}

/**
 * Get haptics module safely (lazy import)
 */
async function getHaptics() {
  try {
    if (Platform.OS === 'web') return null;
    const Haptics = await import('expo-haptics');
    return Haptics;
  } catch {
    return null;
  }
}

/**
 * Play the "signature" cue (Phase 3.22.10.A)
 * MAX 1 PER SESSION — ultra-rare presence moment
 * Warm double-tap haptic pattern
 */
export async function playSignatureCue(): Promise<void> {
  // Session cap: only once
  if (signaturePlayedThisSession) return;
  if (!isEnabled) return;
  if (reduceMotionEnabled) return; // Respect accessibility
  
  signaturePlayedThisSession = true;
  lastPlayTime = Date.now();

  const Haptics = await getHaptics();
  if (!Haptics) return;

  try {
    // Warm double-tap: soft → pause → soft
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // 400ms pause for "presence" feel
    await new Promise(resolve => setTimeout(resolve, 400));
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silent fail
  }
}

/**
 * Play the "collect" cue (Receive button)
 * Soft "seal" confirmation — satisfying but not intrusive
 * Rate-limited: max 1 per 2.5s
 */
export async function playCollectCue(): Promise<void> {
  if (!canPlayRateLimited()) return;
  
  lastPlayTime = Date.now();
  
  const Haptics = await getHaptics();
  if (!Haptics) return;

  try {
    // Success notification — soft confirmation
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silent fail
  }
}

/**
 * Play the "instant" cue (Take More button)
 * Slightly stronger than collect — still warm
 * Rate-limited: max 1 per 2.5s
 */
export async function playInstantCue(): Promise<void> {
  if (!canPlayRateLimited()) return;
  
  lastPlayTime = Date.now();
  
  const Haptics = await getHaptics();
  if (!Haptics) return;

  try {
    // Medium impact — stronger but warm
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silent fail
  }
}

/**
 * Play home return cue (entering authenticated Home)
 * Only haptic, no sound (per spec: presence is signature's job)
 * Rate-limited
 */
export async function playHomeReturnCue(): Promise<void> {
  if (!canPlayRateLimited()) return;
  if (reduceMotionEnabled) return;
  
  lastPlayTime = Date.now();
  
  const Haptics = await getHaptics();
  if (!Haptics) return;

  try {
    // Very light presence tap
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silent fail
  }
}

/**
 * Toggle ambient sound on/off
 */
export async function setAmbientEnabled(enabled: boolean): Promise<void> {
  isEnabled = enabled;
  try {
    await AsyncStorage.setItem(AMBIENT_ENABLED_KEY, String(enabled));
  } catch {
    // Silent fail
  }
}

/**
 * Get current ambient sound preference
 */
export function isAmbientEnabled(): boolean {
  return isEnabled;
}

/**
 * Reset session state (call on app background/foreground)
 */
export function resetAudioSession(): void {
  signaturePlayedThisSession = false;
  lastPlayTime = 0;
}

/**
 * Cleanup (optional, called on app terminate)
 */
export async function unloadAmbientAudio(): Promise<void> {
  isLoaded = false;
}
