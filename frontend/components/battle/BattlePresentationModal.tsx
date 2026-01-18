/**
 * Phase 3.50: Battle Presentation Modal
 * 
 * Purpose: Eliminate "instant resolution" feeling with a short, deterministic,
 * no-RNG presentation layer that shows:
 * - Turn progression (deterministic, based on result)
 * - Ability/skill callouts with visual FX
 * - Damage numbers derived from server result
 * - Climax moment before result
 * 
 * Duration: ~8-12 seconds, user-skippable
 * Reduce Motion: Simplified mode with minimal transitions
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { track, Events } from '../../lib/telemetry/events';

// Theme colors
const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b' },
  gold: { primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  victory: '#22c55e',
  defeat: '#ef4444',
};

// Skill callout names - deterministic based on turn index
const SKILL_CALLOUTS = [
  'Divine Strike',
  'Holy Light',
  'Celestial Fury',
  'Sacred Blade',
  'Heavenly Wrath',
  'Righteous Fury',
];

export type BattlePresentationData = {
  victory: boolean;
  enemyPower?: number;
  playerPower?: number;
  rewards?: Record<string, number>;
  stars?: number;
  stageName?: string;
  firstClear?: boolean;
};

type Props = {
  visible: boolean;
  data: BattlePresentationData | null;
  onComplete: () => void;
  mode?: 'campaign' | 'dungeon' | 'arena';
};

export function BattlePresentationModal({ visible, data, onComplete, mode = 'campaign' }: Props) {
  const [currentTurn, setCurrentTurn] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'battle' | 'climax' | 'result'>('intro');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [skipped, setSkipped] = useState(false);
  
  // Total turns for presentation (deterministic based on victory)
  const totalTurns = data?.victory ? 4 : 3;
  
  // Animation values
  const fadeProgress = useSharedValue(0);
  const turnProgress = useSharedValue(0);
  const damageScale = useSharedValue(0);
  const climaxPulse = useSharedValue(0);
  
  // Track viewed event
  const hasTrackedView = useRef(false);
  
  // Check reduce motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove?.();
  }, []);
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible && data) {
      setCurrentTurn(0);
      setPhase('intro');
      setSkipped(false);
      fadeProgress.value = 0;
      turnProgress.value = 0;
      damageScale.value = 0;
      climaxPulse.value = 0;
      hasTrackedView.current = false;
      
      // Start the presentation sequence
      startPresentation();
    }
  }, [visible, data]);
  
  const startPresentation = useCallback(() => {
    if (!data) return;
    
    // Track view event
    if (!hasTrackedView.current) {
      track(Events.PVE_BATTLE_PRESENTATION_VIEWED, {
        mode,
        victory: data.victory,
        playerPower: data.playerPower,
        enemyPower: data.enemyPower,
      });
      hasTrackedView.current = true;
    }
    
    // Animate intro fade-in
    fadeProgress.value = withTiming(1, { duration: reduceMotion ? 100 : 500 });
    
    // If reduce motion, go faster
    const turnDuration = reduceMotion ? 500 : 1800;
    const introDuration = reduceMotion ? 300 : 1000;
    
    // Schedule phase transitions
    setTimeout(() => {
      setPhase('battle');
      runBattleTurns(0, turnDuration);
    }, introDuration);
    
  }, [data, reduceMotion, mode]);
  
  const runBattleTurns = (turn: number, duration: number) => {
    if (turn >= totalTurns || skipped) {
      // Move to climax
      setPhase('climax');
      runClimax();
      return;
    }
    
    setCurrentTurn(turn + 1);
    turnProgress.value = withTiming((turn + 1) / totalTurns, { duration: duration / 2 });
    
    // Animate damage number pop
    damageScale.value = withSequence(
      withTiming(1.3, { duration: 150, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200 })
    );
    
    // Schedule next turn
    setTimeout(() => runBattleTurns(turn + 1, duration), duration);
  };
  
  const runClimax = () => {
    // Climax pulse animation
    climaxPulse.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 200 : 600 }),
      withTiming(0.8, { duration: reduceMotion ? 100 : 300 })
    );
    
    // After climax, show result
    setTimeout(() => {
      setPhase('result');
      track(Events.PVE_BATTLE_PRESENTATION_COMPLETED, {
        mode,
        victory: data?.victory,
        skipped: false,
      });
    }, reduceMotion ? 400 : 1000);
  };
  
  const handleSkip = () => {
    setSkipped(true);
    track(Events.PVE_BATTLE_PRESENTATION_SKIPPED, {
      mode,
      turnReached: currentTurn,
      phase,
    });
    setPhase('result');
  };
  
  const handleContinue = () => {
    track(Events.PVE_BATTLE_RESULT_SHOWN, {
      mode,
      victory: data?.victory,
    });
    onComplete();
  };
  
  // Generate deterministic damage numbers based on power difference
  const getDamageNumber = (turn: number): number => {
    const baseDamage = data?.playerPower ?? 10000;
    // Deterministic variation based on turn
    const variation = [1.2, 0.9, 1.5, 2.0][turn % 4];
    return Math.floor(baseDamage * variation * 0.1);
  };
  
  // Animated styles
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
  }));
  
  const damageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: damageScale.value }],
    opacity: interpolate(damageScale.value, [0, 1, 1.3], [0, 1, 1]),
  }));
  
  const climaxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(climaxPulse.value, [0, 1], [0.8, 1.2]) }],
    opacity: climaxPulse.value,
  }));
  
  if (!visible || !data) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, fadeStyle]}>
          <LinearGradient
            colors={[COLORS.navy.primary, COLORS.navy.darkest]}
            style={styles.gradient}
          >
            {/* Skip button */}
            {phase !== 'result' && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                accessibilityLabel="Skip battle presentation"
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>Skip →</Text>
              </TouchableOpacity>
            )}
            
            {/* Intro Phase */}
            {phase === 'intro' && (
              <View style={styles.phaseContainer}>
                <Text style={styles.introTitle}>⚔️ BATTLE START</Text>
                <Text style={styles.stageName}>{data.stageName || 'Unknown Stage'}</Text>
              </View>
            )}
            
            {/* Battle Phase */}
            {phase === 'battle' && (
              <View style={styles.phaseContainer}>
                {/* Turn indicator */}
                <View style={styles.turnIndicator}>
                  <Text style={styles.turnText}>Turn {currentTurn}/{totalTurns}</Text>
                  <View style={styles.turnBar}>
                    <View style={[styles.turnFill, { width: `${(currentTurn / totalTurns) * 100}%` }]} />
                  </View>
                </View>
                
                {/* Skill callout */}
                <View style={styles.skillCallout}>
                  <LinearGradient
                    colors={[COLORS.gold.primary + '40', 'transparent']}
                    style={styles.skillGradient}
                  >
                    <Text style={styles.skillName}>
                      ✨ {SKILL_CALLOUTS[(currentTurn - 1) % SKILL_CALLOUTS.length]}
                    </Text>
                  </LinearGradient>
                </View>
                
                {/* Damage number */}
                <Animated.View style={[styles.damageContainer, damageStyle]}>
                  <Text style={[styles.damageNumber, data.victory ? styles.damageVictory : styles.damageDefeat]}>
                    {data.victory ? '-' : '+'}{getDamageNumber(currentTurn - 1).toLocaleString()}
                  </Text>
                </Animated.View>
                
                {/* Battle visual indicator */}
                <View style={styles.battleVisual}>
                  <Text style={styles.battleEmoji}>⚔️</Text>
                </View>
              </View>
            )}
            
            {/* Climax Phase */}
            {phase === 'climax' && (
              <View style={styles.phaseContainer}>
                <Animated.View style={[styles.climaxContainer, climaxStyle]}>
                  <Text style={styles.climaxText}>
                    {data.victory ? '💫 FINISHING BLOW!' : '💥 OVERWHELMED!'}
                  </Text>
                </Animated.View>
              </View>
            )}
            
            {/* Result Phase */}
            {phase === 'result' && (
              <View style={styles.phaseContainer}>
                <Text style={[styles.resultTitle, data.victory ? styles.victoryText : styles.defeatText]}>
                  {data.victory ? '🎉 VICTORY!' : '💀 DEFEAT'}
                </Text>
                
                {data.firstClear && (
                  <View style={styles.firstClearBadge}>
                    <Ionicons name="star" size={16} color={COLORS.gold.primary} />
                    <Text style={styles.firstClearText}>First Clear!</Text>
                  </View>
                )}
                
                {/* Stars (if victory) */}
                {data.victory && data.stars !== undefined && (
                  <View style={styles.starsContainer}>
                    {[1, 2, 3].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= (data.stars || 0) ? 'star' : 'star-outline'}
                        size={32}
                        color={star <= (data.stars || 0) ? COLORS.gold.primary : COLORS.cream.dark}
                      />
                    ))}
                  </View>
                )}
                
                {/* Continue button */}
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinue}
                  accessibilityLabel="Continue to rewards"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={data.victory ? [COLORS.victory, '#16a34a'] : [COLORS.defeat, '#dc2626']}
                    style={styles.continueGradient}
                  >
                    <Text style={styles.continueText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
    minHeight: 350,
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  skipText: {
    color: COLORS.cream.dark,
    fontSize: 14,
    fontWeight: '600',
  },
  phaseContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 280,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
    marginBottom: 12,
  },
  stageName: {
    fontSize: 16,
    color: COLORS.cream.dark,
  },
  turnIndicator: {
    width: '100%',
    marginBottom: 24,
  },
  turnText: {
    fontSize: 14,
    color: COLORS.cream.dark,
    textAlign: 'center',
    marginBottom: 8,
  },
  turnBar: {
    height: 6,
    backgroundColor: COLORS.navy.dark,
    borderRadius: 3,
    overflow: 'hidden',
  },
  turnFill: {
    height: '100%',
    backgroundColor: COLORS.gold.primary,
    borderRadius: 3,
  },
  skillCallout: {
    marginBottom: 20,
  },
  skillGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  skillName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold.light,
    textAlign: 'center',
  },
  damageContainer: {
    marginVertical: 20,
  },
  damageNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  damageVictory: {
    color: COLORS.victory,
  },
  damageDefeat: {
    color: COLORS.defeat,
  },
  battleVisual: {
    marginTop: 20,
  },
  battleEmoji: {
    fontSize: 64,
  },
  climaxContainer: {
    padding: 20,
  },
  climaxText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.gold.light,
    textAlign: 'center',
  },
  resultTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  victoryText: {
    color: COLORS.victory,
  },
  defeatText: {
    color: COLORS.defeat,
  },
  firstClearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold.primary + '30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  firstClearText: {
    color: COLORS.gold.primary,
    fontWeight: 'bold',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  continueButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  continueGradient: {
    paddingHorizontal: 48,
    paddingVertical: 16,
  },
  continueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
    textAlign: 'center',
  },
});
