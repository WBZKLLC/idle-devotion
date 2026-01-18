/**
 * Phase 4.0: SFX Audio System
 * 
 * Safe audio wrapper that never crashes if assets are missing.
 * Provides battle feel without blocking gameplay.
 */

import { Audio } from 'expo-av';
import { track, Events } from '../telemetry/events';

// SFX names - only these are allowed
export type SFXName = 'battle_start' | 'victory' | 'defeat';

// Asset mapping (placeholder - will be replaced with real assets)
const SFX_ASSETS: Record<SFXName, any> = {
  battle_start: null, // require('../../assets/audio/battle_start.mp3'),
  victory: null,      // require('../../assets/audio/victory.mp3'),
  defeat: null,       // require('../../assets/audio/defeat.mp3'),
};

// Track loaded sounds for cleanup
let loadedSounds: Map<SFXName, Audio.Sound> = new Map();

// Global mute flag
let isMuted = false;

/**
 * Play a sound effect by name.
 * Safe no-op if asset is missing or audio fails.
 * Never throws or blocks.
 */
export async function playSfx(name: SFXName): Promise<void> {
  // Track the attempt regardless of outcome
  const eventMap: Record<SFXName, string> = {
    battle_start: Events.SFX_BATTLE_START_PLAYED,
    victory: Events.SFX_VICTORY_PLAYED,
    defeat: Events.SFX_DEFEAT_PLAYED,
  };
  track(eventMap[name], { sfxName: name });
  
  // Silent no-op if muted or no asset
  if (isMuted) return;
  
  const asset = SFX_ASSETS[name];
  if (!asset) {
    // Asset not ready - silent no-op
    if (__DEV__) {
      console.log(`[SFX] Asset not loaded: ${name} (placeholder mode)`);
    }
    return;
  }
  
  try {
    // Check if already loaded
    let sound = loadedSounds.get(name);
    
    if (!sound) {
      // Load the sound
      const { sound: newSound } = await Audio.Sound.createAsync(asset, {
        shouldPlay: false,
        volume: 0.7,
      });
      sound = newSound;
      loadedSounds.set(name, sound);
    }
    
    // Reset and play
    await sound.setPositionAsync(0);
    await sound.playAsync();
    
  } catch (error) {
    // Silent failure - never crash for audio
    if (__DEV__) {
      console.warn(`[SFX] Failed to play ${name}:`, error);
    }
  }
}

/**
 * Preload all SFX assets.
 * Call on app start for instant playback.
 */
export async function preloadSfx(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    
    // Preload all available assets
    for (const [name, asset] of Object.entries(SFX_ASSETS)) {
      if (asset) {
        try {
          const { sound } = await Audio.Sound.createAsync(asset, {
            shouldPlay: false,
            volume: 0.7,
          });
          loadedSounds.set(name as SFXName, sound);
        } catch {
          // Individual asset failure is OK
        }
      }
    }
  } catch {
    // Audio setup failure is OK - will use no-op mode
  }
}

/**
 * Unload all SFX to free memory.
 */
export async function unloadSfx(): Promise<void> {
  for (const sound of loadedSounds.values()) {
    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload errors
    }
  }
  loadedSounds.clear();
}

/**
 * Set global mute state.
 */
export function setSfxMuted(muted: boolean): void {
  isMuted = muted;
}

/**
 * Get current mute state.
 */
export function isSfxMuted(): boolean {
  return isMuted;
}
