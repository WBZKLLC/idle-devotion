/**
 * HeroCinematicModal
 * 
 * A reusable modal component for playing hero cinematic videos.
 * Used exclusively for 5+ star (final ascension) hero cinematics.
 * 
 * Features:
 * - Autoplay on open
 * - Plays once (no loop)
 * - Close button
 * - Proper cleanup on close (stops playback, unloads video, releases memory)
 * - Fail-safe: never crashes if video is missing
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
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

interface HeroCinematicModalProps {
  visible: boolean;
  onClose: () => void;
  videoSource: any; // require() source or null
  heroName?: string;
}

export default function HeroCinematicModal({
  visible,
  onClose,
  videoSource,
  heroName = 'Hero',
}: HeroCinematicModalProps) {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setHasError(false);
      setIsPlaying(false);
    }
  }, [visible]);

  // Cleanup function - stops and unloads video
  const cleanupVideo = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
      }
    } catch (error) {
      // Fail silently - video might already be unloaded
      if (__DEV__) {
        console.log('[HeroCinematicModal] Cleanup error (safe to ignore):', error);
      }
    }
  }, []);

  // Handle close button press
  const handleClose = useCallback(async () => {
    await cleanupVideo();
    onClose();
  }, [cleanupVideo, onClose]);

  // Handle playback status updates
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Video is not loaded
      if (status.error) {
        if (__DEV__) {
          console.warn('[HeroCinematicModal] Playback error:', status.error);
        }
        setHasError(true);
        setIsLoading(false);
      }
      return;
    }

    // Video is loaded
    setIsLoading(false);
    setIsPlaying(status.isPlaying);

    // Video finished playing (played once)
    if (status.didJustFinish && !status.isLooping) {
      // Auto-close after video finishes (optional - uncomment if desired)
      // handleClose();
    }
  }, []);

  // Handle video load error
  const handleLoadError = useCallback((error: string) => {
    if (__DEV__) {
      console.warn('[HeroCinematicModal] Load error:', error);
    }
    setHasError(true);
    setIsLoading(false);
  }, []);

  // If no video source, don't render modal
  if (!videoSource) {
    if (__DEV__ && visible) {
      console.warn(`[HeroCinematicModal] No video source provided for ${heroName}`);
    }
    return null;
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
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.gold.primary} />
                <Text style={styles.loadingText}>Loading cinematic...</Text>
              </View>
            )}

            {hasError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color={COLORS.gold.primary} />
                <Text style={styles.errorText}>Failed to load video</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
                  <Text style={styles.retryButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Video
                ref={videoRef}
                source={videoSource}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={visible}
                isLooping={false}
                useNativeControls={false}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onError={handleLoadError}
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
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: COLORS.cream.soft,
    marginTop: 12,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.gold.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.navy.darkest,
    fontWeight: 'bold',
    fontSize: 14,
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
