/**
 * HeroCinematicModal
 * 
 * A reusable modal component for playing hero cinematic videos.
 * Used exclusively for 5+ star (final ascension) hero cinematics.
 * 
 * Features:
 * - Module-first video source (bulletproof)
 * - Proper logging for failure signature capture
 * - Hard UI fallbacks (never blank modal)
 * - Gated by HERO_CINEMATICS feature flag at entry point
 */

import React, { useRef, useCallback, useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Logging helper for failure signature capture
// ─────────────────────────────────────────────────────────────
const logCine = (...args: any[]) => {
  if (__DEV__) console.log('[cinematics]', ...args);
};

interface HeroCinematicModalProps {
  visible: boolean;
  onClose: () => void;
  videoSource: number | null; // require() module ID or null
  heroName?: string;
  heroKey?: string;
}

// ─────────────────────────────────────────────────────────────
// Fallback component for error/unavailable states
// ─────────────────────────────────────────────────────────────
function CinematicFallback({ 
  title, 
  subtitle, 
  onClose 
}: { 
  title: string; 
  subtitle?: string; 
  onClose: () => void;
}) {
  return (
    <View style={styles.fallbackContainer}>
      <Ionicons name="videocam-off" size={64} color={COLORS.gold.primary} />
      <Text style={styles.fallbackTitle}>{title}</Text>
      {subtitle && <Text style={styles.fallbackSubtitle}>{subtitle}</Text>}
      <TouchableOpacity style={styles.fallbackButton} onPress={onClose}>
        <Text style={styles.fallbackButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HeroCinematicModal({
  visible,
  onClose,
  videoSource,
  heroName = 'Hero',
  heroKey = 'unknown',
}: HeroCinematicModalProps) {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Log on open
  React.useEffect(() => {
    if (visible) {
      logCine('open', { heroKey, heroName, moduleId: videoSource });
      setIsLoading(true);
      setError(null);
    }
  }, [visible, heroKey, heroName, videoSource]);

  // Cleanup function - stops and unloads video
  const cleanupVideo = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
      }
    } catch (e) {
      // Fail silently - video might already be unloaded
      logCine('cleanup:error', e);
    }
  }, []);

  // Handle close button press
  const handleClose = useCallback(async () => {
    logCine('close', { heroKey });
    await cleanupVideo();
    onClose();
  }, [cleanupVideo, onClose, heroKey]);

  // Handle video load start
  const handleLoadStart = useCallback(() => {
    logCine('loadStart', { heroKey });
    setIsLoading(true);
  }, [heroKey]);

  // Handle video loaded
  const handleLoad = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      logCine('load', { 
        heroKey,
        durationMillis: status.durationMillis,
        // naturalSize not directly available in expo-av status
      });
      setIsLoading(false);
    }
  }, [heroKey]);

  // Handle playback status updates
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Video is not loaded - check for error
      if ((status as any).error) {
        logCine('status:error', (status as any).error);
        setError(String((status as any).error));
        setIsLoading(false);
      }
      return;
    }

    // Video finished playing (played once)
    if (status.didJustFinish && !status.isLooping) {
      logCine('finished', { heroKey });
    }
  }, [heroKey]);

  // Handle video load error
  const handleError = useCallback((errorMessage: string) => {
    logCine('error', { heroKey, error: errorMessage });
    setError(errorMessage);
    setIsLoading(false);
  }, [heroKey]);

  // ─────────────────────────────────────────────────────────────
  // Render guards - hard UI fallbacks (no blank modal)
  // ─────────────────────────────────────────────────────────────

  // Don't render if not visible
  if (!visible) return null;

  // No video source provided
  if (!videoSource) {
    logCine('noSource', { heroKey });
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <LinearGradient
            colors={['rgba(0,0,0,0.95)', 'rgba(10,10,30,0.98)', 'rgba(0,0,0,0.95)']}
            style={styles.gradientBackground}
          >
            <CinematicFallback 
              title="Cinematic Unavailable" 
              subtitle={`No video found for ${heroName}`}
              onClose={handleClose} 
            />
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(10,10,30,0.98)', 'rgba(0,0,0,0.95)']}
          style={styles.gradientBackground}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heroTitle}>{heroName}</Text>
            <Text style={styles.subtitle}>⭐ 5+ Star Ascension ⭐</Text>
          </View>

          {/* Video Container */}
          <View style={styles.videoContainer}>
            {/* Loading overlay */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.gold.primary} />
                <Text style={styles.loadingText}>Loading cinematic...</Text>
              </View>
            )}

            {/* Error state */}
            {error ? (
              <CinematicFallback 
                title="Failed to Load Video" 
                subtitle={error}
                onClose={handleClose} 
              />
            ) : (
              /* Video player - MODULE-FIRST approach */
              <Video
                ref={videoRef}
                source={videoSource}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={visible && !error}
                isLooping={false}
                useNativeControls={false}
                onLoadStart={handleLoadStart}
                onLoad={handleLoad}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onError={handleError}
                volume={1.0}
                isMuted={false}
              />
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <View style={styles.closeButtonInner}>
              <Ionicons name="close" size={28} color={COLORS.cream.pure} />
            </View>
          </TouchableOpacity>

          {/* Skip/Close Text */}
          <TouchableOpacity style={styles.skipContainer} onPress={handleClose}>
            <Text style={styles.skipText}>Tap anywhere to close</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gold.primary,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.cream.soft,
    marginTop: 4,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  loadingText: {
    color: COLORS.cream.soft,
    marginTop: 12,
    fontSize: 14,
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  fallbackTitle: {
    color: COLORS.gold.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    color: COLORS.cream.soft,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
  fallbackButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: COLORS.gold.primary,
    borderRadius: 8,
  },
  fallbackButtonText: {
    color: COLORS.navy.darkest,
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 20,
  },
  closeButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cream.dark,
  },
  skipContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  skipText: {
    color: COLORS.cream.dark,
    fontSize: 12,
  },
});
