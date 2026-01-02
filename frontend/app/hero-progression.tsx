import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
  : '/api';

const RARITY_COLORS: { [key: string]: string } = {
  'N': '#808080',
  'R': '#2196F3',
  'SR': '#4CAF50',
  'SSR': '#9C27B0',
  'SSR+': '#E91E63',
  'UR': '#FF9800',
  'UR+': '#F44336',
};

export default function HeroProgressionScreen() {
  const { heroId } = useLocalSearchParams();
  const router = useRouter();
  const { user, fetchUser, fetchUserHeroes, userHeroes } = useGameStore();
  
  const [progression, setProgression] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isAscending, setIsAscending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'promote' | 'ascend'>('promote');

  useEffect(() => {
    if (user && heroId) {
      loadProgression();
    }
  }, [user, heroId]);

  const loadProgression = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${API_BASE}/hero/${user?.username}/hero/${heroId}/progression`
      );
      setProgression(response.data);
    } catch (error) {
      console.error('Failed to load progression:', error);
      Alert.alert('Error', 'Failed to load hero progression');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!progression?.next_promotion?.can_promote) {
      Alert.alert('Cannot Promote', progression?.next_promotion?.reason || 'Not ready');
      return;
    }

    setShowConfirmModal(false);
    setIsPromoting(true);

    try {
      const response = await axios.post(
        `${API_BASE}/hero/${user?.username}/hero/${heroId}/promote`
      );
      Alert.alert('Success! 🌟', response.data.message);
      await loadProgression();
      await fetchUser();
      await fetchUserHeroes();
    } catch (error: any) {
      Alert.alert('Failed', error.response?.data?.detail || 'Promotion failed');
    } finally {
      setIsPromoting(false);
    }
  };

  const handleAscend = async () => {
    setShowConfirmModal(false);
    setIsAscending(true);

    try {
      const response = await axios.post(
        `${API_BASE}/hero/${user?.username}/hero/${heroId}/ascend`
      );
      Alert.alert('Ascension Complete! ✨', response.data.message);
      await loadProgression();
      await fetchUser();
      await fetchUserHeroes();
    } catch (error: any) {
      Alert.alert('Failed', error.response?.data?.detail || 'Ascension failed');
    } finally {
      setIsAscending(false);
    }
  };

  const openConfirm = (action: 'promote' | 'ascend') => {
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  // Find the hero from userHeroes for the image
  const heroData = userHeroes.find(h => h.hero_id === heroId || h.id === heroId);
  const rarityColor = RARITY_COLORS[progression?.rarity || 'SR'];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.gold.primary} />
      </SafeAreaView>
    );
  }

  if (!progression) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Failed to load hero data</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const nextPromo = progression.next_promotion;
  const ascension = progression.ascension_available;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.navy.darkest, COLORS.navy.primary]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hero Progression</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero Card */}
          <View style={[styles.heroCard, { borderColor: rarityColor }]}>
            <Image
              source={{ uri: heroData?.hero_data?.image_url || 'https://via.placeholder.com/120' }}
              style={styles.heroImage}
            />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{progression.hero_name}</Text>
              <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
                <Text style={styles.rarityText}>{progression.rarity}</Text>
              </View>
              <Text style={styles.starsDisplay}>{progression.stars_display}</Text>
              <Text style={styles.levelText}>
                Level {progression.level} / {progression.level_cap}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Current Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="heart" size={20} color="#FF5252" />
                <Text style={styles.statValue}>{progression.current_stats?.hp?.toLocaleString()}</Text>
                <Text style={styles.statLabel}>HP</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="flash" size={20} color="#FF9800" />
                <Text style={styles.statValue}>{progression.current_stats?.atk?.toLocaleString()}</Text>
                <Text style={styles.statLabel}>ATK</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="shield" size={20} color="#2196F3" />
                <Text style={styles.statValue}>{progression.current_stats?.def?.toLocaleString()}</Text>
                <Text style={styles.statLabel}>DEF</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="speedometer" size={20} color="#4CAF50" />
                <Text style={styles.statValue}>{progression.current_stats?.speed?.toLocaleString()}</Text>
                <Text style={styles.statLabel}>SPD</Text>
              </View>
            </View>
            <View style={styles.powerRow}>
              <Ionicons name="flame" size={24} color={COLORS.gold.primary} />
              <Text style={styles.powerValue}>
                Combat Power: {progression.current_stats?.power?.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Multipliers */}
          <View style={styles.multipliersSection}>
            <Text style={styles.sectionTitle}>Stat Multipliers</Text>
            <View style={styles.multiplierRow}>
              <Text style={styles.multiplierLabel}>Rarity Multiplier:</Text>
              <Text style={styles.multiplierValue}>{progression.rarity_multiplier}x</Text>
            </View>
            <View style={styles.multiplierRow}>
              <Text style={styles.multiplierLabel}>Star Multiplier:</Text>
              <Text style={styles.multiplierValue}>{progression.star_multiplier}x</Text>
            </View>
            <View style={styles.multiplierRow}>
              <Text style={styles.multiplierLabel}>Total Multiplier:</Text>
              <Text style={[styles.multiplierValue, { color: COLORS.gold.primary }]}>
                {progression.stat_multiplier}x
              </Text>
            </View>
          </View>

          {/* Shards */}
          <View style={styles.shardsSection}>
            <View style={styles.shardRow}>
              <Ionicons name="sparkles" size={24} color="#9C27B0" />
              <Text style={styles.shardLabel}>Hero Shards:</Text>
              <Text style={styles.shardValue}>{progression.shards}</Text>
            </View>
          </View>

          {/* Star Promotion */}
          {nextPromo && !progression.is_maxed && (
            <View style={styles.promotionSection}>
              <Text style={styles.sectionTitle}>⭐ Star Promotion</Text>
              <View style={styles.promotionCard}>
                <View style={styles.promotionHeader}>
                  <Text style={styles.promotionFrom}>{progression.stars}★</Text>
                  <Ionicons name="arrow-forward" size={24} color={COLORS.gold.primary} />
                  <Text style={styles.promotionTo}>{nextPromo.next_star}★</Text>
                </View>
                <Text style={styles.promotionDesc}>{nextPromo.description}</Text>
                
                {/* Requirements */}
                <View style={styles.requirementsList}>
                  <View style={styles.requirementRow}>
                    <Ionicons 
                      name={progression.shards >= nextPromo.shard_cost ? "checkmark-circle" : "close-circle"} 
                      size={20} 
                      color={progression.shards >= nextPromo.shard_cost ? "#4CAF50" : "#F44336"} 
                    />
                    <Text style={styles.requirementText}>
                      Shards: {progression.shards} / {nextPromo.shard_cost}
                    </Text>
                  </View>
                  <View style={styles.requirementRow}>
                    <Ionicons 
                      name={(progression.user_gold || 0) >= nextPromo.gold_cost ? "checkmark-circle" : "close-circle"} 
                      size={20} 
                      color={(progression.user_gold || 0) >= nextPromo.gold_cost ? "#4CAF50" : "#F44336"} 
                    />
                    <Text style={styles.requirementText}>
                      Gold: {(progression.user_gold || 0).toLocaleString()} / {nextPromo.gold_cost.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Next Stats Preview */}
                {progression.next_star_stats && (
                  <View style={styles.nextStatsPreview}>
                    <Text style={styles.nextStatsTitle}>Stats After Promotion:</Text>
                    <Text style={styles.nextStatText}>
                      HP: {progression.current_stats?.hp?.toLocaleString()} → {progression.next_star_stats.hp.toLocaleString()}
                    </Text>
                    <Text style={styles.nextStatText}>
                      ATK: {progression.current_stats?.atk?.toLocaleString()} → {progression.next_star_stats.atk.toLocaleString()}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.promoteButton,
                    !nextPromo.can_promote && styles.promoteButtonDisabled
                  ]}
                  onPress={() => openConfirm('promote')}
                  disabled={!nextPromo.can_promote || isPromoting}
                >
                  {isPromoting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="star" size={20} color="#fff" />
                      <Text style={styles.promoteButtonText}>
                        {nextPromo.can_promote ? 'Promote Star' : `Need ${nextPromo.shards_needed} more shards`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Ascension */}
          {ascension && (
            <View style={styles.ascensionSection}>
              <Text style={styles.sectionTitle}>✨ Rarity Ascension</Text>
              <View style={styles.ascensionCard}>
                <View style={styles.ascensionHeader}>
                  <View style={[styles.rarityBadgeSmall, { backgroundColor: rarityColor }]}>
                    <Text style={styles.rarityTextSmall}>{progression.rarity}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={24} color={COLORS.gold.primary} />
                  <View style={[styles.rarityBadgeSmall, { backgroundColor: RARITY_COLORS[ascension.result_rarity] }]}>
                    <Text style={styles.rarityTextSmall}>{ascension.result_rarity}</Text>
                  </View>
                </View>
                <Text style={styles.ascensionDesc}>{ascension.description}</Text>
                <Text style={styles.ascensionBonus}>Bonus: {ascension.bonus_passive}</Text>

                <View style={styles.requirementsList}>
                  <Text style={styles.requirementText}>
                    Required Stars: {progression.stars} / {ascension.required_stars}
                  </Text>
                  <Text style={styles.requirementText}>
                    Shards: {progression.shards} / {ascension.shard_cost}
                  </Text>
                  <Text style={styles.requirementText}>
                    Celestial Sparks: {progression.celestial_sparks} / {ascension.celestial_sparks}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.ascendButton]}
                  onPress={() => openConfirm('ascend')}
                  disabled={isAscending}
                >
                  {isAscending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="rocket" size={20} color="#fff" />
                      <Text style={styles.ascendButtonText}>Ascend to {ascension.result_rarity}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {progression.is_maxed && (
            <View style={styles.maxedBanner}>
              <Ionicons name="trophy" size={32} color={COLORS.gold.primary} />
              <Text style={styles.maxedText}>Maximum Stars Reached!</Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>
              {confirmAction === 'promote' ? 'Confirm Promotion' : 'Confirm Ascension'}
            </Text>
            <Text style={styles.confirmText}>
              {confirmAction === 'promote'
                ? `Promote ${progression.hero_name} to ${nextPromo?.next_star}★?`
                : `Ascend ${progression.hero_name} to ${ascension?.result_rarity}?`}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmAction === 'promote' ? handlePromote : handleAscend}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy.darkest },
  gradient: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.navy.medium, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  errorText: { color: COLORS.cream.dark, fontSize: 16, textAlign: 'center', marginTop: 40 },
  backButton: { marginTop: 20, padding: 12, backgroundColor: COLORS.gold.dark, borderRadius: 8, alignItems: 'center' },
  backButtonText: { color: COLORS.cream.pure, fontWeight: '600' },
  
  heroCard: { flexDirection: 'row', backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, borderWidth: 3, marginBottom: 20 },
  heroImage: { width: 100, height: 100, borderRadius: 12 },
  heroInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  heroName: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  rarityBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  rarityText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  starsDisplay: { fontSize: 18, color: COLORS.gold.primary, marginBottom: 4 },
  levelText: { fontSize: 14, color: COLORS.cream.dark },

  statsSection: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  statCard: { width: '48%', backgroundColor: COLORS.navy.dark, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 4 },
  statLabel: { fontSize: 12, color: COLORS.cream.dark },
  powerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 },
  powerValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary },

  multipliersSection: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 16 },
  multiplierRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.navy.light },
  multiplierLabel: { fontSize: 14, color: COLORS.cream.dark },
  multiplierValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },

  shardsSection: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 16 },
  shardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shardLabel: { fontSize: 16, color: COLORS.cream.dark },
  shardValue: { fontSize: 20, fontWeight: 'bold', color: '#9C27B0' },

  promotionSection: { marginBottom: 16 },
  promotionCard: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16 },
  promotionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  promotionFrom: { fontSize: 28, color: COLORS.cream.dark },
  promotionTo: { fontSize: 28, color: COLORS.gold.primary, fontWeight: 'bold' },
  promotionDesc: { fontSize: 14, color: COLORS.cream.soft, textAlign: 'center', marginBottom: 16 },
  requirementsList: { backgroundColor: COLORS.navy.dark, borderRadius: 12, padding: 12, marginBottom: 16 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  requirementText: { fontSize: 14, color: COLORS.cream.dark },
  nextStatsPreview: { backgroundColor: COLORS.navy.dark, borderRadius: 12, padding: 12, marginBottom: 16 },
  nextStatsTitle: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 8 },
  nextStatText: { fontSize: 13, color: COLORS.cream.soft, marginBottom: 4 },
  promoteButton: { flexDirection: 'row', backgroundColor: COLORS.gold.dark, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  promoteButtonDisabled: { backgroundColor: COLORS.navy.dark },
  promoteButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

  ascensionSection: { marginBottom: 16 },
  ascensionCard: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, borderWidth: 2, borderColor: COLORS.gold.primary },
  ascensionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  rarityBadgeSmall: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  rarityTextSmall: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  ascensionDesc: { fontSize: 14, color: COLORS.cream.soft, textAlign: 'center', marginBottom: 8 },
  ascensionBonus: { fontSize: 13, color: COLORS.gold.primary, textAlign: 'center', marginBottom: 16 },
  ascendButton: { flexDirection: 'row', backgroundColor: '#9C27B0', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  ascendButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

  maxedBanner: { backgroundColor: COLORS.gold.dark + '40', borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  maxedText: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  confirmModal: { backgroundColor: COLORS.navy.primary, borderRadius: 16, padding: 24, width: '80%', alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  confirmText: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 12, backgroundColor: COLORS.navy.medium, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { color: COLORS.cream.soft, fontWeight: '600' },
  confirmButton: { flex: 1, padding: 12, backgroundColor: COLORS.gold.dark, borderRadius: 8, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontWeight: '600' },
});
