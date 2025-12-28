import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function StoryScreen() {
  return (
    <LinearGradient colors={['#9370DB', '#8B008B', '#FF1493']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>📖 Story Mode</Text>
          <Text style={styles.subtitle}>Coming Soon!</Text>
          <Text style={styles.description}>
            Embark on epic adventures through mystical realms and uncover the secrets of the Divine Heroes.
          </Text>
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
    fontSize: 24,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
  },
  description: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },
});