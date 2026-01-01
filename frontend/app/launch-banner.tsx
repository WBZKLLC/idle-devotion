import React, { useEffect, useState, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666', glow: '#ffd700' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
  celestial: { primary: '#7c3aed', secondary: '#a78bfa', glow: '#c4b5fd' },
  urgent: '#ef4444',
};

export default function LaunchBannerScreen() {
  const router = useRouter();
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [loading, setLoading] = useState(true);
  const [bannerData, setBannerData] = useState<any>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullResults, setPullResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const [bundles, setBundles] = useState<any[]>([]);
  const [showHeroDetails, setShowHeroDetails] = useState(false);
  
  // Animations
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerShakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (hydrated && user) {
      loadBannerData();
    }
  }, [hydrated, user?.username]);

  const loadBannerData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/launch-banner/status/${user?.username}`
      );
      if (response.ok) {
        const data = await response.json();
        setBannerData(data);
        
        // Trigger urgency animation if time is running low
        if (data.time_remaining?.hours_remaining < 24) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(timerShakeAnim, { toValue: 5, duration: 100, useNativeDriver: true }),
              Animated.timing(timerShakeAnim, { toValue: -5, duration: 100, useNativeDriver: true }),
              Animated.timing(timerShakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
            ])
          ).start();
        }
      }
    } catch (error) {
      console.error('Error loading banner:', error);
    } finally {
      setLoading(false);
    }
  };

  const performPull = async (multi: boolean) => {
    if (!user || isPulling) return;
    
    setIsPulling(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/launch-banner/pull/${user.username}?multi=${multi}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPullResults(data.results);
        setShowResults(true);
        
        // Check for triggered bundles
        if (data.triggered_bundles?.length > 0) {
          setBundles(data.triggered_bundles);
          // Show bundles after results modal closes
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
      return `${days}d ${remainingHours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  const getUrgencyColor = () => {
    if (!bannerData?.time_remaining) return COLORS.urgent;
    const hours = bannerData.time_remaining.hours_remaining || 0;
    if (hours < 12) return '#ff0000';
    if (hours < 24) return '#ff6b35';
    if (hours < 48) return '#f59e0b';
    return COLORS.gold.primary;
  };

  if (!hydrated || loading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, '#1a0a2e', COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading Celestial Descent...</Text>
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

  const hero = bannerData?.banner?.featured_hero;
  const pityCounter = bannerData?.user_progress?.pity_counter || 0;
  const hasHero = bannerData?.user_progress?.has_featured_hero || false;
  const currentRate = bannerData?.current_rate?.featured_rate || 1;

  return (
    <LinearGradient colors={['#1a0a2e', COLORS.navy.darkest, '#0d0a1f']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>✨ CELESTIAL DESCENT ✨</Text>
            <Text style={styles.headerSubtitle}>LIMITED TIME EXCLUSIVE</Text>
          </View>
          <TouchableOpacity style={styles.infoButton} onPress={() => setShowHeroDetails(true)}>
            <Ionicons name="information-circle" size={24} color={COLORS.gold.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* URGENT TIMER */}
          <Animated.View style={[styles.timerContainer, { transform: [{ translateX: timerShakeAnim }] }]}>
            <LinearGradient
              colors={[getUrgencyColor() + '40', getUrgencyColor() + '10']}
              style={styles.timerGradient}
            >
              <Ionicons name="time" size={20} color={getUrgencyColor()} />
              <Text style={[styles.timerText, { color: getUrgencyColor() }]}>
                ⏰ {formatTimeRemaining()} REMAINING
              </Text>
              <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor() }]} />
            </LinearGradient>
          </Animated.View>

          {/* FEATURED HERO SHOWCASE */}
          <Animated.View style={[styles.heroShowcase, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['#7c3aed20', COLORS.gold.primary + '20', '#7c3aed20']}
              style={styles.heroGradient}
            >
              {/* Glow Effect */}
              <Animated.View
                style={[
                  styles.heroGlow,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.8],
                    }),
                  },
                ]}
              />

              <View style={styles.heroImageContainer}>
                <Image
                  source={{ uri: hero?.image_url || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400' }}
                  style={styles.heroImage}
                />
                <View style={styles.rarityBadge}>
                  <Text style={styles.rarityText}>UR</Text>
                </View>
                {hasHero && (
                  <View style={styles.ownedBadge}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.gold.primary} />
                    <Text style={styles.ownedText}>OWNED</Text>
                  </View>
                )}
              </View>

              <Text style={styles.heroName}>{hero?.name || 'Aethon, The Celestial Blade'}</Text>
              <Text style={styles.heroTagline}>{hero?.marketing?.tagline || 'The Blade That Cleaves Destiny'}</Text>
              
              <View style={styles.heroStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ATK</Text>
                  <Text style={styles.statValue}>{hero?.base_atk || 480}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>HP</Text>
                  <Text style={styles.statValue}>{hero?.base_hp?.toLocaleString() || '12,000'}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>SPD</Text>
                  <Text style={styles.statValue}>{hero?.speed || 125}</Text>
                </View>
              </View>

              <View style={styles.exclusiveTag}>
                <Ionicons name="lock-closed" size={14} color={COLORS.urgent} />
                <Text style={styles.exclusiveText}>EXCLUSIVE FOR 6 MONTHS</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* PITY PROGRESS */}
          <View style={styles.pitySection}>
            <View style={styles.pityHeader}>
              <Text style={styles.pityTitle}>🎯 Guarantee Progress</Text>
              <Text style={styles.pityCounter}>{pityCounter} / 80</Text>
            </View>
            <View style={styles.pityBarOuter}>
              <LinearGradient
                colors={[COLORS.celestial.primary, COLORS.gold.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.pityBarFill, { width: `${(pityCounter / 80) * 100}%` }]}
              />
              {/* Soft pity marker */}
              <View style={[styles.pityMarker, { left: '62.5%' }]}>
                <Text style={styles.pityMarkerText}>50</Text>
              </View>
              {/* Hard pity marker */}
              <View style={[styles.pityMarker, { left: '100%', marginLeft: -20 }]}>
                <Text style={styles.pityMarkerText}>80</Text>
              </View>
            </View>
            <View style={styles.pityInfo}>
              <Text style={styles.pityInfoText}>
                {pityCounter >= 50 ? `🔥 SOFT PITY ACTIVE! Rate: ${currentRate}%` : 
                 pityCounter >= 40 ? '⚡ 10 pulls to soft pity!' :
                 `Current Rate: ${currentRate}%`}
              </Text>
              <Text style={styles.pityGuarantee}>
                {80 - pityCounter} pulls to guaranteed Aethon
              </Text>
            </View>
          </View>

          {/* RATES INFO */}
          <View style={styles.ratesBox}>
            <Text style={styles.ratesTitle}>📊 Banner Rates</Text>
            <View style={styles.ratesRow}>
              <View style={styles.rateItem}>
                <Text style={styles.rateName}>Aethon (Featured)</Text>
                <Text style={[styles.rateValue, { color: COLORS.gold.primary }]}>1.0%</Text>
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
              ✨ Soft pity at 50 pulls (+5% per pull) • Hard pity at 80 pulls (100% guaranteed)
            </Text>
          </View>

          {/* SUMMON BUTTONS */}
          <View style={styles.summonSection}>
            <TouchableOpacity
              style={styles.summonButton}
              onPress={() => performPull(false)}
              disabled={isPulling}
            >
              <LinearGradient
                colors={[COLORS.navy.medium, COLORS.navy.dark]}
                style={styles.summonButtonGradient}
              >
                {isPulling ? (
                  <ActivityIndicator color={COLORS.gold.primary} />
                ) : (
                  <>
                    <Text style={styles.summonButtonTitle}>Single</Text>
                    <View style={styles.costRow}>
                      <Ionicons name="diamond" size={14} color={COLORS.gold.light} />
                      <Text style={styles.summonCost}>300</Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.summonButton}
              onPress={() => performPull(true)}
              disabled={isPulling}
            >
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.summonButtonGradient}
              >
                {isPulling ? (
                  <ActivityIndicator color={COLORS.navy.darkest} />
                ) : (
                  <>
                    <Text style={[styles.summonButtonTitle, { color: COLORS.navy.darkest }]}>×10</Text>
                    <View style={styles.costRow}>
                      <Ionicons name="diamond" size={14} color={COLORS.navy.darkest} />
                      <Text style={[styles.summonCost, { color: COLORS.navy.darkest }]}>2,700</Text>
                    </View>
                    <Text style={styles.discountTag}>10% OFF</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* BUNDLES BUTTON */}
          <TouchableOpacity style={styles.bundlesButton} onPress={() => setShowBundles(true)}>
            <LinearGradient colors={['#9333ea', '#7c3aed']} style={styles.bundlesGradient}>
              <Ionicons name="gift" size={20} color={COLORS.cream.pure} />
              <Text style={styles.bundlesText}>💰 View Exclusive Bundles</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.cream.pure} />
            </LinearGradient>
          </TouchableOpacity>

          {/* MONETIZATION INFO */}
          {bannerData?.monetization && (
            <View style={styles.monetizationBox}>
              <Text style={styles.monetizationTitle}>💎 Path to Guarantee</Text>
              <Text style={styles.monetizationText}>
                {bannerData.monetization.message}
              </Text>
              <Text style={styles.monetizationCost}>
                ~{bannerData.monetization.crystals_needed?.toLocaleString()} crystals needed
              </Text>
            </View>
          )}

          {/* CURRENCY BAR */}
          <View style={styles.currencyBar}>
            <View style={styles.currencyItem}>
              <Ionicons name="diamond" size={16} color="#9b4dca" />
              <Text style={styles.currencyText}>{user.gems?.toLocaleString() || 0}</Text>
            </View>
          </View>
        </ScrollView>

        {/* RESULTS MODAL */}
        <Modal visible={showResults} animationType="fade" transparent onRequestClose={() => setShowResults(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.resultsContainer}>
              <LinearGradient colors={['#1a0a2e', COLORS.navy.dark]} style={styles.resultsGradient}>
                <Text style={styles.resultsTitle}>
                  {pullResults.some(r => r.is_featured) ? '🌟 LEGENDARY PULL! 🌟' : 'Summon Results'}
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
                      <View style={[styles.resultRarity, { backgroundColor: result.is_featured ? COLORS.gold.primary : result.rarity === 'SSR' ? '#9b4dca' : '#8b9dc3' }]}>
                        <Text style={styles.resultRarityText}>{result.rarity}</Text>
                      </View>
                      {result.is_featured && result.hero ? (
                        <>
                          <Image source={{ uri: result.hero.image_url }} style={styles.resultImage} />
                          <Text style={styles.resultName}>{result.hero.name?.split(',')[0]}</Text>
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
                    if (bundles.length > 0) {
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
              <LinearGradient colors={['#1a0a2e', COLORS.navy.dark]} style={styles.bundlesModalGradient}>
                <View style={styles.bundlesHeader}>
                  <Text style={styles.bundlesModalTitle}>💎 Exclusive Offers</Text>
                  <TouchableOpacity onPress={() => setShowBundles(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.bundlesList}>
                  {Object.entries({
                    starter_summon_pack: { name: '⚡ Starter Pack', price: '$4.99', value: '5x VALUE', pulls: 10, crystals: 500, tag: 'BEST VALUE' },
                    ascension_bundle: { name: '🌟 Ascension Bundle', price: '$49.99', value: '4x VALUE', pulls: 40, crystals: 2000, tag: 'REACH GUARANTEE' },
                    celestial_path: { name: '👑 Celestial Path', price: '$99.99', value: '3.5x VALUE', pulls: 80, crystals: 5000, tag: 'INSTANT AETHON' },
                    final_push: { name: '🔥 Final Push', price: '$19.99', value: '4x VALUE', pulls: 15, crystals: 1000, tag: 'SO CLOSE!' },
                  }).map(([id, bundle]) => (
                    <TouchableOpacity key={id} style={styles.bundleCard}>
                      <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.bundleGradient}>
                        <View style={styles.bundleHeader}>
                          <Text style={styles.bundleName}>{bundle.name}</Text>
                          <View style={styles.bundleTag}>
                            <Text style={styles.bundleTagText}>{bundle.tag}</Text>
                          </View>
                        </View>
                        <View style={styles.bundleContents}>
                          <Text style={styles.bundleItem}>🎫 {bundle.pulls} Summons</Text>
                          <Text style={styles.bundleItem}>💎 {bundle.crystals} Crystals</Text>
                          <Text style={styles.bundleItem}>🪙 Bonus Gold</Text>
                        </View>
                        <View style={styles.bundleFooter}>
                          <View>
                            <Text style={styles.bundleValue}>{bundle.value}</Text>
                            <Text style={styles.bundleOriginal}>vs regular price</Text>
                          </View>
                          <View style={styles.bundlePriceButton}>
                            <Text style={styles.bundlePrice}>{bundle.price}</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.bundleNote}>
                  💡 Bundles are limited per account • Payment handled by App Store
                </Text>
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* HERO DETAILS MODAL */}
        <Modal visible={showHeroDetails} animationType="slide" transparent onRequestClose={() => setShowHeroDetails(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.heroDetailsContainer}>
              <LinearGradient colors={['#1a0a2e', COLORS.navy.dark]} style={styles.heroDetailsGradient}>
                <View style={styles.heroDetailsHeader}>
                  <Text style={styles.heroDetailsTitle}>⚔️ Hero Details</Text>
                  <TouchableOpacity onPress={() => setShowHeroDetails(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.heroDetailsContent}>
                  <Image source={{ uri: hero?.image_url }} style={styles.heroDetailImage} />
                  <Text style={styles.heroDetailName}>{hero?.name}</Text>
                  <Text style={styles.heroDetailRole}>{hero?.element} • {hero?.hero_class} • {hero?.role}</Text>
                  
                  <Text style={styles.skillsTitle}>Skills</Text>
                  {hero?.skills?.map((skill: any, index: number) => (
                    <View key={index} style={styles.skillCard}>
                      <View style={styles.skillHeader}>
                        <Text style={styles.skillName}>{skill.name}</Text>
                        <Text style={[styles.skillType, { color: skill.type === 'ultimate' ? COLORS.gold.primary : skill.type === 'passive' ? '#22c55e' : COLORS.celestial.secondary }]}>
                          {skill.type?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.skillDesc}>{skill.description}</Text>
                      {skill.damage_multiplier > 0 && (
                        <Text style={styles.skillDamage}>⚔️ {skill.damage_multiplier * 100}% ATK</Text>
                      )}
                    </View>
                  ))}
                  
                  <View style={styles.loreBox}>
                    <Text style={styles.loreTitle}>Lore</Text>
                    <Text style={styles.loreText}>{hero?.story_introduction?.cutscene}</Text>
                  </View>
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
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16 },
  errorText: { color: COLORS.cream.dark, fontSize: 16 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary, letterSpacing: 1 },
  headerSubtitle: { fontSize: 10, color: COLORS.urgent, marginTop: 2, letterSpacing: 2 },
  infoButton: { padding: 8 },
  
  content: { padding: 16, paddingBottom: 40 },
  
  timerContainer: { marginBottom: 16 },
  timerGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 8 },
  timerText: { fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  
  heroShowcase: { marginBottom: 20 },
  heroGradient: { padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: COLORS.gold.dark + '60', position: 'relative', overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -50, left: -50, right: -50, bottom: -50, backgroundColor: COLORS.gold.glow, borderRadius: 200 },
  heroImageContainer: { position: 'relative', marginBottom: 16 },
  heroImage: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, borderColor: COLORS.gold.primary },
  rarityBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.gold.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  rarityText: { color: COLORS.navy.darkest, fontWeight: 'bold', fontSize: 14 },
  ownedBadge: { position: 'absolute', bottom: -10, left: '50%', marginLeft: -40, flexDirection: 'row', alignItems: 'center', backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  ownedText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 10 },
  heroName: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 4 },
  heroTagline: { fontSize: 14, color: COLORS.gold.light, fontStyle: 'italic', textAlign: 'center', marginBottom: 16 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: COLORS.cream.dark },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  statDivider: { width: 1, height: 30, backgroundColor: COLORS.gold.dark + '40' },
  exclusiveTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.urgent + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 16 },
  exclusiveText: { color: COLORS.urgent, fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  
  pitySection: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 16, marginBottom: 16 },
  pityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pityTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  pityCounter: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary },
  pityBarOuter: { height: 12, backgroundColor: COLORS.navy.dark, borderRadius: 6, overflow: 'hidden', position: 'relative' },
  pityBarFill: { height: '100%', borderRadius: 6 },
  pityMarker: { position: 'absolute', top: -16, alignItems: 'center' },
  pityMarkerText: { fontSize: 10, color: COLORS.cream.dark },
  pityInfo: { marginTop: 12 },
  pityInfoText: { fontSize: 13, color: COLORS.gold.light, textAlign: 'center' },
  pityGuarantee: { fontSize: 12, color: COLORS.cream.dark, textAlign: 'center', marginTop: 4 },
  
  ratesBox: { backgroundColor: COLORS.navy.medium + '80', borderRadius: 12, padding: 14, marginBottom: 20 },
  ratesTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 10 },
  ratesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rateItem: { alignItems: 'center' },
  rateName: { fontSize: 10, color: COLORS.cream.dark, marginBottom: 2 },
  rateValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.soft },
  pityNote: { fontSize: 10, color: COLORS.gold.light, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  
  summonSection: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summonButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  summonButtonGradient: { paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  summonButtonTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  summonCost: { fontSize: 14, color: COLORS.gold.light, fontWeight: '600' },
  discountTag: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.urgent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  
  bundlesButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  bundlesGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  bundlesText: { color: COLORS.cream.pure, fontSize: 14, fontWeight: 'bold' },
  
  monetizationBox: { backgroundColor: COLORS.gold.primary + '20', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.gold.primary + '40' },
  monetizationTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 6 },
  monetizationText: { fontSize: 13, color: COLORS.cream.soft },
  monetizationCost: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
  
  currencyBar: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  currencyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium + '80', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  currencyText: { color: COLORS.cream.soft, fontWeight: '600', fontSize: 16 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  resultsContainer: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  resultsGradient: { padding: 24 },
  resultsTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, textAlign: 'center', marginBottom: 20 },
  resultsScroll: { paddingVertical: 10, gap: 12 },
  resultCard: { width: 100, backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 10, alignItems: 'center', marginRight: 12, borderWidth: 2, borderColor: COLORS.navy.light },
  resultCardFeatured: { borderColor: COLORS.gold.primary, borderWidth: 3 },
  resultRarity: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  resultRarityText: { color: COLORS.cream.pure, fontSize: 10, fontWeight: 'bold' },
  resultImage: { width: 60, height: 60, borderRadius: 30, marginBottom: 8 },
  resultPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.navy.dark, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  resultName: { color: COLORS.cream.soft, fontSize: 10, textAlign: 'center' },
  featuredBadge: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  featuredBadgeText: { color: COLORS.navy.darkest, fontSize: 8, fontWeight: 'bold' },
  closeButton: { backgroundColor: COLORS.gold.primary, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  closeButtonText: { color: COLORS.navy.darkest, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  
  bundlesContainer: { width: '100%', maxHeight: '85%', borderRadius: 20, overflow: 'hidden' },
  bundlesModalGradient: { padding: 20 },
  bundlesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bundlesModalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  bundlesList: { maxHeight: 400 },
  bundleCard: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  bundleGradient: { padding: 16 },
  bundleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bundleName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  bundleTag: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bundleTagText: { color: COLORS.navy.darkest, fontSize: 10, fontWeight: 'bold' },
  bundleContents: { marginBottom: 12 },
  bundleItem: { color: COLORS.cream.soft, fontSize: 13, marginBottom: 4 },
  bundleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bundleValue: { color: COLORS.gold.light, fontSize: 14, fontWeight: 'bold' },
  bundleOriginal: { color: COLORS.cream.dark, fontSize: 10 },
  bundlePriceButton: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  bundlePrice: { color: COLORS.navy.darkest, fontSize: 16, fontWeight: 'bold' },
  bundleNote: { color: COLORS.cream.dark, fontSize: 10, textAlign: 'center', marginTop: 12 },
  
  heroDetailsContainer: { width: '100%', maxHeight: '90%', borderRadius: 20, overflow: 'hidden' },
  heroDetailsGradient: { padding: 20 },
  heroDetailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heroDetailsTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  heroDetailsContent: { maxHeight: 500 },
  heroDetailImage: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', borderWidth: 3, borderColor: COLORS.gold.primary, marginBottom: 12 },
  heroDetailName: { fontSize: 22, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  heroDetailRole: { fontSize: 13, color: COLORS.gold.light, textAlign: 'center', marginBottom: 20 },
  skillsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  skillCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 12, marginBottom: 10 },
  skillHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  skillName: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  skillType: { fontSize: 10, fontWeight: 'bold' },
  skillDesc: { fontSize: 12, color: COLORS.cream.dark, lineHeight: 18 },
  skillDamage: { fontSize: 11, color: COLORS.gold.light, marginTop: 6 },
  loreBox: { backgroundColor: COLORS.navy.medium + '60', borderRadius: 12, padding: 14, marginTop: 16 },
  loreTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 8 },
  loreText: { fontSize: 12, color: COLORS.cream.soft, lineHeight: 18, fontStyle: 'italic' },
});
