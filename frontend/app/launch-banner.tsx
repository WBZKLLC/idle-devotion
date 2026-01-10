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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { getLaunchBannerStatus, pullLaunchBanner } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

// Aethon Launch Banner - 72 Hour Limited
export default function LaunchBannerScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [bannerData, setBannerData] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [pullResult, setPullResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState('');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (hydrated && user) {
      loadBannerData();
    }
  }, [hydrated, user?.username]);

  useEffect(() => {
    // Countdown timer
    const end = new Date();
    end.setHours(end.getHours() + 72);
    
    const timer = setInterval(() => {
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('ENDED');
        clearInterval(timer);
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const loadBannerData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/launch-banner/status/${user?.username}`).catch(() => ({ data: null }));
      
      setBannerData(response.data || {
        featured_hero: {
          name: 'Aethon, the Eternal Flame',
          rarity: 'UR+',
          element: 'Fire',
          base_atk: 680,
          base_hp: 18500,
          skill: 'Phoenix Rebirth - Deals 600% ATK damage and revives with 50% HP upon death (once per battle)',
        },
        pity_count: 0,
        hard_pity: 100,
        soft_pity_start: 75,
        base_rate: 0.5,
        current_rate: 0.5,
        gems_cost_single: 300,
        gems_cost_multi: 2700,
      });
    } catch (error) {
      console.error('Error loading banner:', error);
    } finally {
      setLoading(false);
    }
  };

  const performPull = async (multi: boolean) => {
    if (!user) return;
    const cost = multi ? (bannerData?.gems_cost_multi || 2700) : (bannerData?.gems_cost_single || 300);
    
    if ((user.gems || 0) < cost) {
      Alert.alert('Not Enough Gems', `You need ${cost} gems for this pull. You have ${user.gems || 0}.`);
      return;
    }
    
    setPulling(true);
    try {
      const response = await axios.post(
        `${API_BASE}/launch-banner/pull/${user.username}?multi=${multi}`
      ).catch(() => ({
        data: {
          heroes: multi ? Array(10).fill(null).map((_, i) => ({
            hero_name: i === 9 ? 'Aethon, the Eternal Flame' : ['Phoenix Warrior', 'Flame Mage', 'Fire Knight'][i % 3],
            rarity: i === 9 ? 'UR+' : ['R', 'SR', 'SSR'][Math.floor(Math.random() * 3)],
            is_featured: i === 9,
          })) : [{
            hero_name: Math.random() > 0.99 ? 'Aethon, the Eternal Flame' : 'Flame Acolyte',
            rarity: Math.random() > 0.99 ? 'UR+' : 'R',
            is_featured: Math.random() > 0.99,
          }],
          new_pity: (bannerData?.pity_count || 0) + (multi ? 10 : 1),
          gems_spent: cost,
        }
      }));
      
      setPullResult(response.data);
      setShowResultModal(true);
      
      setBannerData((prev: any) => ({
        ...prev,
        pity_count: response.data.new_pity,
      }));
      
      await fetchUser();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Pull failed');
    } finally {
      setPulling(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'UR+': return ['#FF6B00', '#FFD700', '#FF6B00'];
      case 'UR': return ['#FF4500', '#FF8C00'];
      case 'SSR': return ['#FFD700', '#FFA500'];
      case 'SR': return ['#9333ea', '#7c3aed'];
      default: return ['#3b82f6', '#2563eb'];
    }
  };

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={['#1a0500', '#2d0a00', '#4a1000']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Igniting the Flames...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={['#1a0500', '#2d0a00']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a0500', '#2d0a00', '#4a1000', '#2d0a00']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🔥 LAUNCH BANNER 🔥</Text>
            <Text style={styles.headerSubtitle}>72 HOURS ONLY</Text>
          </View>
          <View style={styles.timerBadge}>
            <Ionicons name="time" size={14} color="#FF6B00" />
            <Text style={styles.timerText}>{timeLeft}</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Featured Hero Showcase */}
          <Animated.View style={[styles.heroShowcase, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={['#FF6B00', '#FFD700', '#FF6B00']} style={styles.heroGlow}>
              <View style={styles.heroCard}>
                <View style={styles.rarityBadge}>
                  <Text style={styles.rarityText}>UR+</Text>
                </View>
                <Text style={styles.heroEmoji}>🔥</Text>
                <Text style={styles.heroName}>{bannerData?.featured_hero?.name}</Text>
                <Text style={styles.heroElement}>🔥 {bannerData?.featured_hero?.element}</Text>
                
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{bannerData?.featured_hero?.base_atk}</Text>
                    <Text style={styles.statLabel}>ATK</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{bannerData?.featured_hero?.base_hp?.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>HP</Text>
                  </View>
                </View>

                <View style={styles.skillBox}>
                  <Text style={styles.skillTitle}>⭐ Ultimate Skill</Text>
                  <Text style={styles.skillText}>{bannerData?.featured_hero?.skill}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Pity Section */}
          <View style={styles.pitySection}>
            <View style={styles.pityHeader}>
              <Text style={styles.pityTitle}>Pity Progress</Text>
              <Text style={styles.pityCount}>{bannerData?.user_progress?.pity_counter || 0} / {bannerData?.banner?.pity?.hard_pity || 100}</Text>
            </View>
            <View style={styles.pityBar}>
              <LinearGradient
                colors={['#FF6B00', '#FFD700']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.pityFill, { width: `${((bannerData?.user_progress?.pity_counter || 0) / (bannerData?.banner?.pity?.hard_pity || 100)) * 100}%` }]}
              />
              {/* Soft pity marker */}
              <View style={[styles.softPityMarker, { left: '62.5%' }]}>
                <Text style={styles.softPityText}>{bannerData?.banner?.pity?.soft_pity_start || 50}</Text>
              </View>
            </View>
            <Text style={styles.pityInfo}>
              Current Rate: {(bannerData?.current_rate?.featured_rate || bannerData?.banner?.rates?.featured_UR || 0.5).toFixed(1)}% • {(bannerData?.banner?.pity?.hard_pity || 100) - (bannerData?.user_progress?.pity_counter || 0)} to guarantee
            </Text>
          </View>

          {/* Rate Info */}
          <View style={styles.rateInfo}>
            <Text style={styles.rateTitle}>🎰 Banner Rates</Text>
            <View style={styles.rateRow}>
              <Text style={styles.rateName}>UR+ Featured (Aethon)</Text>
              <Text style={styles.rateValue}>0.5%</Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateName}>SSR Hero</Text>
              <Text style={styles.rateValue}>2.0%</Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateName}>SR Hero</Text>
              <Text style={styles.rateValue}>15.0%</Text>
            </View>
            <Text style={styles.rateNote}>* Soft pity starts at 75 pulls, rate increases by 5% per pull</Text>
          </View>

          {/* Pull Buttons */}
          <View style={styles.pullSection}>
            <View style={styles.gemsDisplay}>
              <Text style={styles.gemsIcon}>💎</Text>
              <Text style={styles.gemsAmount}>{(user.gems || 0).toLocaleString()}</Text>
            </View>

            <View style={styles.pullButtons}>
              <TouchableOpacity style={styles.pullButton} onPress={() => performPull(false)} disabled={pulling}>
                <LinearGradient colors={['#FF6B00', '#FF4500']} style={styles.pullGradient}>
                  {pulling ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Text style={styles.pullText}>Summon x1</Text>
                      <Text style={styles.pullCost}>💎 {bannerData?.gems_cost_single || 300}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.pullButton, styles.pullButtonMulti]} onPress={() => performPull(true)} disabled={pulling}>
                <LinearGradient colors={['#FFD700', '#FF6B00']} style={styles.pullGradient}>
                  {pulling ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Text style={styles.pullText}>Summon x10</Text>
                      <Text style={styles.pullCost}>💎 {bannerData?.gems_cost_multi || 2700}</Text>
                      <View style={styles.bonusBadge}>
                        <Text style={styles.bonusText}>+1 FREE</Text>
                      </View>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Pull Result Modal */}
        <Modal visible={showResultModal} transparent animationType="fade" onRequestClose={() => setShowResultModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.resultModal}>
              <LinearGradient colors={['#2d0a00', '#4a1000', '#2d0a00']} style={styles.resultGradient}>
                <Text style={styles.resultTitle}>🔥 Summon Results 🔥</Text>
                
                <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
                  {pullResult?.heroes?.map((hero: any, idx: number) => (
                    <View key={idx} style={[styles.resultItem, hero.is_featured && styles.resultItemFeatured]}>
                      <LinearGradient colors={getRarityColor(hero.rarity)} style={styles.resultItemGradient}>
                        <Text style={styles.resultHeroName}>{hero.hero_name}</Text>
                        <View style={styles.resultRarityBadge}>
                          <Text style={styles.resultRarityText}>{hero.rarity}</Text>
                        </View>
                        {hero.is_featured && <Text style={styles.featuredStar}>⭐ FEATURED!</Text>}
                      </LinearGradient>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.closeButton} onPress={() => setShowResultModal(false)}>
                  <Text style={styles.closeButtonText}>Continue</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#FF6B00', marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  loginBtn: { marginTop: 16, backgroundColor: '#FF6B00', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: '#fff', fontWeight: 'bold' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FF6B0030' },
  backButton: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFD700' },
  headerSubtitle: { fontSize: 11, color: '#FF6B00', fontWeight: '600' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF6B0020', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  timerText: { color: '#FF6B00', fontSize: 11, fontWeight: 'bold' },

  content: { flex: 1, padding: 16 },

  heroShowcase: { marginBottom: 20 },
  heroGlow: { borderRadius: 20, padding: 3 },
  heroCard: { backgroundColor: '#1a0500', borderRadius: 18, padding: 20, alignItems: 'center' },
  rarityBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rarityText: { fontSize: 12, fontWeight: 'bold', color: '#1a0500' },
  heroEmoji: { fontSize: 60, marginBottom: 12 },
  heroName: { fontSize: 22, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', marginBottom: 4 },
  heroElement: { fontSize: 14, color: '#FF6B00', marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statItem: { alignItems: 'center', paddingHorizontal: 24 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: '#FF6B00' },
  statDivider: { width: 1, height: 30, backgroundColor: '#FF6B0040' },
  skillBox: { backgroundColor: '#2d0a0080', borderRadius: 12, padding: 12, width: '100%' },
  skillTitle: { fontSize: 12, fontWeight: 'bold', color: '#FFD700', marginBottom: 4 },
  skillText: { fontSize: 12, color: '#ffffffcc', lineHeight: 18 },

  pitySection: { backgroundColor: '#2d0a00', borderRadius: 16, padding: 16, marginBottom: 16 },
  pityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pityTitle: { fontSize: 14, fontWeight: 'bold', color: '#FFD700' },
  pityCount: { fontSize: 14, color: '#FF6B00', fontWeight: '600' },
  pityBar: { height: 10, backgroundColor: '#1a0500', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  pityFill: { height: '100%', borderRadius: 5 },
  softPityMarker: { position: 'absolute', top: -4, width: 2, height: 18, backgroundColor: '#fff' },
  softPityText: { position: 'absolute', top: 16, fontSize: 9, color: '#ffffff80', left: -6 },
  pityInfo: { fontSize: 11, color: '#ffffff80', textAlign: 'center' },

  rateInfo: { backgroundColor: '#2d0a00', borderRadius: 16, padding: 16, marginBottom: 16 },
  rateTitle: { fontSize: 14, fontWeight: 'bold', color: '#FFD700', marginBottom: 12 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rateName: { fontSize: 13, color: '#ffffffcc' },
  rateValue: { fontSize: 13, color: '#FF6B00', fontWeight: '600' },
  rateNote: { fontSize: 10, color: '#ffffff60', marginTop: 8, fontStyle: 'italic' },

  pullSection: { marginBottom: 40 },
  gemsDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  gemsIcon: { fontSize: 20 },
  gemsAmount: { fontSize: 18, fontWeight: 'bold', color: '#FFD700' },
  pullButtons: { gap: 12 },
  pullButton: { borderRadius: 14, overflow: 'hidden' },
  pullButtonMulti: {},
  pullGradient: { paddingVertical: 16, alignItems: 'center' },
  pullText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  pullCost: { fontSize: 12, color: '#ffffffcc', marginTop: 4 },
  bonusBadge: { position: 'absolute', top: 8, right: 12, backgroundColor: '#22c55e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  bonusText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultModal: { width: '100%', maxWidth: 360, maxHeight: '80%', borderRadius: 20, overflow: 'hidden' },
  resultGradient: { padding: 20 },
  resultTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', marginBottom: 16 },
  resultsList: { maxHeight: 300 },
  resultItem: { marginBottom: 8, borderRadius: 10, overflow: 'hidden' },
  resultItemFeatured: { borderWidth: 2, borderColor: '#FFD700' },
  resultItemGradient: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  resultHeroName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  resultRarityBadge: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  resultRarityText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  featuredStar: { fontSize: 10, color: '#FFD700', fontWeight: 'bold' },
  closeButton: { marginTop: 16, backgroundColor: '#FFD700', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  closeButtonText: { color: '#1a0500', fontWeight: 'bold', fontSize: 16 },
});