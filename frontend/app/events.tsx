import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { router } from 'expo-router';

export default function EventsScreen() {
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  const [banners, setBanners] = useState<any[]>([]);
  const [selectedBanner, setSelectedBanner] = useState<any>(null);
  const [bannerDetails, setBannerDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [pullResults, setPullResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (hydrated) {
      loadBanners();
    }
  }, [hydrated]);

  const loadBanners = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/event-banners`
      );
      const data = await response.json();
      setBanners(data.banners || []);
    } catch (error) {
      console.error('Failed to load banners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBannerDetails = async (banner: any) => {
    if (!user) return;
    
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/event-banners/${banner.id}?username=${user.username}`
      );
      const data = await response.json();
      setBannerDetails(data);
      setSelectedBanner(banner);
    } catch (error) {
      console.error('Failed to load banner details:', error);
    }
  };

  const pullBanner = async (multi: boolean) => {
    if (!selectedBanner || !user) return;
    
    setIsPulling(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/event-banners/${selectedBanner.id}/pull?username=${user.username}&multi=${multi}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const result = await response.json();
        setPullResults(result.results || []);
        setShowResults(true);
        loadBannerDetails(selectedBanner);
        fetchUser();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Pull failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pull');
    } finally {
      setIsPulling(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    return COLORS.rarity[rarity as keyof typeof COLORS.rarity] || COLORS.cream.dark;
  };

  const getBannerGradient = (banner: any): [string, string] => {
    if (banner.banner_type === 'divine') {
      return [COLORS.rarity.UR, COLORS.rarity['UR+']];
    }
    const element = Object.keys(banner.rate_boosts || {})[0];
    switch (element) {
      case 'Light': return [COLORS.gold.primary, COLORS.gold.light];
      case 'Dark': return ['#6b5b95', '#9b4dca'];
      case 'Fire': return ['#FF6B35', '#FF9F43'];
      case 'Water': return ['#4A90D9', '#54A0FF'];
      default: return [COLORS.rarity.SSR, COLORS.rarity.UR];
    }
  };

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Limited Events</Text>
          <Text style={styles.subtitle}>Special banners with boosted rates!</Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.gold.primary} style={styles.loader} />
          ) : banners.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color={COLORS.navy.light} />
              <Text style={styles.emptyText}>No active events</Text>
              <Text style={styles.emptySubtext}>Check back later for special banners!</Text>
            </View>
          ) : (
            banners.map((banner) => (
              <TouchableOpacity
                key={banner.id}
                style={styles.bannerCard}
                onPress={() => loadBannerDetails(banner)}
              >
                <LinearGradient
                  colors={getBannerGradient(banner)}
                  style={styles.bannerGradient}
                >
                  <View style={styles.bannerHeader}>
                    <View style={styles.bannerInfo}>
                      <Text style={styles.bannerName}>{banner.name}</Text>
                      <Text style={styles.bannerDesc}>{banner.description}</Text>
                    </View>
                    <View style={styles.timerBadge}>
                      <Ionicons name="time" size={14} color={COLORS.cream.pure} />
                      <Text style={styles.timerText}>{banner.days_remaining}d left</Text>
                    </View>
                  </View>
                  
                  <View style={styles.featuredHeroes}>
                    <Text style={styles.featuredTitle}>Featured Heroes:</Text>
                    <Text style={styles.featuredList}>
                      {banner.featured_heroes?.join(' • ')}
                    </Text>
                  </View>
                  
                  <View style={styles.bannerFooter}>
                    <View style={styles.rateBadge}>
                      <Text style={styles.rateText}>
                        {banner.banner_type === 'divine' ? 'Guaranteed UR+' : '2x Element Rate'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={COLORS.cream.pure} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
        
        {/* Banner Detail Modal */}
        <Modal
          visible={selectedBanner !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedBanner(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setSelectedBanner(null)}
              >
                <Ionicons name="close" size={24} color={COLORS.cream.pure} />
              </TouchableOpacity>
              
              {selectedBanner && (
                <>
                  <LinearGradient
                    colors={getBannerGradient(selectedBanner)}
                    style={styles.modalHeader}
                  >
                    <Text style={styles.modalTitle}>{selectedBanner.name}</Text>
                    <Text style={styles.modalDesc}>{selectedBanner.description}</Text>
                  </LinearGradient>
                  
                  <View style={styles.pitySection}>
                    <Text style={styles.pityLabel}>Pity Counter</Text>
                    <Text style={styles.pityValue}>
                      {bannerDetails?.pity_count || 0} / {bannerDetails?.pity_threshold || 80}
                    </Text>
                    <View style={styles.pityBar}>
                      <View 
                        style={[
                          styles.pityFill, 
                          { width: `${((bannerDetails?.pity_count || 0) / (bannerDetails?.pity_threshold || 80)) * 100}%` }
                        ]} 
                      />
                    </View>
                  </View>
                  
                  <View style={styles.currencySection}>
                    <Ionicons 
                      name={selectedBanner.banner_type === 'divine' ? 'sparkles' : 'diamond'} 
                      size={24} 
                      color={selectedBanner.banner_type === 'divine' ? COLORS.gold.primary : COLORS.rarity['UR+']} 
                    />
                    <Text style={styles.currencyText}>
                      {selectedBanner.banner_type === 'divine' 
                        ? `Divine Essence: ${user.divine_essence || 0}`
                        : `Crystals: ${user.gems || 0}`
                      }
                    </Text>
                  </View>
                  
                  <View style={styles.pullButtons}>
                    <TouchableOpacity
                      style={styles.pullButton}
                      onPress={() => pullBanner(false)}
                      disabled={isPulling}
                    >
                      <LinearGradient
                        colors={[COLORS.navy.medium, COLORS.navy.primary]}
                        style={styles.pullButtonGradient}
                      >
                        {isPulling ? (
                          <ActivityIndicator color={COLORS.cream.pure} />
                        ) : (
                          <>
                            <Text style={styles.pullButtonTitle}>Single</Text>
                            <Text style={styles.pullButtonCost}>
                              {selectedBanner.banner_type === 'divine' ? '1' : '100'}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.pullButton}
                      onPress={() => pullBanner(true)}
                      disabled={isPulling}
                    >
                      <LinearGradient
                        colors={getBannerGradient(selectedBanner)}
                        style={styles.pullButtonGradient}
                      >
                        {isPulling ? (
                          <ActivityIndicator color={COLORS.cream.pure} />
                        ) : (
                          <>
                            <Text style={styles.pullButtonTitle}>10x Pull</Text>
                            <Text style={styles.pullButtonCost}>
                              {selectedBanner.banner_type === 'divine' ? '10' : '900'}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
        
        {/* Pull Results Modal */}
        <Modal
          visible={showResults}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowResults(false)}
        >
          <View style={styles.resultsOverlay}>
            <View style={styles.resultsContent}>
              <Text style={styles.resultsTitle}>Summon Results!</Text>
              <ScrollView style={styles.resultsList}>
                {pullResults.map((result, index) => (
                  <View key={index} style={styles.resultItem}>
                    <Image
                      source={{ uri: result.hero?.image_url }}
                      style={styles.resultImage}
                    />
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, { color: getRarityColor(result.hero?.rarity) }]}>
                        {result.hero?.name}
                      </Text>
                      <View style={styles.resultBadges}>
                        <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(result.hero?.rarity) }]}>
                          <Text style={styles.rarityText}>{result.hero?.rarity}</Text>
                        </View>
                        {result.is_featured && (
                          <View style={styles.featuredBadge}>
                            <Ionicons name="star" size={12} color={COLORS.gold.primary} />
                            <Text style={styles.featuredBadgeText}>Featured</Text>
                          </View>
                        )}
                        {result.is_new ? (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW!</Text>
                          </View>
                        ) : (
                          <Text style={styles.duplicateText}>+1 Shard</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.closeResultsButton}
                onPress={() => setShowResults(false)}
              >
                <Text style={styles.closeResultsText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 20 },
  loader: { marginTop: 40 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.cream.dark, marginTop: 4 },
  bannerCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  bannerGradient: { padding: 20 },
  bannerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  bannerInfo: { flex: 1, marginRight: 12 },
  bannerName: { fontSize: 22, fontWeight: 'bold', color: COLORS.cream.pure },
  bannerDesc: { fontSize: 13, color: COLORS.cream.soft, marginTop: 4 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.darkest + '60', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  timerText: { fontSize: 12, fontWeight: 'bold', color: COLORS.cream.pure },
  featuredHeroes: { marginBottom: 12 },
  featuredTitle: { fontSize: 12, color: COLORS.cream.soft },
  featuredList: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  bannerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rateBadge: { backgroundColor: COLORS.navy.darkest + '60', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  rateText: { fontSize: 12, fontWeight: 'bold', color: COLORS.gold.light },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.navy.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  closeButton: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  modalHeader: { padding: 24, paddingTop: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure },
  modalDesc: { fontSize: 14, color: COLORS.cream.soft, marginTop: 4 },
  pitySection: { padding: 16 },
  pityLabel: { fontSize: 12, color: COLORS.cream.dark },
  pityValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 8 },
  pityBar: { height: 8, backgroundColor: COLORS.navy.medium, borderRadius: 4, overflow: 'hidden' },
  pityFill: { height: '100%', backgroundColor: COLORS.gold.primary, borderRadius: 4 },
  currencySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  currencyText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  pullButtons: { flexDirection: 'row', padding: 16, gap: 12, paddingBottom: 32 },
  pullButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  pullButtonGradient: { padding: 16, alignItems: 'center' },
  pullButtonTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  pullButtonCost: { fontSize: 14, color: COLORS.cream.soft },
  resultsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  resultsContent: { backgroundColor: COLORS.navy.primary, borderRadius: 20, padding: 20, width: '90%', maxHeight: '80%' },
  resultsTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, textAlign: 'center', marginBottom: 16 },
  resultsList: { maxHeight: 400 },
  resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 12, marginBottom: 8 },
  resultImage: { width: 60, height: 60, borderRadius: 8 },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultName: { fontSize: 14, fontWeight: 'bold' },
  resultBadges: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6, flexWrap: 'wrap' },
  rarityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rarityText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold.dark, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 2 },
  featuredBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  newBadge: { backgroundColor: COLORS.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  duplicateText: { fontSize: 10, color: COLORS.cream.dark },
  closeResultsButton: { backgroundColor: COLORS.gold.primary, padding: 16, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  closeResultsText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
