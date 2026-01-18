/**
 * Phase 3.50 + 4.0 + E2: Battle Presentation Modal
 * 
 * Purpose: Eliminate "instant resolution" feeling with a short, deterministic,
 * no-RNG presentation layer that shows:
 * - Key Moment Timeline (OPENING → SKILL → DAMAGE → CLUTCH → FINAL BLOW)
 * - Ability/skill callouts with visual FX
 * - Damage numbers with tags (CRIT, GLANCING, DEVASTATING, BLOCKED)
 * - Climax moment before result
 * 
 * Phase 4.0: Added SFX support and cut-in asset integration
 * Phase E2: Key Moment Timeline + Damage Number Theater (RN equivalency)
 * 
 * Duration: ~8-12 seconds, user-skippable
 * Reduce Motion: Collapsed to 2 beats (OPENING, FINAL BLOW)
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
// Phase 4.0: SFX support
import { playSfx } from '../../lib/audio/sfx';
// Phase 4.0: Cut-in registry (generateBattleCutIns for registry-based cut-ins)
import { generateBattleCutIns, DEFAULT_CUTIN } from '../../lib/battle/skillCutins';

// Theme colors
const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b' },
  gold: { primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  victory: '#22c55e',
  defeat: '#ef4444',
  crit: '#ff6b6b',
  glancing: '#888888',
  devastating: '#ff4757',
  blocked: '#5f6c7b',
};

// Phase E2: Key Moment Timeline labels (deterministic, no RNG)
const KEY_MOMENTS = {
  OPENING: { label: '⚔️ OPENING CLASH', duration: 1500 },
  SKILL: { label: '✨ SKILL UNLEASHED', duration: 1800 },
  DAMAGE: { label: '💥 DAMAGE DEALT', duration: 1500 },
  CLUTCH: { label: '🔥 CLUTCH MOMENT', duration: 1200 },
  FINAL: { label: '⚡ FINAL BLOW', duration: 1000 },
} as const;

type KeyMomentType = keyof typeof KEY_MOMENTS;

// Phase E2: Damage number tags (deterministic based on power ratio)
type DamageTag = 'CRIT' | 'GLANCING' | 'DEVASTATING' | 'BLOCKED' | 'NORMAL';

// Skill callout names - deterministic based on turn index
const SKILL_CALLOUTS = [
  'Divine Strike',
  'Holy Light',
  'Celestial Fury',
  'Sacred Blade',
  'Heavenly Wrath',
  'Righteous Fury',
];

export type SkillCutInConfig = {
  title: string;
  element?: string;
  rarity?: string;
};

export type BattlePresentationData = {
  victory: boolean;
  enemyPower?: number;
  playerPower?: number;
  rewards?: Record<string, number>;
  stars?: number;
  stageName?: string;
  firstClear?: boolean;
  // Phase 3.54: Skill cut-ins (0-2 per battle)
  cutIns?: SkillCutInConfig[];
  // Phase 3.55: Key moment for result screen
  keyMoment?: string;
};

type Props = {
  visible: boolean;
  data: BattlePresentationData | null;
  onComplete: () => void;
  mode?: 'campaign' | 'dungeon' | 'arena';
};

export function BattlePresentationModal({ visible, data, onComplete, mode = 'campaign' }: Props) {
  const [currentMomentIndex, setCurrentMomentIndex] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'moments' | 'climax' | 'result'>('intro');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [skipped, setSkipped] = useState(false);
  
  // Phase E2: Damage numbers state
  const [damageNumbers, setDamageNumbers] = useState<Array<{ value: number; tag: DamageTag }>>([]);
  const [currentDamageIndex, setCurrentDamageIndex] = useState(0);
  
  // Animation values
  const fadeProgress = useSharedValue(0);
  const momentProgress = useSharedValue(0);
  const damageScale = useSharedValue(0);
  const climaxPulse = useSharedValue(0);
  
  // Track viewed event
  const hasTrackedView = useRef(false);
  const hasTrackedMoments = useRef(false);
  const hasTrackedDamage = useRef(false);
  
  // Phase E2: Calculate key moments based on power ratio (deterministic)
  const keyMoments = useMemo((): KeyMomentType[] => {
    if (!data) return ['OPENING', 'FINAL'];
    
    const powerRatio = (data.playerPower || 10000) / (data.enemyPower || 10000);
    
    // Reduce motion: only 2 beats
    if (reduceMotion) {
      return ['OPENING', 'FINAL'];
    }
    
    // Full sequence: 4-5 beats depending on power ratio
    const moments: KeyMomentType[] = ['OPENING', 'SKILL', 'DAMAGE'];
    
    // Include CLUTCH moment only if power ratio is close (0.9 <= ratio <= 1.1)
    if (powerRatio >= 0.9 && powerRatio <= 1.1) {
      moments.push('CLUTCH');
    }
    
    moments.push('FINAL');
    return moments;
  }, [data, reduceMotion]);
  
  // Phase E2: Generate deterministic damage numbers (6-12 total)
  const generateDamageNumbers = useCallback((): Array<{ value: number; tag: DamageTag }> => {
    if (!data) return [];
    
    const baseDamage = data.playerPower ?? 10000;
    const powerRatio = baseDamage / (data.enemyPower || 10000);
    
    // Deterministic count based on power ratio
    const count = powerRatio >= 1.0 ? 10 : 8;
    
    // Generate deterministic damage values and tags
    const numbers: Array<{ value: number; tag: DamageTag }> = [];
    for (let i = 0; i < count; i++) {
      // Deterministic variation based on index
      const variationFactor = [1.2, 0.9, 1.5, 1.1, 0.8, 1.3, 1.0, 0.95, 1.4, 1.15][i % 10];
      const value = Math.floor(baseDamage * variationFactor * 0.1);
      
      // Deterministic tag based on power ratio and index
      let tag: DamageTag = 'NORMAL';
      if (powerRatio >= 1.3 && i % 3 === 0) tag = 'DEVASTATING';
      else if (powerRatio >= 1.15 && i % 2 === 0) tag = 'CRIT';
      else if (powerRatio <= 0.7 && i % 2 === 0) tag = 'BLOCKED';
      else if (powerRatio <= 0.85 && i % 3 === 0) tag = 'GLANCING';
      
      numbers.push({ value, tag });
    }
    
    return numbers;
  }, [data]);
  
  // Check reduce motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove?.();
  }, []);
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible && data) {
      setCurrentMomentIndex(0);
      setCurrentDamageIndex(0);
      setPhase('intro');
      setSkipped(false);
      fadeProgress.value = 0;
      momentProgress.value = 0;
      damageScale.value = 0;
      climaxPulse.value = 0;
      hasTrackedView.current = false;
      hasTrackedMoments.current = false;
      hasTrackedDamage.current = false;
      
      // Generate damage numbers
      setDamageNumbers(generateDamageNumbers());
      
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
        momentCount: keyMoments.length,
      });
      hasTrackedView.current = true;
    }
    
    // Phase 4.0: Play battle start SFX
    playSfx('battle_start');
    
    // Animate intro fade-in
    fadeProgress.value = withTiming(1, { duration: reduceMotion ? 100 : 500 });
    
    const introDuration = reduceMotion ? 300 : 800;
    
    // Schedule phase transitions
    setTimeout(() => {
      setPhase('moments');
      runKeyMoments(0);
    }, introDuration);
    
  }, [data, reduceMotion, mode, keyMoments]);
  
  // Phase E2: Run through key moments sequentially
  const runKeyMoments = (momentIdx: number) => {
    if (momentIdx >= keyMoments.length || skipped) {
      // Track key moments shown
      if (!hasTrackedMoments.current) {
        track(Events.PVE_KEY_MOMENT_BEAT_SHOWN, {
          mode,
          momentsShown: keyMoments,
          victory: data?.victory,
        });
        hasTrackedMoments.current = true;
      }
      
      // Move to climax
      setPhase('climax');
      runClimax();
      return;
    }
    
    setCurrentMomentIndex(momentIdx);
    const moment = KEY_MOMENTS[keyMoments[momentIdx]];
    
    // Animate moment progress
    momentProgress.value = withTiming((momentIdx + 1) / keyMoments.length, { 
      duration: moment.duration / 2 
    });
    
    // Show damage number for DAMAGE moment
    if (keyMoments[momentIdx] === 'DAMAGE') {
      showDamageNumbers();
    }
    
    // Animate damage number pop
    damageScale.value = withSequence(
      withTiming(1.3, { duration: 150, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200 })
    );
    
    // Schedule next moment
    const duration = reduceMotion ? moment.duration / 3 : moment.duration;
    setTimeout(() => runKeyMoments(momentIdx + 1), duration);
  };
  
  // Phase E2: Show damage numbers batch
  const showDamageNumbers = () => {
    if (!hasTrackedDamage.current && damageNumbers.length > 0) {
      track(Events.PVE_DAMAGE_NUMBER_BATCH_SHOWN, {
        mode,
        count: damageNumbers.length,
        tags: damageNumbers.map(d => d.tag),
      });
      hasTrackedDamage.current = true;
    }
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
      momentReached: currentMomentIndex,
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
  
  // Get damage number to display for current moment
  const getCurrentDamageNumber = (): { value: number; tag: DamageTag } | null => {
    if (damageNumbers.length === 0) return null;
    const idx = currentMomentIndex % damageNumbers.length;
    return damageNumbers[idx];
  };
  
  // Get color for damage tag
  const getDamageTagColor = (tag: DamageTag): string => {
    switch (tag) {
      case 'CRIT': return COLORS.crit;
      case 'GLANCING': return COLORS.glancing;
      case 'DEVASTATING': return COLORS.devastating;
      case 'BLOCKED': return COLORS.blocked;
      default: return data?.victory ? COLORS.victory : COLORS.defeat;
    }
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
  
  const currentMoment = keyMoments[currentMomentIndex];
  const currentDamage = getCurrentDamageNumber();
  
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
            
            {/* Key Moments Phase */}
            {phase === 'moments' && currentMoment && (
              <View style={styles.phaseContainer}>
                {/* Progress indicator */}
                <View style={styles.turnIndicator}>
                  <Text style={styles.turnText}>
                    Beat {currentMomentIndex + 1}/{keyMoments.length}
                  </Text>
                  <View style={styles.turnBar}>
                    <View style={[
                      styles.turnFill, 
                      { width: `${((currentMomentIndex + 1) / keyMoments.length) * 100}%` }
                    ]} />
                  </View>
                </View>
                
                {/* Key Moment Label */}
                <View style={styles.skillCallout}>
                  <LinearGradient
                    colors={[COLORS.gold.primary + '40', 'transparent']}
                    style={styles.skillGradient}
                  >
                    <Text style={styles.momentLabel}>
                      {KEY_MOMENTS[currentMoment].label}
                    </Text>
                  </LinearGradient>
                </View>
                
                {/* Skill name (for SKILL moment) */}
                {currentMoment === 'SKILL' && (
                  <Text style={styles.skillName}>
                    ✨ {SKILL_CALLOUTS[currentMomentIndex % SKILL_CALLOUTS.length]}
                  </Text>
                )}
                
                {/* Damage number with tag */}
                {currentDamage && (
                  <Animated.View style={[styles.damageContainer, damageStyle]}>
                    {currentDamage.tag !== 'NORMAL' && (
                      <Text style={[styles.damageTag, { color: getDamageTagColor(currentDamage.tag) }]}>
                        {currentDamage.tag}
                      </Text>
                    )}
                    <Text style={[
                      styles.damageNumber, 
                      { color: getDamageTagColor(currentDamage.tag) }
                    ]}>
                      {data.victory ? '-' : '+'}{currentDamage.value.toLocaleString()}
                    </Text>
                  </Animated.View>
                )}
                
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
    marginBottom: 12,
  },
  skillGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  momentLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold.light,
    textAlign: 'center',
  },
  skillName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold.light,
    textAlign: 'center',
    marginBottom: 8,
  },
  damageContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  damageTag: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  damageNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
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
