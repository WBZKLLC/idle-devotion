import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useGameStore, useHydration } from '../stores/gameStore';
import { isErrorHandledGlobally } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { router } from 'expo-router';
// Phase 3.18.7: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';

// Centralized API wrappers (no raw fetch in screens)
import { startDetailedCombat } from '../lib/api';

interface CombatTurn {
  turn: number;
  actor: string;
  actor_class: string;
  target: string;
  action_type: string;
  damage: number;
  skill_name?: string;
  is_critical: boolean;
  remaining_hp_actor: number;
  remaining_hp_target: number;
}

interface CombatResult {
  victory: boolean;
  team_power: number;
  enemy_power: number;
  turns: CombatTurn[];
  total_damage_dealt: number;
  total_damage_taken: number;
  hero_final_states: Array<{ name: string; hp: number; max_hp: number }>;
  enemy_final_states: Array<{ name: string; hp: number; max_hp: number }>;
  battle_duration_seconds: number;
  narration?: string;
  rewards: { gold?: number; exp?: number; coins?: number };
}

export default function CombatScreen() {
  const { user } = useGameStore();
  const hydrated = useHydration();
  const [isLoading, setIsLoading] = useState(false);
  const [isBattling, setIsBattling] = useState(false);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [showingTurns, setShowingTurns] = useState(false);
  const [selectedEnemy, setSelectedEnemy] = useState<{ name: string; power: number }>({
    name: 'Shadow Knight',
    power: 1500,
  });

  // Animation refs
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const damageScaleAnim = useRef(new Animated.Value(0)).current;
  const victoryAnim = useRef(new Animated.Value(0)).current;

  const enemies = [
    { name: 'Shadow Knight', power: 1500, element: 'Dark' },
    { name: 'Fire Dragon', power: 3000, element: 'Fire' },
    { name: 'Storm Titan', power: 5000, element: 'Lightning' },
    { name: 'Void Emperor', power: 8000, element: 'Dark' },
    { name: 'Celestial Guardian', power: 12000, element: 'Light' },
  ];

  const startBattle = async () => {
    if (!user) return;
    
    setIsBattling(true);
    setIsLoading(true);
    setCombatResult(null);
    setCurrentTurnIndex(0);
    setShowingTurns(false);

    try {
      // Use centralized API wrapper
      const result: CombatResult = await startDetailedCombat(user.username, selectedEnemy.name, selectedEnemy.power);
      setCombatResult(result);
      setShowingTurns(true);
      playTurnAnimations(result.turns);
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        Alert.alert('Error', error?.message || 'Failed to start battle');
      }
      setIsBattling(false);
    } finally {
      setIsLoading(false);
    }
  };

  const playTurnAnimations = async (turns: CombatTurn[]) => {
    for (let i = 0; i < turns.length; i++) {
      setCurrentTurnIndex(i);
      
      // Play attack animation
      playAttackAnimation(turns[i].is_critical);
      
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Battle complete
    setShowingTurns(false);
    playVictoryAnimation();
  };

  const playAttackAnimation = (isCritical: boolean) => {
    // Shake animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    // Flash for critical
    if (isCritical) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }

    // Damage popup
    damageScaleAnim.setValue(0);
    Animated.spring(damageScaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const playVictoryAnimation = () => {
    Animated.timing(victoryAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
  };

  const getCurrentTurn = () => {
    if (!combatResult || currentTurnIndex >= combatResult.turns.length) return null;
    return combatResult.turns[currentTurnIndex];
  };

  const getClassColor = (heroClass: string) => {
    switch (heroClass) {
      case 'Warrior': return '#e74c3c';
      case 'Mage': return '#9b59b6';
      case 'Archer': return '#27ae60';
      default: return COLORS.gold.primary;
    }
  };

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/')}>
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentTurn = getCurrentTurn();

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.title}>⚔️ Combat Arena</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Battle Arena */}
          <Animated.View 
            style={[
              styles.battleArena,
              { transform: [{ translateX: shakeAnim }] }
            ]}
          >
            {/* Critical Flash Overlay */}
            <Animated.View 
              style={[
                styles.flashOverlay,
                { opacity: flashAnim }
              ]} 
              pointerEvents="none"
            />

            {/* Enemy Side */}
            <View style={styles.enemySide}>
              <Text style={styles.sideLabel}>ENEMY</Text>
              {isBattling && combatResult ? (
                <View style={styles.combatantGrid}>
                  {combatResult.enemy_final_states.map((enemy, idx) => (
                    <View key={idx} style={styles.combatantCard}>
                      <Ionicons name="skull" size={28} color="#e74c3c" />
                      <Text style={styles.combatantName} numberOfLines={1}>{enemy.name}</Text>
                      <View style={styles.hpBarOuter}>
                        <View 
                          style={[
                            styles.hpBarFill, 
                            { 
                              width: `${(enemy.hp / enemy.max_hp) * 100}%`,
                              backgroundColor: enemy.hp > 0 ? '#e74c3c' : '#555'
                            }
                          ]} 
                        />
                      </View>
                      <Text style={styles.hpText}>{enemy.hp}/{enemy.max_hp}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.enemySelect}>
                  <TouchableOpacity style={styles.selectedEnemy}>
                    <LinearGradient
                      colors={['#e74c3c', '#c0392b']}
                      style={styles.enemyGradient}
                    >
                      <Ionicons name="skull" size={40} color={COLORS.cream.pure} />
                      <Text style={styles.enemyName}>{selectedEnemy.name}</Text>
                      <Text style={styles.enemyPower}>Power: {selectedEnemy.power.toLocaleString()}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* VS Divider */}
            <View style={styles.vsDivider}>
              {showingTurns && currentTurn && (
                <Animated.View 
                  style={[
                    styles.turnIndicator,
                    { transform: [{ scale: damageScaleAnim }] }
                  ]}
                >
                  <Text style={[
                    styles.damageText,
                    currentTurn.is_critical && styles.criticalText
                  ]}>
                    {currentTurn.is_critical ? '💥 CRIT! ' : ''}{currentTurn.damage}
                  </Text>
                  <Text style={styles.turnAction}>
                    {currentTurn.actor} → {currentTurn.target}
                  </Text>
                  {currentTurn.skill_name && (
                    <Text style={styles.skillName}>✨ {currentTurn.skill_name}</Text>
                  )}
                </Animated.View>
              )}
              {!showingTurns && !combatResult && (
                <Text style={styles.vsText}>VS</Text>
              )}
            </View>

            {/* Hero Side */}
            <View style={styles.heroSide}>
              <Text style={styles.sideLabel}>YOUR TEAM</Text>
              {isBattling && combatResult ? (
                <View style={styles.combatantGrid}>
                  {combatResult.hero_final_states.map((hero, idx) => (
                    <View key={idx} style={styles.combatantCard}>
                      <Ionicons name="person" size={28} color={COLORS.gold.primary} />
                      <Text style={styles.combatantName} numberOfLines={1}>{hero.name}</Text>
                      <View style={styles.hpBarOuter}>
                        <View 
                          style={[
                            styles.hpBarFill, 
                            { 
                              width: `${(hero.hp / hero.max_hp) * 100}%`,
                              backgroundColor: hero.hp > 0 ? COLORS.success : '#555'
                            }
                          ]} 
                        />
                      </View>
                      <Text style={styles.hpText}>{hero.hp}/{hero.max_hp}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.heroPreview}>
                  <Ionicons name="people" size={40} color={COLORS.gold.primary} />
                  <Text style={styles.heroPreviewText}>Your Active Team</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Battle Result */}
          {combatResult && !showingTurns && (
            <Animated.View 
              style={[
                styles.resultCard,
                { 
                  opacity: victoryAnim,
                  transform: [{ scale: victoryAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={combatResult.victory 
                  ? [COLORS.success, '#27ae60'] 
                  : ['#e74c3c', '#c0392b']
                }
                style={styles.resultGradient}
              >
                <Text style={styles.resultTitle}>
                  {combatResult.victory ? '🎉 VICTORY!' : '💀 DEFEAT'}
                </Text>
                
                {combatResult.narration && (
                  <View style={styles.narrationBox}>
                    <Ionicons name="chatbubble" size={16} color={COLORS.cream.soft} />
                    <Text style={styles.narrationText}>{combatResult.narration}</Text>
                  </View>
                )}
                
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Damage Dealt</Text>
                    <Text style={styles.statValue}>{combatResult.total_damage_dealt.toLocaleString()}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Damage Taken</Text>
                    <Text style={styles.statValue}>{combatResult.total_damage_taken.toLocaleString()}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Turns</Text>
                    <Text style={styles.statValue}>{combatResult.turns.length}</Text>
                  </View>
                </View>
                
                {combatResult.rewards && Object.keys(combatResult.rewards).length > 0 && (
                  <View style={styles.rewardsBox}>
                    <Text style={styles.rewardsTitle}>🎁 Rewards</Text>
                    <View style={styles.rewardsRow}>
                      {combatResult.rewards.gold && (
                        <Text style={styles.rewardItem}>
                          ⭐ {combatResult.rewards.gold.toLocaleString()} Gold
                        </Text>
                      )}
                      {combatResult.rewards.coins && (
                        <Text style={styles.rewardItem}>
                          🪙 {combatResult.rewards.coins.toLocaleString()} Coins
                        </Text>
                      )}
                      {combatResult.rewards.exp && (
                        <Text style={styles.rewardItem}>
                          ✨ {combatResult.rewards.exp.toLocaleString()} EXP
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </LinearGradient>
            </Animated.View>
          )}

          {/* Enemy Selection */}
          {!isBattling && (
            <View style={styles.enemySelection}>
              <Text style={styles.sectionTitle}>Select Enemy</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {enemies.map((enemy, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.enemyOption,
                      selectedEnemy.name === enemy.name && styles.enemyOptionSelected
                    ]}
                    onPress={() => setSelectedEnemy(enemy)}
                  >
                    <Ionicons name="skull" size={24} color={selectedEnemy.name === enemy.name ? COLORS.navy.darkest : COLORS.cream.soft} />
                    <Text style={[
                      styles.enemyOptionName,
                      selectedEnemy.name === enemy.name && styles.enemyOptionNameSelected
                    ]}>
                      {enemy.name}
                    </Text>
                    <Text style={[
                      styles.enemyOptionPower,
                      selectedEnemy.name === enemy.name && styles.enemyOptionPowerSelected
                    ]}>
                      ⚔️ {enemy.power.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Battle Button */}
          <TouchableOpacity
            style={[styles.battleButton, (isLoading || showingTurns) && styles.battleButtonDisabled]}
            onPress={isBattling ? () => { setIsBattling(false); setCombatResult(null); } : startBattle}
            disabled={isLoading || showingTurns}
          >
            <LinearGradient
              colors={isBattling ? ['#7f8c8d', '#95a5a6'] : [COLORS.gold.primary, COLORS.gold.dark]}
              style={styles.battleButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.navy.darkest} />
              ) : (
                <>
                  <Ionicons 
                    name={isBattling ? "close" : "flash"} 
                    size={24} 
                    color={COLORS.navy.darkest} 
                  />
                  <Text style={styles.battleButtonText}>
                    {isBattling ? 'Exit Battle' : 'START BATTLE'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  placeholder: { width: 40 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 100 },
  
  // Battle Arena
  battleArena: {
    backgroundColor: COLORS.navy.medium,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.gold.dark,
    minHeight: 400,
    position: 'relative',
    overflow: 'hidden',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.gold.primary,
    zIndex: 10,
  },
  
  // Sides
  enemySide: { marginBottom: 20 },
  heroSide: { marginTop: 20 },
  sideLabel: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: COLORS.cream.dark, 
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 2,
  },
  
  // Enemy Select
  enemySelect: { alignItems: 'center' },
  selectedEnemy: { borderRadius: 16, overflow: 'hidden' },
  enemyGradient: { 
    padding: 20, 
    alignItems: 'center', 
    minWidth: 200,
    borderRadius: 16,
  },
  enemyName: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  enemyPower: { fontSize: 14, color: COLORS.cream.soft },
  
  // Hero Preview
  heroPreview: { 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: COLORS.navy.primary + '50',
    borderRadius: 12,
  },
  heroPreviewText: { fontSize: 14, color: COLORS.cream.soft, marginTop: 8 },
  
  // Combatant Grid
  combatantGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center',
    gap: 8,
  },
  combatantCard: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    width: 90,
  },
  combatantName: { fontSize: 10, color: COLORS.cream.soft, marginTop: 4, textAlign: 'center' },
  hpBarOuter: { 
    width: '100%', 
    height: 6, 
    backgroundColor: COLORS.navy.darkest, 
    borderRadius: 3, 
    marginTop: 4,
    overflow: 'hidden',
  },
  hpBarFill: { height: '100%', borderRadius: 3 },
  hpText: { fontSize: 8, color: COLORS.cream.dark, marginTop: 2 },
  
  // VS Divider
  vsDivider: { 
    alignItems: 'center', 
    justifyContent: 'center',
    minHeight: 80,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.gold.dark + '30',
    marginVertical: 10,
    paddingVertical: 10,
  },
  vsText: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: COLORS.gold.primary,
    textShadowColor: COLORS.gold.dark,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  
  // Turn Indicator
  turnIndicator: { alignItems: 'center' },
  damageText: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: COLORS.cream.pure,
  },
  criticalText: { 
    color: COLORS.gold.primary,
    fontSize: 32,
  },
  turnAction: { fontSize: 14, color: COLORS.cream.soft, marginTop: 4 },
  skillName: { fontSize: 12, color: COLORS.gold.light, marginTop: 2 },
  
  // Result Card
  resultCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  resultGradient: {
    padding: 24,
    alignItems: 'center',
  },
  resultTitle: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 16 },
  
  // Narration
  narrationBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  narrationText: { 
    flex: 1, 
    fontSize: 14, 
    color: COLORS.cream.soft, 
    fontStyle: 'italic',
    lineHeight: 20,
  },
  
  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: COLORS.cream.soft },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  
  // Rewards
  rewardsBox: { 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    padding: 16, 
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  rewardsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  rewardsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  rewardItem: { fontSize: 14, color: COLORS.cream.soft },
  
  // Enemy Selection
  enemySelection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  enemyOption: {
    backgroundColor: COLORS.navy.medium,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 2,
    borderColor: COLORS.navy.light,
  },
  enemyOptionSelected: {
    backgroundColor: COLORS.gold.primary,
    borderColor: COLORS.gold.primary,
  },
  enemyOptionName: { fontSize: 12, color: COLORS.cream.soft, marginTop: 4, fontWeight: '600' },
  enemyOptionNameSelected: { color: COLORS.navy.darkest },
  enemyOptionPower: { fontSize: 10, color: COLORS.cream.dark, marginTop: 2 },
  enemyOptionPowerSelected: { color: COLORS.navy.dark },
  
  // Battle Button
  battleButton: { borderRadius: 30, overflow: 'hidden' },
  battleButtonDisabled: { opacity: 0.6 },
  battleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  battleButtonText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: COLORS.navy.darkest,
    letterSpacing: 1,
  },
  
  // Error states
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
  loginButton: {
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  loginButtonText: { color: COLORS.navy.darkest, fontSize: 16, fontWeight: 'bold' },
});
