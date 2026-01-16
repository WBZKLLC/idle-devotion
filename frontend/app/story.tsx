import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
// Phase 3.22.3: Canonical button
import { PrimaryButton } from '../components/ui/PrimaryButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StoryChapter {
  id: number;
  title: string;
  subtitle: string;
  act: number;
  scenes: StoryScene[];
  unlocked: boolean;
  completed: boolean;
}

interface StoryScene {
  id: number;
  background: string;
  dialogues: { speaker: string; text: string; emotion?: string }[];
}

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 1,
    title: 'The Awakening',
    subtitle: 'Where legends begin',
    act: 1,
    unlocked: true,
    completed: false,
    scenes: [
      {
        id: 1,
        background: 'forest',
        dialogues: [
          { speaker: 'Narrator', text: 'In a world where divine beings once walked among mortals...' },
          { speaker: 'Narrator', text: 'A new Summoner awakens to their destiny.' },
          { speaker: '???', text: 'You there... can you hear me?', emotion: 'concerned' },
          { speaker: 'Seraphina', text: 'I am Seraphina, guardian of the Divine Gate. You have been chosen.', emotion: 'calm' },
          { speaker: 'Seraphina', text: 'The darkness stirs once more. Only you can gather the heroes needed to face it.', emotion: 'serious' },
        ],
      },
      {
        id: 2,
        background: 'temple',
        dialogues: [
          { speaker: 'Seraphina', text: 'This is the Temple of Summoning. Here, you can call forth heroes from across the realms.', emotion: 'explaining' },
          { speaker: 'Seraphina', text: 'Use your Divine Essence wisely. Each summon could bring a powerful ally...', emotion: 'hopeful' },
          { speaker: 'Seraphina', text: '...or perhaps, an ancient legend.', emotion: 'mysterious' },
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'The First Trial',
    subtitle: 'Prove your worth',
    act: 1,
    unlocked: false,
    completed: false,
    scenes: [
      {
        id: 1,
        background: 'arena',
        dialogues: [
          { speaker: 'Battle Master', text: 'So, you are the new Summoner everyone speaks of...', emotion: 'skeptical' },
          { speaker: 'Battle Master', text: 'Words are wind. Show me what your heroes can do!', emotion: 'challenging' },
        ],
      },
    ],
  },
  {
    id: 3,
    title: 'Shadows Rising',
    subtitle: 'The enemy reveals itself',
    act: 2,
    unlocked: false,
    completed: false,
    scenes: [],
  },
  {
    id: 4,
    title: 'Alliance',
    subtitle: 'Strength in unity',
    act: 2,
    unlocked: false,
    completed: false,
    scenes: [],
  },
];

export default function StoryScreen() {
  const router = useRouter();
  const { user } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<StoryChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<StoryChapter | null>(null);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hydrated && user) {
      loadStoryProgress();
    }
  }, [hydrated, user?.username]);

  useEffect(() => {
    if (showStoryModal) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]).start();
    }
  }, [showStoryModal, currentDialogueIndex]);

  const loadStoryProgress = async () => {
    setLoading(true);
    try {
      // In production, load progress from API
      await new Promise(r => setTimeout(r, 300));
      
      // Unlock chapters based on campaign progress
      const campaignProgress = user?.campaign_progress || 1;
      const updatedChapters = STORY_CHAPTERS.map(ch => ({
        ...ch,
        unlocked: ch.id <= campaignProgress,
        completed: ch.id < campaignProgress,
      }));
      
      setChapters(updatedChapters);
    } catch (error) {
      console.error('Error loading story:', error);
      setChapters(STORY_CHAPTERS);
    } finally {
      setLoading(false);
    }
  };

  const startChapter = (chapter: StoryChapter) => {
    if (!chapter.unlocked) return;
    
    setSelectedChapter(chapter);
    setCurrentSceneIndex(0);
    setCurrentDialogueIndex(0);
    fadeAnim.setValue(0);
    textAnim.setValue(0);
    setShowStoryModal(true);
  };

  const advanceDialogue = () => {
    if (!selectedChapter) return;
    
    const currentScene = selectedChapter.scenes[currentSceneIndex];
    if (!currentScene) {
      setShowStoryModal(false);
      return;
    }
    
    if (currentDialogueIndex < currentScene.dialogues.length - 1) {
      setCurrentDialogueIndex(prev => prev + 1);
      textAnim.setValue(0);
      Animated.timing(textAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } else if (currentSceneIndex < selectedChapter.scenes.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
      setCurrentDialogueIndex(0);
      fadeAnim.setValue(0);
      textAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]).start();
    } else {
      // Chapter complete
      setShowStoryModal(false);
      setChapters(prev => prev.map(ch => 
        ch.id === selectedChapter.id ? { ...ch, completed: true } : ch
      ));
    }
  };

  const getActColor = (act: number): readonly [string, string] => {
    switch (act) {
      case 1: return ['#3b82f6', '#1e40af'] as const;
      case 2: return ['#dc2626', '#7f1d1d'] as const;
      case 3: return ['#fbbf24', '#b45309'] as const;
      case 4: return ['#8b5cf6', '#4c1d95'] as const;
      default: return [COLORS.navy.medium, COLORS.navy.primary] as const;
    }
  };

  const getBackgroundGradient = (bg: string): readonly [string, string] => {
    switch (bg) {
      case 'forest': return ['#064e3b', '#022c22'] as const;
      case 'temple': return ['#44403c', '#1c1917'] as const;
      case 'arena': return ['#7f1d1d', '#450a0a'] as const;
      case 'castle': return ['#1e3a5f', '#0d1b2a'] as const;
      default: return [COLORS.navy.dark, COLORS.navy.darkest] as const;
    }
  };

  // Locked chapter gradient
  const LOCKED_CHAPTER = ['#1a1a1a', '#0a0a0a'] as const;

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading Story...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentDialogue = selectedChapter?.scenes[currentSceneIndex]?.dialogues[currentDialogueIndex];

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📜 Story Mode</Text>
          <TouchableOpacity onPress={() => router.push('/campaign')}>
            <Ionicons name="map" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
        </View>

        {/* Story hint */}
        <View style={styles.hintBanner}>
          <Ionicons name="information-circle" size={16} color={COLORS.gold.light} />
          <Text style={styles.hintText}>Complete Campaign stages to unlock more story chapters</Text>
        </View>

        {/* Chapters List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {chapters.map(chapter => (
            <TouchableOpacity
              key={chapter.id}
              style={[styles.chapterCard, !chapter.unlocked && styles.chapterLocked]}
              onPress={() => startChapter(chapter)}
              disabled={!chapter.unlocked || chapter.scenes.length === 0}
            >
              <LinearGradient
                colors={chapter.unlocked ? getActColor(chapter.act) : LOCKED_CHAPTER}
                style={styles.chapterGradient}
              >
                {/* Lock overlay */}
                {!chapter.unlocked && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={28} color={COLORS.cream.dark} />
                    <Text style={styles.lockText}>Complete Campaign Ch.{chapter.id - 1}</Text>
                  </View>
                )}

                <View style={styles.chapterHeader}>
                  <View style={styles.actBadge}>
                    <Text style={styles.actText}>ACT {chapter.act}</Text>
                  </View>
                  {chapter.completed && (
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  )}
                </View>

                <Text style={styles.chapterNumber}>Chapter {chapter.id}</Text>
                <Text style={styles.chapterTitle}>{chapter.title}</Text>
                <Text style={styles.chapterSubtitle}>{chapter.subtitle}</Text>

                {chapter.unlocked && chapter.scenes.length > 0 && (
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.playText}>{chapter.completed ? 'Replay' : 'Play'}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Story Modal */}
        <Modal visible={showStoryModal} transparent animationType="fade" onRequestClose={() => setShowStoryModal(false)}>
          <TouchableOpacity style={styles.storyOverlay} activeOpacity={1} onPress={advanceDialogue}>
            <LinearGradient
              colors={getBackgroundGradient(selectedChapter?.scenes[currentSceneIndex]?.background || 'default')}
              style={styles.storyBackground}
            >
              {/* Close button */}
              <TouchableOpacity style={styles.storyClose} onPress={() => setShowStoryModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              {/* Dialogue box */}
              <Animated.View style={[styles.dialogueBox, { opacity: textAnim }]}>
                <View style={styles.dialogueSpeakerBadge}>
                  <Text style={styles.dialogueSpeaker}>{currentDialogue?.speaker}</Text>
                </View>
                <Text style={styles.dialogueText}>"{currentDialogue?.text}"</Text>
                <Text style={styles.tapHint}>Tap to continue...</Text>
                
                {/* Progress */}
                <View style={styles.storyProgress}>
                  <Text style={styles.storyProgressText}>
                    Scene {currentSceneIndex + 1}/{selectedChapter?.scenes.length || 0} • {currentDialogueIndex + 1}/{selectedChapter?.scenes[currentSceneIndex]?.dialogues.length || 0}
                  </Text>
                </View>
              </Animated.View>
            </LinearGradient>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  loginBtn: { marginTop: 16, backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: COLORS.navy.darkest, fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gold.primary + '30' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },

  hintBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.gold.primary + '20' },
  hintText: { fontSize: 12, color: COLORS.gold.light, flex: 1 },

  content: { flex: 1, padding: 16 },
  chapterCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  chapterLocked: { opacity: 0.7 },
  chapterGradient: { padding: 20, minHeight: 140 },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: 16 },
  lockText: { color: COLORS.cream.dark, marginTop: 8, fontSize: 12 },
  chapterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  actBadge: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  actText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  chapterNumber: { fontSize: 11, color: '#ffffffaa', marginBottom: 4 },
  chapterTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  chapterSubtitle: { fontSize: 13, color: '#ffffffcc', fontStyle: 'italic' },
  playButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, backgroundColor: 'rgba(0,0,0,0.3)', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  playText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  storyOverlay: { flex: 1 },
  storyBackground: { flex: 1, justifyContent: 'flex-end' },
  storyClose: { position: 'absolute', top: 60, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  dialogueBox: { backgroundColor: 'rgba(0,0,0,0.85)', marginHorizontal: 16, marginBottom: 40, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.gold.primary + '50' },
  dialogueSpeakerBadge: { position: 'absolute', top: -12, left: 16, backgroundColor: COLORS.gold.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  dialogueSpeaker: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy.darkest },
  dialogueText: { fontSize: 16, color: COLORS.cream.pure, lineHeight: 24, marginTop: 8, fontStyle: 'italic' },
  tapHint: { fontSize: 11, color: COLORS.cream.dark, marginTop: 16, textAlign: 'center' },
  storyProgress: { marginTop: 12, alignItems: 'center' },
  storyProgressText: { fontSize: 10, color: COLORS.cream.dark },
});