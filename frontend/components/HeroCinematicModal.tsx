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
  Pressable,
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
  videoSource: number | string | null; // number on native, string URL on web
  heroName?: string;
  heroKey?: string;
}

// ─────────────────────────────────────────────────────────────
// Codec error detection for web
// ─────────────────────────────────────────────────────────────
function isUnsupportedCodecError(msg: string | null): boolean {
  if (!msg) return false;
  return (
    msg.includes('DEMUXER_ERROR_NO_SUPPORTED_STREAMS') ||
    msg.includes('no supported streams') ||
    msg.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') ||
    msg.includes('Format error') ||
    msg.includes('could not be decoded')
  );
}

// ─────────────────────────────────────────────────────────────
// Fallback component for error/unavailable states
// ─────────────────────────────────────────────────────────────
function CinematicFallback({ 
  title, 
  subtitle, 
  onClose,
  isCodecError = false,
}: { 
  title: string; 
  subtitle?: string; 
  onClose: () => void;
  isCodecError?: boolean;
}) {
  return (
    <View style={styles.fallbackContainer}>
      <Ionicons 
        name={isCodecError ? "desktop-outline" : "videocam-off"} 
        size={64} 
        color={COLORS.gold.primary} 
      />
      <Text style={styles.fallbackTitle}>{title}</Text>
      {subtitle && <Text style={styles.fallbackSubtitle}>{subtitle}</Text>}
      {isCodecError && (
        <Text style={styles.fallbackHint}>
          Try viewing on mobile device for best experience.
        </Text>
      )}
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

  // Log on open with platform info
  React.useEffect(() => {
    if (visible) {
      logCine('open', { 
        heroKey, 
        heroName, 
        platform: Platform.OS,
        raw: videoSource,
        normalized: typeof videoSource === 'string' ? '{ uri }' : 'module',
      });
      setIsLoading(true);
      setError(null);
    }
  }, [visible, heroKey, heroName, videoSource]);

  // Normalize source: string (web) → { uri }, number (native) → pass through
  const normalizedSource = React.useMemo(() => {
    if (!videoSource) return null;
    return typeof videoSource === 'string' ? { uri: videoSource } : videoSource;
  }, [videoSource]);

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

  // Handle video load error - accepts any type, stringifies safely
  const handleError = useCallback((e: any) => {
    const msg =
      typeof e === 'string'
        ? e
        : e?.error ?? e?.message ?? JSON.stringify(e);

    logCine('error', { heroKey, error: msg });
    setError(String(msg));
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
        {/* Tap anywhere to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(10,10,30,0.98)', 'rgba(0,0,0,0.95)']}
          style={styles.gradientBackground}
          pointerEvents="box-none"
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

            {/* Error state - with codec-specific messaging */}
            {error ? (
              isUnsupportedCodecError(error) && Platform.OS === 'web' ? (
                <CinematicFallback 
                  title="Browser Format Not Supported" 
                  subtitle="This cinematic uses a video format not supported by web browsers."
                  onClose={handleClose}
                  isCodecError={true}
                />
              ) : (
                <CinematicFallback 
                  title="Failed to Load Video" 
                  subtitle={error}
                  onClose={handleClose} 
                />
              )
            ) : Platform.OS === 'web' && typeof videoSource === 'string' ? (
              /* Web: use native HTML5 video for better compatibility */
              <video
                src={videoSource}
                crossOrigin="anonymous"
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: SCREEN_WIDTH,
                  maxHeight: SCREEN_HEIGHT * 0.6,
                  objectFit: 'contain',
                  backgroundColor: 'transparent',
                }}
                autoPlay
                playsInline
                muted={false}
                onLoadStart={() => {
                  logCine('web:loadStart', { heroKey, src: videoSource });
                  setIsLoading(true);
                }}
                onCanPlay={() => {
                  logCine('web:canPlay', { heroKey });
                  setIsLoading(false);
                }}
                onEnded={() => {
                  logCine('web:ended', { heroKey });
                }}
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  const errMsg = target?.error?.message ?? 'Video playback failed';
                  logCine('web:error', { heroKey, error: errMsg, code: target?.error?.code });
                  setError(errMsg);
                  setIsLoading(false);
                }}
              />
            ) : (
              /* Native: use expo-av Video component */
              <Video
                ref={videoRef}
                source={normalizedSource as any}
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
  fallbackHint: {
    color: COLORS.gold.muted,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
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
