import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function SummonHubScreen() {
  return (
    <LinearGradient colors={['#FF1493', '#FF69B4', '#FFB6C1']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>🎁 Summon Hub</Text>
          <Text style={styles.subtitle}>Choose your summoning method</Text>
          
          <View style={styles.summonOptions}>
            <TouchableOpacity 
              style={styles.summonButton}
              onPress={() => router.push('/gacha')}
            >
              <LinearGradient
                colors={['#FF1493', '#9400D3']}
                style={styles.summonButtonGradient}
              >
                <Ionicons name="diamond" size={40} color="#FFF" />
                <Text style={styles.summonButtonTitle}>Gem Summon</Text>
                <Text style={styles.summonButtonSubtitle}>Premium Heroes</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.summonButton}
              onPress={() => router.push('/gacha')}
            >
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                style={styles.summonButtonGradient}
              >
                <Ionicons name="cash" size={40} color="#FFF" />
                <Text style={styles.summonButtonTitle}>Coin Summon</Text>
                <Text style={styles.summonButtonSubtitle}>Standard Heroes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 48,
    opacity: 0.9,
  },
  summonOptions: {
    width: '100%',
    gap: 24,
  },
  summonButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  summonButtonGradient: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  summonButtonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  summonButtonSubtitle: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
  },
});