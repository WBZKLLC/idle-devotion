# Live2D Motion System - Usage Examples

This document provides code examples for common integration scenarios.

**IMPORTANT:** All examples follow the architectural constraint that Expo dispatches state signals ONLY. No animation logic exists in Expo.

---

## Table of Contents

1. [Basic State Dispatch](#1-basic-state-dispatch)
2. [Hero Detail Screen](#2-hero-detail-screen)
3. [Battle State Management](#3-battle-state-management)
4. [Banner Reveal Sequence](#4-banner-reveal-sequence)
5. [Intensity and Speed Control](#5-intensity-and-speed-control)
6. [Responding to Motion Events](#6-responding-to-motion-events)

---

## 1. Basic State Dispatch

### Simple State Change

```typescript
import { useMotionState } from '../hooks/useMotionState';
import { MotionState } from '../constants/motionStates';

function CharacterView() {
  const { setState, status } = useMotionState();

  const handleEnterCombat = () => {
    // Dispatch state command - NO animation logic here
    setState(MotionState.COMBAT);
  };

  const handleReturnToIdle = () => {
    setState(MotionState.IDLE);
  };

  return (
    <View>
      <Text>Current State: {status.currentState || 'unknown'}</Text>
      <Button title="Enter Combat" onPress={handleEnterCombat} />
      <Button title="Return to Idle" onPress={handleReturnToIdle} />
    </View>
  );
}
```

### Using Convenience Methods

```typescript
import { useMotionState } from '../hooks/useMotionState';

function QuickActions() {
  const { 
    enterIdle, 
    enterCombat, 
    enterVictory, 
    enterDefeat 
  } = useMotionState();

  return (
    <View>
      <Button title="Idle" onPress={() => enterIdle()} />
      <Button title="Combat" onPress={() => enterCombat()} />
      <Button title="Victory" onPress={() => enterVictory()} />
      <Button title="Defeat" onPress={() => enterDefeat()} />
    </View>
  );
}
```

---

## 2. Hero Detail Screen

### Passing Hero Metadata for Profile Resolution

```typescript
import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { useMotionState } from '../hooks/useMotionState';
import { MotionState } from '../constants/motionStates';

interface HeroDetailProps {
  hero: {
    id: string;
    name: string;
    heroClass: string;
    rarity: string;
    imageUrl: string;
  };
}

function HeroDetailScreen({ hero }: HeroDetailProps) {
  const { setState, status } = useMotionState();

  // Set idle state with hero metadata when screen loads
  // Unity will use metadata to select appropriate profile variant
  useEffect(() => {
    setState(MotionState.IDLE, {
      heroId: hero.id,
      heroClass: hero.heroClass,
      rarity: hero.rarity,
    });
  }, [hero.id]);

  return (
    <View style={{ flex: 1 }}>
      {/* Static image - Unity handles Live2D animation separately */}
      <Image source={{ uri: hero.imageUrl }} style={{ width: 200, height: 300 }} />
      
      <Text>{hero.name}</Text>
      <Text>Class: {hero.heroClass}</Text>
      <Text>Rarity: {hero.rarity}</Text>
      <Text>Motion Profile: {status.lastProfileId}</Text>
    </View>
  );
}
```

---

## 3. Battle State Management

### Combat State Transitions

```typescript
import React, { useCallback } from 'react';
import { View, Button, Alert } from 'react-native';
import { useMotionState } from '../hooks/useMotionState';

interface BattleScreenProps {
  heroId: string;
  heroClass: string;
  rarity: string;
}

function BattleScreen({ heroId, heroClass, rarity }: BattleScreenProps) {
  const { 
    enterCombat, 
    enterVictory, 
    enterDefeat, 
    enterIdle 
  } = useMotionState();

  const heroMetadata = { heroId, heroClass, rarity };

  // Enter combat when battle starts
  const handleBattleStart = useCallback(() => {
    enterCombat(heroMetadata);
  }, [heroId]);

  // Handle battle outcome
  const handleBattleEnd = useCallback((won: boolean) => {
    if (won) {
      enterVictory(heroMetadata);
      Alert.alert('Victory!', 'You won the battle!');
    } else {
      enterDefeat(heroMetadata);
      Alert.alert('Defeat', 'Try again!');
    }

    // Return to idle after delay
    // NOTE: Timing is UI-only, not animation timing
    setTimeout(() => {
      enterIdle(heroMetadata);
    }, 3000);
  }, [heroId]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button title="Start Battle" onPress={handleBattleStart} />
      <Button title="Simulate Win" onPress={() => handleBattleEnd(true)} />
      <Button title="Simulate Loss" onPress={() => handleBattleEnd(false)} />
    </View>
  );
}
```

---

## 4. Banner Reveal Sequence

### Summon Screen with Anticipation → Reveal

```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMotionState, useMotionEvent } from '../hooks/useMotionState';

interface SummonedHero {
  id: string;
  name: string;
  rarity: string;
  heroClass: string;
}

function SummonScreen() {
  const { enterSummon, enterBanner, enterIdle, status } = useMotionState();
  const [phase, setPhase] = useState<'ready' | 'summoning' | 'revealing' | 'complete'>('ready');
  const [summonedHero, setSummonedHero] = useState<SummonedHero | null>(null);

  // Listen for blend complete to know when reveal animation is done
  useMotionEvent('BLEND_COMPLETE', () => {
    if (phase === 'revealing') {
      setPhase('complete');
    }
  });

  const handleSummon = useCallback(async () => {
    setPhase('summoning');
    
    // 1. Enter anticipation state
    enterSummon();

    // 2. Simulate summon API call
    // NOTE: This timing is API wait time, NOT animation timing
    const hero = await fakeSummonAPI();
    setSummonedHero(hero);

    // 3. Transition to banner reveal with hero metadata
    setPhase('revealing');
    enterBanner({
      heroId: hero.id,
      heroClass: hero.heroClass,
      rarity: hero.rarity,
    });
  }, []);

  const handleDismiss = useCallback(() => {
    setPhase('ready');
    setSummonedHero(null);
    enterIdle();
  }, []);

  return (
    <View style={styles.container}>
      {phase === 'ready' && (
        <TouchableOpacity style={styles.summonButton} onPress={handleSummon}>
          <Text style={styles.buttonText}>SUMMON</Text>
        </TouchableOpacity>
      )}

      {phase === 'summoning' && (
        <Text style={styles.statusText}>Summoning...</Text>
      )}

      {phase === 'revealing' && summonedHero && (
        <View style={styles.revealContainer}>
          <Text style={styles.heroName}>{summonedHero.name}</Text>
          <Text style={styles.heroRarity}>{summonedHero.rarity}</Text>
        </View>
      )}

      {phase === 'complete' && summonedHero && (
        <View style={styles.resultContainer}>
          <Text style={styles.heroName}>{summonedHero.name}</Text>
          <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
            <Text>OK</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.debugText}>Profile: {status.lastProfileId}</Text>
    </View>
  );
}

// Fake API for example
async function fakeSummonAPI(): Promise<SummonedHero> {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return {
    id: 'hero_selene',
    name: 'Chrono-Archangel Selene',
    rarity: 'UR',
    heroClass: 'Mage',
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summonButton: { padding: 20, backgroundColor: '#8B5CF6', borderRadius: 10 },
  buttonText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  statusText: { fontSize: 18 },
  revealContainer: { alignItems: 'center' },
  resultContainer: { alignItems: 'center' },
  heroName: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  heroRarity: { fontSize: 20, color: '#FFD700' },
  dismissButton: { marginTop: 20, padding: 10, backgroundColor: '#333', borderRadius: 5 },
  debugText: { position: 'absolute', bottom: 20, fontSize: 12, color: '#666' },
});
```

---

## 5. Intensity and Speed Control

### Settings Screen with Motion Adjustments

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useMotionState } from '../hooks/useMotionState';
import { INTENSITY_BOUNDS, SPEED_BOUNDS } from '../constants/motionStates';

function MotionSettingsScreen() {
  const { setIntensity, setSpeed, status } = useMotionState();
  const [intensity, setLocalIntensity] = useState(INTENSITY_BOUNDS.DEFAULT);
  const [speed, setLocalSpeed] = useState(SPEED_BOUNDS.DEFAULT);

  const handleIntensityChange = (value: number) => {
    setLocalIntensity(value);
    setIntensity(value); // Dispatch to Unity
  };

  const handleSpeedChange = (value: number) => {
    setLocalSpeed(value);
    setSpeed(value); // Dispatch to Unity
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Motion Settings</Text>

      <View style={styles.sliderContainer}>
        <Text>Intensity: {intensity.toFixed(2)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={INTENSITY_BOUNDS.MIN}
          maximumValue={INTENSITY_BOUNDS.MAX}
          value={intensity}
          onValueChange={handleIntensityChange}
        />
        <Text style={styles.hint}>
          0 = No motion, 1 = Normal, 2 = Enhanced
        </Text>
      </View>

      <View style={styles.sliderContainer}>
        <Text>Speed: {speed.toFixed(2)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={SPEED_BOUNDS.MIN}
          maximumValue={SPEED_BOUNDS.MAX}
          value={speed}
          onValueChange={handleSpeedChange}
        />
        <Text style={styles.hint}>
          0.1 = Slow, 1 = Normal, 3 = Fast
        </Text>
      </View>

      <Text style={styles.debug}>
        Connected: {status.isConnected ? 'Yes' : 'No'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  sliderContainer: { marginBottom: 30 },
  slider: { width: '100%', height: 40 },
  hint: { fontSize: 12, color: '#666', marginTop: 5 },
  debug: { marginTop: 20, color: '#999' },
});
```

---

## 6. Responding to Motion Events

### Listening for State Changes

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useMotionState, useMotionEvent } from '../hooks/useMotionState';
import { UnityToExpoMessage } from '../types/motionTypes';

function MotionEventLog() {
  const { status } = useMotionState();
  const [events, setEvents] = useState<string[]>([]);

  // Log all state changes
  useMotionEvent('STATE_CHANGED', (message) => {
    if (message.type === 'STATE_CHANGED') {
      const timestamp = new Date().toLocaleTimeString();
      setEvents(prev => [
        `[${timestamp}] State: ${message.state}, Profile: ${message.profileId}`,
        ...prev.slice(0, 19), // Keep last 20 events
      ]);
    }
  });

  // Log blend completions
  useMotionEvent('BLEND_COMPLETE', () => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [
      `[${timestamp}] Blend transition complete`,
      ...prev.slice(0, 19),
    ]);
  });

  // Log errors
  useMotionEvent('ERROR', (message) => {
    if (message.type === 'ERROR') {
      const timestamp = new Date().toLocaleTimeString();
      setEvents(prev => [
        `[${timestamp}] ERROR: ${message.message}`,
        ...prev.slice(0, 19),
      ]);
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Motion Event Log</Text>
      <Text style={styles.status}>
        Current: {status.currentState || 'none'} | Profile: {status.lastProfileId || 'none'}
      </Text>
      <FlatList
        data={events}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.event}>{item}</Text>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  status: { fontSize: 14, color: '#666', marginBottom: 10 },
  list: { flex: 1 },
  event: { fontSize: 12, fontFamily: 'monospace', paddingVertical: 2 },
});
```

---

## Important Notes

### What These Examples DO:
- ✅ Dispatch state signals to Unity
- ✅ Pass hero metadata for profile resolution
- ✅ Respond to Unity status updates
- ✅ Control intensity and speed overrides
- ✅ Track current motion state

### What These Examples DO NOT:
- ❌ Contain animation logic
- ❌ Interpolate or ease values
- ❌ Parse motion profiles
- ❌ Resolve profiles (Unity does this)
- ❌ Touch Live2D parameters
- ❌ Specify animation timing/duration

---

## See Also

- [Final Architecture](./FINAL_ARCHITECTURE.md)
- [Integration Checklist](./INTEGRATION_CHECKLIST.md)
- [Phase 2 Specification](./PHASE2_SPECIFICATION.md) (Schema details)
- [Phase 3 Implementation](./PHASE3_IMPLEMENTATION.md) (Unity driver details)
