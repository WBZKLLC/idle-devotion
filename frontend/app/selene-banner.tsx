import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { primary: '#c9a227', light: '#e6c666', glow: '#ffd700' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  chrono: { primary: '#6366f1', secondary: '#a5b4fc', glow: '#818cf8', dark: '#4338ca' },
  urgent: '#ef4444',
  success: '#22c55e',
};

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL 
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api` 
  : '/api';

export default function SeleneBannerScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [bannerData, setBannerData] = useState<any>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullResults, setPullResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const [showUnlockCinematic, setShowUnlockCinematic] = useState(false);
  const [showCharacterDetails, setShowCharacterDetails] = useState(false);

  useEffect(() => {
    if (hydrated && user) {
      loadBannerData();
    }
  }, [hydrated, user?.username]);

  const loadBannerData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/selene-banner/status/${user?.username}`
      );
      if (response.ok) {
        const data = await response.json();
        setBannerData(data);
        
        // Check if first time viewing (unlock cinematic)
        if (!data.user_progress?.total_pulls && data.is_unlocked) {
          // Show unlock cinematic
          // setShowUnlockCinematic(true);
        }
      }
    } catch (error) {
      console.error('Error loading Selene banner:', error);
    } finally {
      setLoading(false);
    }
  };

  const performPull = async (multi: boolean) => {
    if (!user || isPulling) return;
    
    setIsPulling(true);
    try {
      const response = await fetch(
        `${API_BASE}/selene-banner/pull/${user.username}?multi=${multi}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPullResults(data.results);
        setShowResults(true);
        
        // Check if got Selene
        if (data.has_selene && data.results.some((r: any) => r.is_featured)) {
          // Celebration! Maybe show special animation
        }
        
        // Show bundles if triggered
        if (data.triggered_bundles?.length > 0 && !data.has_selene) {
          // Will show after results modal closes
        }
        
        await fetchUser();
        await loadBannerData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to summon');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to perform summon');
    } finally {
      setIsPulling(false);
    }
  };

  const formatTimeRemaining = () => {
    if (!bannerData?.time_remaining) return 'Expired';
    const { hours_remaining, minutes_remaining, expired } = bannerData.time_remaining;
    if (expired) return 'EXPIRED';
    
    const hours = hours_remaining || 0;
    const mins = minutes_remaining || 0;
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h ${mins}m`;
    }
    return `${hours}h ${mins}m`;
  };

  const getUrgencyColor = () => {
    const level = bannerData?.time_remaining?.urgency_level;
    switch (level) {
      case 'CRITICAL': return '#ff0000';
      case 'HIGH': return '#ff6b35';
      case 'MEDIUM': return '#f59e0b';
      default: return COLORS.chrono.primary;
    }
  };

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={['#1e1b4b', '#0f0a1f', COLORS.navy.darkest]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.chrono.primary} />
          <Text style={styles.loadingText}>Opening Temporal Rift...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const character = bannerData?.banner?.featured_character;
  const pityCounter = bannerData?.user_progress?.pity_counter || 0;
  const hasSelene = bannerData?.user_progress?.has_selene || false;
  const currentRate = bannerData?.current_rate?.featured_rate || 1;
  const softPityStart = bannerData?.banner?.pity?.soft_start || 50;
  const hardPity = bannerData?.banner?.pity?.hard_max || 80;

  return (
    <LinearGradient colors={['#1e1b4b', '#0f0a1f', COLORS.navy.darkest]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>⏳ FATED CHRONOLOGY ⏳</Text>
            <Text style={styles.headerSubtitle}>LIMITED - 7 DAYS ONLY</Text>
          </View>
          <TouchableOpacity style={styles.infoButton} onPress={() => setShowCharacterDetails(true)}>
            <Ionicons name="information-circle" size={24} color={COLORS.chrono.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* URGENT TIMER - Static */}
          <View style={styles.timerContainer}>
            <LinearGradient
              colors={[getUrgencyColor() + '40', getUrgencyColor() + '10']}
              style={styles.timerGradient}
            >
              <Ionicons name="hourglass" size={20} color={getUrgencyColor()} />
              <Text style={[styles.timerText, { color: getUrgencyColor() }]}>
                ⏰ {formatTimeRemaining()} REMAINING
              </Text>
              <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor() }]} />
            </LinearGradient>
          </View>

          {/* NARRATIVE HOOK */}
          <View style={styles.narrativeBox}>
            <Text style={styles.narrativeText}>
              "{character?.marketing?.unlock_dialogue || 'The timelines converge...'}"
            </Text>
          </View>

          {/* SELENE SHOWCASE - Static */}
          <View style={styles.heroShowcase}>
            <LinearGradient
              colors={[COLORS.chrono.primary + '30', COLORS.chrono.dark + '20', '#1e1b4b20']}
              style={styles.heroGradient}
            >
              {/* Chrono Glow - Static */}
              <View
                style={[
                  styles.heroGlow,
                  {
                    opacity: 0.4,
                    backgroundColor: COLORS.chrono.glow,
                  },
                ]}
              />

              <View style={styles.heroImageContainer}>
                <Image
                  source={{ uri: character?.image_url || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400' }}
                  style={styles.heroImage}
                />
                <View style={[styles.rarityBadge, { backgroundColor: COLORS.chrono.primary }]}>
                  <Text style={styles.rarityText}>SSR</Text>
                </View>
                {hasSelene && (
                  <View style={styles.ownedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                    <Text style={styles.ownedText}>OWNED</Text>
                  </View>
                )}
              </View>

              <Text style={styles.heroName}>{character?.name || 'Chrono-Archangel Selene'}</Text>
              <Text style={styles.heroTagline}>{character?.marketing?.tagline || 'Master of Time'}</Text>
              
              <View style={styles.heroStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ATK</Text>
                  <Text style={[styles.statValue, { color: COLORS.chrono.secondary }]}>{character?.base_atk || 520}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>HP</Text>
                  <Text style={styles.statValue}>{character?.base_hp?.toLocaleString() || '14,500'}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>SPD</Text>
                  <Text style={[styles.statValue, { color: COLORS.chrono.secondary }]}>{character?.speed || 135}</Text>
                </View>
              </View>

              {/* Power Badge */}
              <View style={styles.powerBadge}>
                <Text style={styles.powerBadgeText}>⚡ 450% ATK MULTIPLIER</Text>
              </View>

              <View style={styles.exclusiveTag}>
                <Ionicons name="lock-closed" size={14} color={COLORS.urgent} />
                <Text style={styles.exclusiveText}>EXCLUSIVE FOR 6 MONTHS</Text>
              </View>
            </LinearGradient>
          </View>

          {/* PITY PROGRESS */}
          <View style={styles.pitySection}>
            <View style={styles.pityHeader}>
              <Text style={styles.pityTitle}>🎯 Guarantee Progress</Text>
              <Text style={styles.pityCounter}>{pityCounter} / {hardPity}</Text>
            </View>
            <View style={styles.pityBarOuter}>
              <LinearGradient
                colors={[COLORS.chrono.primary, COLORS.chrono.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.pityBarFill, { width: `${(pityCounter / hardPity) * 100}%` }]}
              />
              {/* Soft pity marker */}
              <View style={[styles.pityMarker, { left: `${(softPityStart / hardPity) * 100}%` }]}>
                <View style={styles.pityMarkerLine} />
                <Text style={styles.pityMarkerText}>{softPityStart}</Text>
              </View>
            </View>
            <View style={styles.pityInfo}>
              <Text style={styles.pityInfoText}>
                {pityCounter >= softPityStart 
                  ? `🔥 SOFT PITY ACTIVE! Current Rate: ${currentRate}%` 
                  : pityCounter >= softPityStart - 10 
                    ? `⚡ ${softPityStart - pityCounter} pulls to soft pity!`
                    : `Current Rate: ${currentRate}%`}
              </Text>
              <Text style={styles.pityGuarantee}>
                {hardPity - pityCounter} pulls to GUARANTEED Selene
              </Text>
            </View>
          </View>

          {/* RATES INFO */}
          <View style={styles.ratesBox}>
            <Text style={styles.ratesTitle}>📊 Banner Rates</Text>
            <View style={styles.ratesRow}>
              <View style={styles.rateItem}>
                <Text style={styles.rateName}>Selene (Featured)</Text>
                <Text style={[styles.rateValue, { color: COLORS.chrono.secondary }]}>1.0%</Text>
              </View>
              <View style={styles.rateItem}>
                <Text style={styles.rateName}>Other SSR</Text>
                <Text style={styles.rateValue}>1.0%</Text>
              </View>
              <View style={styles.rateItem}>
                <Text style={styles.rateName}>SR</Text>
                <Text style={styles.rateValue}>8.0%</Text>
              </View>
            </View>
            <Text style={styles.pityNote}>
              ✨ Soft pity at {softPityStart} (+1.5%/pull) • Hard pity at {hardPity} (100%)
            </Text>
          </View>

          {/* SUMMON BUTTONS */}
          <View style={styles.summonSection}>
            <TouchableOpacity
              style={styles.summonButton}
              onPress={() => performPull(false)}
              disabled={isPulling || hasSelene}
            >
              <LinearGradient
                colors={[COLORS.navy.medium, COLORS.navy.dark]}
                style={styles.summonButtonGradient}
              >
                {isPulling ? (
                  <ActivityIndicator color={COLORS.chrono.secondary} />
                ) : (
                  <>
                    <Text style={styles.summonButtonTitle}>Single</Text>
                    <View style={styles.costRow}>
                      <Ionicons name="diamond" size={14} color={COLORS.chrono.secondary} />
                      <Text style={styles.summonCost}>300</Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summonButton}
              onPress={() => performPull(true)}
              disabled={isPulling || hasSelene}
            >
              <LinearGradient
                colors={[COLORS.chrono.primary, COLORS.chrono.dark]}
                style={styles.summonButtonGradient}
              >
                {isPulling ? (
                  <ActivityIndicator color={COLORS.cream.pure} />
                ) : (
                  <>
                    <Text style={[styles.summonButtonTitle, { color: COLORS.cream.pure }]}>×10</Text>
                    <View style={styles.costRow}>
                      <Ionicons name="diamond" size={14} color={COLORS.cream.pure} />
                      <Text style={[styles.summonCost, { color: COLORS.cream.pure }]}>2,700</Text>
                    </View>
                    <Text style={styles.discountTag}>10% OFF</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* BUNDLES BUTTON */}
          {!hasSelene && (
            <TouchableOpacity style={styles.bundlesButton} onPress={() => setShowBundles(true)}>
              <LinearGradient colors={[COLORS.chrono.primary, COLORS.chrono.dark]} style={styles.bundlesGradient}>
                <Ionicons name="gift" size={20} color={COLORS.cream.pure} />
                <Text style={styles.bundlesText}>💰 View Special Offers</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.cream.pure} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* VIP PROGRESS MESSAGE */}
          {bannerData?.monetization && !hasSelene && (
            <View style={styles.monetizationBox}>
              <Text style={styles.monetizationTitle}>👑 VIP Progress</Text>
              <Text style={styles.monetizationText}>
                Continue summoning to increase your VIP level and unlock exclusive rewards!
              </Text>
              <Text style={styles.monetizationCost}>
                VIP Level Up: {Math.min(Math.floor(pityCounter / 10) + 1, 8)}/8
              </Text>
            </View>
          )}

          {/* SUCCESS STATE */}
          {hasSelene && (
            <View style={styles.successBox}>
              <LinearGradient colors={[COLORS.success + '30', COLORS.chrono.dark + '20']} style={styles.successGradient}>
                <Ionicons name="trophy" size={40} color={COLORS.gold.primary} />
                <Text style={styles.successTitle}>🎉 CHRONO-ARCHANGEL SELENE IS YOURS!</Text>
                <Text style={styles.successText}>The timelines have aligned in your favor.</Text>
              </LinearGradient>
            </View>
          )}

          {/* CURRENCY BAR */}
          <View style={styles.currencyBar}>
            <View style={styles.currencyItem}>
              <Ionicons name="diamond" size={16} color={COLORS.chrono.secondary} />
              <Text style={styles.currencyText}>{(user.gems || 0).toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>

        {/* RESULTS MODAL */}
        <Modal visible={showResults} animationType="fade" transparent onRequestClose={() => setShowResults(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.resultsContainer}>
              <LinearGradient colors={['#1e1b4b', COLORS.navy.dark]} style={styles.resultsGradient}>
                <Text style={styles.resultsTitle}>
                  {pullResults.some(r => r.is_featured) ? '🌟 LEGENDARY SUMMON! 🌟' : 'Summon Results'}
                </Text>
                <ScrollView horizontal contentContainerStyle={styles.resultsScroll} showsHorizontalScrollIndicator={false}>
                  {pullResults.map((result, index) => (
                    <View
                      key={index}
                      style={[
                        styles.resultCard,
                        result.is_featured && styles.resultCardFeatured,
                      ]}
                    >
                      <View style={[
                        styles.resultRarity,
                        { backgroundColor: result.is_featured ? COLORS.chrono.primary : result.rarity === 'SSR' ? '#9b4dca' : result.rarity === 'SR' ? '#3b82f6' : '#6b7280' }
                      ]}>
                        <Text style={styles.resultRarityText}>{result.rarity}</Text>
                      </View>
                      {result.is_featured ? (
                        <>
                          <Image source={{ uri: character?.image_url }} style={styles.resultImage} />
                          <Text style={styles.resultName}>SELENE!</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.resultPlaceholder}>
                            <Ionicons name="person" size={30} color={COLORS.cream.dark} />
                          </View>
                          <Text style={styles.resultName}>{result.rarity} Hero</Text>
                        </>
                      )}
                      {result.is_featured && (
                        <View style={styles.featuredBadge}>
                          <Text style={styles.featuredBadgeText}>★ FEATURED ★</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowResults(false);
                    if (bannerData?.triggered_bundles?.length > 0 && !hasSelene) {
                      setTimeout(() => setShowBundles(true), 500);
                    }
                  }}
                >
                  <Text style={styles.closeButtonText}>Continue</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* BUNDLES MODAL */}
        <Modal visible={showBundles} animationType="slide" transparent onRequestClose={() => setShowBundles(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.bundlesContainer}>
              <LinearGradient colors={['#1e1b4b', COLORS.navy.dark]} style={styles.bundlesModalGradient}>
                <View style={styles.bundlesHeader}>
                  <Text style={styles.bundlesModalTitle}>💎 Special Offers</Text>
                  <TouchableOpacity onPress={() => setShowBundles(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.bundlesList}>
                  {[
                    { id: 'starter', name: '⚡ Starter Pack', price: '$4.99', pulls: 10, crystals: 500, tag: 'BEST VALUE', urgency: '67% of players buy this!' },
                    { id: 'ascension', name: '🌟 Ascension Path', price: '$49.99', pulls: 40, crystals: 1000, tag: 'REACH GUARANTEE', urgency: 'Halfway to Selene!' },
                    { id: 'guarantee', name: '👑 Complete Pack', price: '$99.99', pulls: 80, crystals: 3000, tag: 'INSTANT SELENE', urgency: 'Secure your destiny!' },
                    { id: 'last', name: '🔥 Last Chance', price: '$19.99', pulls: 20, crystals: 800, tag: 'LIMITED', urgency: 'So close!' },
                  ].map((bundle) => (
                    <TouchableOpacity key={bundle.id} style={styles.bundleCard}>
                      <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.bundleGradient}>
                        <View style={styles.bundleHeader}>
                          <Text style={styles.bundleName}>{bundle.name}</Text>
                          <View style={[styles.bundleTag, { backgroundColor: COLORS.chrono.primary }]}>
                            <Text style={styles.bundleTagText}>{bundle.tag}</Text>
                          </View>
                        </View>
                        <View style={styles.bundleContents}>
                          <Text style={styles.bundleItem}>🎫 {bundle.pulls} Summons</Text>
                          <Text style={styles.bundleItem}>💎 {bundle.crystals} Crystals</Text>
                        </View>
                        <Text style={styles.bundleUrgency}>{bundle.urgency}</Text>
                        <View style={styles.bundleFooter}>
                          <View style={[styles.bundlePriceButton, { backgroundColor: COLORS.chrono.primary }]}>
                            <Text style={styles.bundlePrice}>{bundle.price}</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* CHARACTER DETAILS MODAL */}
        <Modal visible={showCharacterDetails} animationType="slide" transparent onRequestClose={() => setShowCharacterDetails(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.characterDetailsContainer}>
              <LinearGradient colors={['#1e1b4b', COLORS.navy.dark]} style={styles.characterDetailsGradient}>
                <View style={styles.characterDetailsHeader}>
                  <Text style={styles.characterDetailsTitle}>⏳ Character Details</Text>
                  <TouchableOpacity onPress={() => setShowCharacterDetails(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.characterDetailsContent}>
                  <Image source={{ uri: character?.image_url }} style={styles.characterDetailImage} />
                  <Text style={styles.characterDetailName}>{character?.name}</Text>
                  <Text style={styles.characterDetailRole}>{character?.element} • {character?.hero_class} • {character?.role}</Text>
                  
                  <Text style={styles.skillsTitle}>Skills</Text>
                  {character?.skills?.map((skill: any, index: number) => (
                    <View key={index} style={styles.skillCard}>
                      <View style={styles.skillHeader}>
                        <Text style={styles.skillName}>{skill.name}</Text>
                        <Text style={[styles.skillType, { color: skill.type === 'ultimate' ? COLORS.gold.primary : skill.type === 'passive' ? COLORS.success : COLORS.chrono.secondary }]}>
                          {skill.type?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.skillDesc}>{skill.description}</Text>
                      {skill.damage_multiplier > 0 && (
                        <Text style={styles.skillDamage}>⚔️ {skill.damage_multiplier * 100}% ATK</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.chrono.secondary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.chrono.secondary, letterSpacing: 1 },
  headerSubtitle: { fontSize: 10, color: COLORS.urgent, marginTop: 2, letterSpacing: 2 },
  infoButton: { padding: 8 },
  
  content: { padding: 16, paddingBottom: 40 },
  
  timerContainer: { marginBottom: 16 },
  timerGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 8 },
  timerText: { fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  
  narrativeBox: { backgroundColor: COLORS.chrono.dark + '30', borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: COLORS.chrono.primary },
  narrativeText: { color: COLORS.chrono.secondary, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  
  heroShowcase: { marginBottom: 20 },
  heroGradient: { padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: COLORS.chrono.primary + '60', position: 'relative', overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -50, left: -50, right: -50, bottom: -50, borderRadius: 200 },
  heroImageContainer: { position: 'relative', marginBottom: 16 },
  heroImage: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: COLORS.chrono.primary },
  rarityBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  rarityText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 14 },
  ownedBadge: { position: 'absolute', bottom: -10, left: '50%', marginLeft: -40, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  ownedText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 10 },
  heroName: { fontSize: 22, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 4 },
  heroTagline: { fontSize: 13, color: COLORS.chrono.secondary, fontStyle: 'italic', textAlign: 'center', marginBottom: 16 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 12 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: COLORS.cream.dark },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  statDivider: { width: 1, height: 30, backgroundColor: COLORS.chrono.primary + '40' },
  powerBadge: { backgroundColor: COLORS.chrono.primary + '40', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 12 },
  powerBadgeText: { color: COLORS.chrono.secondary, fontSize: 12, fontWeight: 'bold' },
  exclusiveTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.urgent + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  exclusiveText: { color: COLORS.urgent, fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  
  pitySection: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 16 },
  pityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pityTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  pityCounter: { fontSize: 18, fontWeight: 'bold', color: COLORS.chrono.secondary },
  pityBarOuter: { height: 12, backgroundColor: COLORS.navy.dark, borderRadius: 6, overflow: 'visible', position: 'relative' },
  pityBarFill: { height: '100%', borderRadius: 6 },
  pityMarker: { position: 'absolute', top: -20, alignItems: 'center' },
  pityMarkerLine: { width: 2, height: 32, backgroundColor: COLORS.gold.primary },
  pityMarkerText: { fontSize: 10, color: COLORS.gold.light, marginTop: 2 },
  pityInfo: { marginTop: 16 },
  pityInfoText: { fontSize: 13, color: COLORS.chrono.secondary, textAlign: 'center' },
  pityGuarantee: { fontSize: 12, color: COLORS.cream.dark, textAlign: 'center', marginTop: 4 },
  
  ratesBox: { backgroundColor: COLORS.navy.medium + '80', borderRadius: 12, padding: 14, marginBottom: 20 },
  ratesTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 10 },
  ratesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rateItem: { alignItems: 'center' },
  rateName: { fontSize: 10, color: COLORS.cream.dark, marginBottom: 2 },
  rateValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.soft },
  pityNote: { fontSize: 10, color: COLORS.chrono.secondary, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  
  summonSection: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summonButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  summonButtonGradient: { paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: COLORS.chrono.primary + '40' },
  summonButtonTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  summonCost: { fontSize: 14, color: COLORS.chrono.secondary, fontWeight: '600' },
  discountTag: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.urgent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontSize: 10, color: COLORS.cream.pure, fontWeight: 'bold', overflow: 'hidden' },
  
  bundlesButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  bundlesGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  bundlesText: { color: COLORS.cream.pure, fontSize: 14, fontWeight: 'bold' },
  
  monetizationBox: { backgroundColor: COLORS.chrono.primary + '20', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.chrono.primary + '40' },
  monetizationTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.chrono.secondary, marginBottom: 6 },
  monetizationText: { fontSize: 13, color: COLORS.cream.soft },
  monetizationCost: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
  
  successBox: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  successGradient: { padding: 20, alignItems: 'center' },
  successTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary, marginTop: 12, textAlign: 'center' },
  successText: { fontSize: 14, color: COLORS.cream.soft, marginTop: 8, textAlign: 'center' },
  
  currencyBar: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  currencyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium + '80', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  currencyText: { color: COLORS.cream.soft, fontWeight: '600', fontSize: 16 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  resultsContainer: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  resultsGradient: { padding: 24 },
  resultsTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.chrono.secondary, textAlign: 'center', marginBottom: 20 },
  resultsScroll: { paddingVertical: 10, gap: 12 },
  resultCard: { width: 100, backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 10, alignItems: 'center', marginRight: 12, borderWidth: 2, borderColor: COLORS.navy.light },
  resultCardFeatured: { borderColor: COLORS.chrono.primary, borderWidth: 3 },
  resultRarity: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  resultRarityText: { color: COLORS.cream.pure, fontSize: 10, fontWeight: 'bold' },
  resultImage: { width: 60, height: 60, borderRadius: 30, marginBottom: 8 },
  resultPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.navy.dark, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  resultName: { color: COLORS.cream.soft, fontSize: 10, textAlign: 'center' },
  featuredBadge: { backgroundColor: COLORS.chrono.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  featuredBadgeText: { color: COLORS.cream.pure, fontSize: 8, fontWeight: 'bold' },
  closeButton: { backgroundColor: COLORS.chrono.primary, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  closeButtonText: { color: COLORS.cream.pure, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  
  bundlesContainer: { width: '100%', maxHeight: '85%', borderRadius: 20, overflow: 'hidden' },
  bundlesModalGradient: { padding: 20 },
  bundlesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bundlesModalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.chrono.secondary },
  bundlesList: { maxHeight: 400 },
  bundleCard: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  bundleGradient: { padding: 16 },
  bundleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bundleName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  bundleTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bundleTagText: { color: COLORS.cream.pure, fontSize: 10, fontWeight: 'bold' },
  bundleContents: { marginBottom: 8 },
  bundleItem: { color: COLORS.cream.soft, fontSize: 13, marginBottom: 4 },
  bundleUrgency: { color: COLORS.chrono.secondary, fontSize: 11, fontStyle: 'italic', marginBottom: 12 },
  bundleFooter: { alignItems: 'flex-end' },
  bundlePriceButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  bundlePrice: { color: COLORS.cream.pure, fontSize: 16, fontWeight: 'bold' },
  
  characterDetailsContainer: { width: '100%', maxHeight: '90%', borderRadius: 20, overflow: 'hidden' },
  characterDetailsGradient: { padding: 20 },
  characterDetailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  characterDetailsTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.chrono.secondary },
  characterDetailsContent: { maxHeight: 500 },
  characterDetailImage: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', borderWidth: 3, borderColor: COLORS.chrono.primary, marginBottom: 12 },
  characterDetailName: { fontSize: 22, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  characterDetailRole: { fontSize: 13, color: COLORS.chrono.secondary, textAlign: 'center', marginBottom: 20 },
  skillsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  skillCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 12, marginBottom: 10 },
  skillHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  skillName: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  skillType: { fontSize: 10, fontWeight: 'bold' },
  skillDesc: { fontSize: 12, color: COLORS.cream.dark, lineHeight: 18 },
  skillDamage: { fontSize: 11, color: COLORS.chrono.secondary, marginTop: 6 },
});
