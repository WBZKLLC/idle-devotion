// /app/frontend/app/awakening-preview.tsx
// Aspirational UX screen showing locked 7★–10★ awakening tiers
// Design-only - NO backend calls

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

// 2Dlive shell
import {
  CenteredBackground,
  DivineOverlays,
  SanctumAtmosphere,
  GlassCard,
} from '../components/DivineShell';

const SANCTUM_BG = require('../assets/backgrounds/sanctum_environment_01.jpg');

// Future awakening tiers (teaser content)
const AWAKENING_TIERS = [
  {
    tier: 7,
    label: '7★',
    title: 'Awakened Form',
    description: 'First awakening unlocks enhanced abilities and new visual effects.',
    requirement: 'Requires 6★ hero + Awakening Shards',
    bonuses: ['+15% All Stats', 'Skill Enhancement I', 'Aura Effect'],
    color: '#7B68EE',
  },
  {
    tier: 8,
    label: '8★',
    title: 'Ascendant Form',
    description: 'Further awakening grants powerful passive abilities.',
    requirement: 'Requires 7★ hero + Rare Awakening Shards',
    bonuses: ['+25% All Stats', 'Skill Enhancement II', 'Combat Aura'],
    color: '#9370DB',
  },
  {
    tier: 9,
    label: '9★',
    title: 'Transcendent Form',
    description: 'Near-ultimate power with exclusive cinematic evolutions.',
    requirement: 'Requires 8★ hero + Epic Awakening Shards',
    bonuses: ['+40% All Stats', 'Ultimate Skill', 'Divine Aura', 'New Cinematic'],
    color: '#BA55D3',
  },
  {
    tier: 10,
    label: '10★',
    title: 'Divine Form',
    description: 'The pinnacle of power. Witness the hero\'s true divine form.',
    requirement: 'Requires 9★ hero + Legendary Awakening Shards',
    bonuses: ['+60% All Stats', 'Divine Skill', 'Celestial Aura', 'Ultimate Cinematic', 'Exclusive Skin'],
    color: '#FFD700',
  },
];

export default function AwakeningPreviewScreen() {
  return (
    <View style={styles.container}>
      {/* Background */}
      <CenteredBackground source={SANCTUM_BG} mode="cover" zoom={1.15} opacity={0.35} />
      <DivineOverlays grain vignette />
      <SanctumAtmosphere />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Awakening System</Text>
            <Text style={styles.subtitle}>Future Content Preview</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.scroll} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Introduction Card */}
          <GlassCard style={styles.introCard}>
            <View style={styles.comingSoonBadge}>
              <Ionicons name="time-outline" size={14} color="#FFD700" />
              <Text style={styles.comingSoonText}>COMING SOON</Text>
            </View>
            
            <Text style={styles.introTitle}>Beyond the Stars</Text>
            <Text style={styles.introText}>
              Once your hero reaches 6★ (5★+), a new path opens. The Awakening System 
              allows you to transcend mortal limits and unlock tiers 7★ through 10★.
            </Text>
            
            <View style={styles.introHighlights}>
              <View style={styles.highlight}>
                <Ionicons name="sparkles" size={16} color="#FFD700" />
                <Text style={styles.highlightText}>New Art Forms</Text>
              </View>
              <View style={styles.highlight}>
                <Ionicons name="flash" size={16} color="#FFD700" />
                <Text style={styles.highlightText}>Enhanced Skills</Text>
              </View>
              <View style={styles.highlight}>
                <Ionicons name="videocam" size={16} color="#FFD700" />
                <Text style={styles.highlightText}>Epic Cinematics</Text>
              </View>
            </View>
          </GlassCard>

          {/* Awakening Tier Cards */}
          {AWAKENING_TIERS.map((tier) => (
            <GlassCard key={tier.tier} style={styles.tierCard}>
              {/* Tier Header */}
              <View style={styles.tierHeader}>
                <LinearGradient
                  colors={[tier.color, `${tier.color}66`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tierBadge}
                >
                  <Text style={styles.tierLabel}>{tier.label}</Text>
                </LinearGradient>
                
                <View style={styles.tierTitleWrap}>
                  <Text style={styles.tierTitle}>{tier.title}</Text>
                  <View style={styles.lockedBadge}>
                    <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.lockedText}>LOCKED</Text>
                  </View>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.tierDescription}>{tier.description}</Text>
              
              {/* Requirement */}
              <View style={styles.requirementRow}>
                <Ionicons name="information-circle" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.requirementText}>{tier.requirement}</Text>
              </View>

              {/* Silhouette placeholder */}
              <View style={styles.silhouetteWrap}>
                <View style={[styles.silhouette, { borderColor: tier.color }]}>
                  <Ionicons name="help" size={40} color="rgba(255,255,255,0.15)" />
                  <Text style={styles.silhouetteText}>Art Locked</Text>
                </View>
              </View>

              {/* Bonuses */}
              <Text style={styles.bonusTitle}>Awakening Bonuses:</Text>
              <View style={styles.bonusList}>
                {tier.bonuses.map((bonus, idx) => (
                  <View key={idx} style={styles.bonusRow}>
                    <Ionicons name="checkmark-circle" size={12} color={tier.color} />
                    <Text style={styles.bonusText}>{bonus}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          ))}

          {/* CTA Card */}
          <GlassCard style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Start Your Journey</Text>
            <Text style={styles.ctaText}>
              Reach 6★ on any hero to prepare for the awakening system when it launches.
            </Text>
            
            <Pressable 
              style={styles.ctaButton}
              onPress={() => router.push('/heroes')}
            >
              <LinearGradient
                colors={['rgba(255, 215, 140, 0.92)', 'rgba(255, 180, 100, 0.92)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaButtonGradient}
              >
                <Text style={styles.ctaButtonText}>View My Heroes</Text>
                <Ionicons name="arrow-forward" size={16} color="#0A0B10" />
              </LinearGradient>
            </Pressable>
          </GlassCard>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0B10' },
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { alignItems: 'center', flex: 1 },
  title: { color: COLORS.cream.pure, fontSize: 18, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  placeholder: { width: 40 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Intro Card
  introCard: { marginBottom: 16, padding: 20 },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
    gap: 6,
  },
  comingSoonText: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  introTitle: { color: COLORS.cream.pure, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  introText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20 },
  introHighlights: { flexDirection: 'row', marginTop: 16, gap: 12 },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  highlightText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' },

  // Tier Card
  tierCard: { marginBottom: 16, padding: 16 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierLabel: { color: '#fff', fontSize: 16, fontWeight: '900' },
  tierTitleWrap: { marginLeft: 12, flex: 1 },
  tierTitle: { color: COLORS.cream.pure, fontSize: 16, fontWeight: '900' },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  lockedText: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  tierDescription: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  requirementText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700' },

  // Silhouette
  silhouetteWrap: { alignItems: 'center', marginVertical: 16 },
  silhouette: {
    width: 100,
    height: 130,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteText: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '700', marginTop: 8 },

  // Bonuses
  bonusTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', marginBottom: 8 },
  bonusList: { gap: 6 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bonusText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' },

  // CTA Card
  ctaCard: { marginBottom: 16, padding: 20, alignItems: 'center' },
  ctaTitle: { color: COLORS.cream.pure, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  ctaText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  ctaButton: { width: '100%' },
  ctaButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  ctaButtonText: { color: '#0A0B10', fontSize: 14, fontWeight: '900' },
});
