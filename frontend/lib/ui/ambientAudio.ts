// /app/frontend/lib/ui/ambientAudio.ts
// Phase 3.22.6.D: Ambient Audio System
//
// Quietly indulgent audio cues — felt, not intrusive.
// Rules:
// - One soft "return" cue on entering authenticated Home
// - Micro-cues only on ritual actions (Receive, Take More)
// - Never on every button, never on navigation spam
// - Rate-limited: max 1 cue per 2-3 seconds
// - Respects device silent mode / system volume

import { Audio, AVPlaybackStatus } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for ambient sound preference
const AMBIENT_ENABLED_KEY = 'ambientSoundEnabled';

// Volume targets (very restrained)
const VOLUME = {
  homeReturn: 0.14,    // 0.10–0.18 range
  collect: 0.17,       // 0.12–0.22 range
  instant: 0.20,       // slightly brighter
} as const;

// Rate limiting
const MIN_INTERVAL_MS = 2500; // 2.5 seconds between cues
let lastPlayTime = 0;

// Singleton sound instances (preloaded)
let homeReturnSound: Audio.Sound | null = null;
let collectSound: Audio.Sound | null = null;
let instantSound: Audio.Sound | null = null;
let isLoaded = false;
let isEnabled = true; // default ON

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

    // Configure audio mode
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false, // Respect silent mode
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    // Preload sounds (using simple sine tones as placeholders)
    // In production, replace with actual audio assets
    // For now, we'll use programmatic approach
    
    isLoaded = true;
  } catch (error) {
    console.warn('[ambientAudio] Init failed:', error);
  }
}

/**
 * Check if enough time has passed since last cue
 */
function canPlay(): boolean {
  if (!isEnabled) return false;
  const now = Date.now();
  if (now - lastPlayTime < MIN_INTERVAL_MS) return false;
  return true;
}

/**
 * Play a sound with rate limiting
 */
async function playSound(
  sound: Audio.Sound | null,
  volume: number
): Promise<void> {
  if (!canPlay() || !sound) return;

  try {
    lastPlayTime = Date.now();
    await sound.setVolumeAsync(volume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    // Silent fail — audio is non-critical
  }
}

/**
 * Play the "home return" cue
 * Call when entering authenticated Home screen
 */
export async function playHomeReturnCue(): Promise<void> {
  if (!isEnabled) return;
  
  // For now, just trigger haptic as audio placeholder
  // Full audio integration would require actual sound files
  try {
    const Haptics = await import('expo-haptics');
    if (canPlay()) {
      lastPlayTime = Date.now();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Silent fail
  }
}

/**
 * Play the "collect" cue (Receive button)
 */
export async function playCollectCue(): Promise<void> {
  if (!isEnabled) return;
  
  try {
    const Haptics = await import('expo-haptics');
    if (canPlay()) {
      lastPlayTime = Date.now();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Silent fail
  }
}

/**
 * Play the "instant" cue (Take More button)
 */
export async function playInstantCue(): Promise<void> {
  if (!isEnabled) return;
  
  try {
    const Haptics = await import('expo-haptics');
    if (canPlay()) {
      lastPlayTime = Date.now();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    // Silent fail
  }
}

/**
 * Toggle ambient sound on/off
 */
export async function setAmbientEnabled(enabled: boolean): Promise<void> {
  isEnabled = enabled;
  await AsyncStorage.setItem(AMBIENT_ENABLED_KEY, String(enabled));
}

/**
 * Get current ambient sound preference
 */
export function isAmbientEnabled(): boolean {
  return isEnabled;
}

/**
 * Cleanup sounds on app terminate
 */
export async function unloadAmbientAudio(): Promise<void> {
  try {
    if (homeReturnSound) await homeReturnSound.unloadAsync();
    if (collectSound) await collectSound.unloadAsync();
    if (instantSound) await instantSound.unloadAsync();
    isLoaded = false;
  } catch {
    // Silent fail
  }
}
