import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { isErrorHandledGlobally } from '../lib/api';
// Phase 3.18.3: Toast for summon feedback
import { toast } from '../components/ui/Toast';
// Phase 3.19.1: Skeleton + Empty state components
import { BannerSkeleton } from '../components/ui/Skeleton';
import { NoBannersEmpty } from '../components/ui/EmptyState';
// Phase 3.19.2: Canonical button components
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SecondaryButton } from '../components/ui/SecondaryButton';
// Phase 3.19.6: Canonical header + layout constants
import { AppHeader, LAYOUT } from '../components/ui/AppHeader';
// Phase 3.19.7: Cinematic loading screen
import { CinematicLoading } from '../components/ui/CinematicLoading';

// Centralized API wrappers (no raw fetch in screens)
import { pullGacha } from '../lib/api';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0', dark: '#e8e0d0' },
};

const COMMON_RATES = { "SR": 90.8, "SSR": 8, "SSR+": 1.2 };
const PREMIUM_RATES = { "SR": 66.8, "SSR": 32, "UR": 1.2 };
const DIVINE_RATES = { 
  "UR+": 0.8, 
  "UR": 2.7, 
  "💎8K": 1.2, 
  "💎5K": 1.7, 
  "💎3K": 3, 
  "Filler": 90.6 
};

export default function SummonHubScreen() {
  const router = useRouter();
  const { user, fetchUser, userHeroes } = useGameStore();
  const hydrated = useHydration();
  const [selectedBanner, setSelectedBanner] = useState<'common' | 'premium' | 'divine'>('common');
  const [isLoading, setIsLoading] = useState(false);
  const [pullResults, setPullResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [lastPullType, setLastPullType] = useState<'single' | 'multi'>('single');
  const [pityBefore, setPityBefore] = useState(0);

  useEffect(() => { if (hydrated && user) fetchUser(); }, [hydrated, user?.username]);

  // =============================================================================
  // Phase 3.19.3: Summon Result Analysis Helpers
  // =============================================================================
  
  // Rarity priority for "best hero" selection
  const RARITY_PRIORITY: Record<string, number> = {
    'UR+': 6, 'UR': 5, 'SSR+': 4, 'SSR': 3, 'SR': 2, 'R': 1, 'N': 0
  };

  // Analyze summon results
  const resultAnalysis = useMemo(() => {
    const heroes = pullResults.filter(r => !r.is_filler);
    const fillers = pullResults.filter(r => r.is_filler);
    
    // Count new vs duplicates (new heroes have is_new flag from backend)
    const newHeroes = heroes.filter(h => h.is_new);
    const duplicates = heroes.filter(h => !h.is_new);
    
    // Find best hero by rarity then stars
    const bestHero = heroes.length > 0 
      ? heroes.reduce((best, current) => {
          const bestPriority = RARITY_PRIORITY[best.rarity] || 0;
          const currentPriority = RARITY_PRIORITY[current.rarity] || 0;
          if (currentPriority > bestPriority) return current;
          if (currentPriority === bestPriority && (current.stars || 0) > (best.stars || 0)) return current;
          return best;
        })
      : null;
    
    // Calculate total shards/currency gained from fillers
    const shardCount = fillers.filter(f => f.type?.includes('shard')).length;
    const currencyGains = fillers.filter(f => !f.type?.includes('shard'));
    
    // Check if any hero hit promotion threshold (would need backend to tell us)
    const promotionReady = heroes.find(h => h.promotion_ready);
    
    return {
      heroes,
      newHeroes,
      duplicates,
      fillers,
      bestHero,
      shardCount,
      currencyGains,
      promotionReady,
      hasNewHero: newHeroes.length > 0,
      totalHeroes: heroes.length,
      pityReset: getPityCounter() === 0 && pityBefore > 0,
    };
  }, [pullResults, pityBefore]);

  // Determine primary CTA
  const getPrimaryCTA = () => {
    if (resultAnalysis.hasNewHero && resultAnalysis.bestHero?.hero_id) {
      return {
        label: 'View Hero',
        action: () => {
          setShowResults(false);
          // Find the user hero by hero_id
          const userHero = userHeroes.find(h => h.hero_data?.id === resultAnalysis.bestHero.hero_id);
          if (userHero) {
            router.push(`/hero-detail?id=${userHero.id}&tier=1`);
          } else {
            router.push('/heroes');
          }
        },
        icon: 'person',
      };
    }
    if (resultAnalysis.promotionReady) {
      return {
        label: 'Upgrade Now',
        action: () => {
          setShowResults(false);
          router.push('/hero-progression');
        },
        icon: 'arrow-up-circle',
      };
    }
    return {
      label: 'Go to Heroes',
      action: () => {
        setShowResults(false);
        router.push('/heroes');
      },
      icon: 'people',
    };
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'SR': return '#8b9dc3';
      case 'SSR': return COLORS.gold.primary;
      case 'SSR+': return COLORS.gold.dark;
      case 'UR': return '#6b5b95';
      case 'UR+': return '#9b4dca';
      default: return '#808080';
    }
  };

  const performPull = async (pullType: 'single' | 'multi') => {
    if (!user) return;
    let currencyType = 'coins', cost = 0, currencyBalance = 0, currencyName = 'Coins';
    if (selectedBanner === 'divine') { currencyType = 'divine_essence'; cost = pullType === 'single' ? 1 : 10; currencyBalance = user.divine_essence || 0; currencyName = 'Divine Essence'; }
    else if (selectedBanner === 'premium') { currencyType = 'crystals'; cost = pullType === 'single' ? 100 : 1000; currencyBalance = user.gems || 0; currencyName = 'Crystals'; }
    else { currencyType = 'coins'; cost = pullType === 'single' ? 1000 : 10000; currencyBalance = user.coins || 0; currencyName = 'Coins'; }
    if (currencyBalance < cost) { 
      // Phase 3.18.3: Use toast for insufficient funds (non-blocking)
      toast.warning(`You need ${cost.toLocaleString()} ${currencyName}`);
      return; 
    }
    
    // Phase 3.19.3: Track pity before pull for recap
    setPityBefore(getPityCounter());
    setLastPullType(pullType);
    
    setIsLoading(true);
    try {
      // Use centralized API wrapper
      const data = await pullGacha(user.username, pullType, currencyType);
      setPullResults(data.heroes || []);
      setShowResults(true);
      await fetchUser();
      
      // Phase 3.18.3: Success toast with banner-appropriate variant
      const toastVariant = (selectedBanner === 'premium' || selectedBanner === 'divine') ? 'premium' : 'success';
      const toastMessage = pullType === 'multi' ? 'x10 Summon complete!' : 'Summon complete!';
      if (toastVariant === 'premium') {
        toast.premium(toastMessage);
      } else {
        toast.success(toastMessage);
      }
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        // Phase 3.18.3: Error toast instead of Alert
        toast.error('Summon failed. Please try again.');
      }
    }
    finally { setIsLoading(false); }
  };

  const getPityCounter = () => { if (!user) return 0; if (selectedBanner === 'divine') return user.pity_counter_divine || 0; if (selectedBanner === 'premium') return user.pity_counter_premium || 0; return user.pity_counter || 0; };
  const getPityMax = () => selectedBanner === 'divine' ? 40 : 50;

  const getFillerRewardIcon = (type: string) => {
    if (type.includes('crystals')) return '💎';
    if (type.includes('divine_essence')) return '✨';
    if (type.includes('gold')) return '🪙';
    if (type.includes('coins')) return '💰';
    if (type.includes('hero_shards')) return '⭐';
    return '🎁';
  };

  const getFillerRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return '#ff6b35';
      case 'epic': return '#9b4dca';
      case 'rare': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const renderResultsModal = () => {
    const primaryCTA = getPrimaryCTA();
    const currentPity = getPityCounter();
    
    return (
      <Modal visible={showResults} animationType="fade" transparent={true} onRequestClose={() => setShowResults(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.resultsContainer}>
            <LinearGradient colors={[COLORS.navy.dark, COLORS.navy.primary]} style={styles.resultsGradient}>
              <Text style={styles.resultsTitle}>Summon Results</Text>
              
              {/* Phase 3.19.3: Result Recap Summary */}
              <View style={styles.recapStrip}>
                {resultAnalysis.hasNewHero ? (
                  <View style={styles.recapHighlight}>
                    <Ionicons name="sparkles" size={16} color={COLORS.gold.primary} />
                    <Text style={styles.recapHighlightText}>
                      {resultAnalysis.newHeroes.length === 1 
                        ? 'New hero unlocked!' 
                        : `${resultAnalysis.newHeroes.length} new heroes unlocked!`}
                    </Text>
                  </View>
                ) : resultAnalysis.totalHeroes > 0 ? (
                  <View style={styles.recapHighlight}>
                    <Ionicons name="repeat" size={16} color={COLORS.gold.light} />
                    <Text style={styles.recapHighlightText}>Duplicates converted to shards</Text>
                  </View>
                ) : null}
                
                {/* Counts row */}
                <View style={styles.recapCounts}>
                  {resultAnalysis.totalHeroes > 0 && (
                    <View style={styles.recapCount}>
                      <Text style={styles.recapCountValue}>+{resultAnalysis.totalHeroes}</Text>
                      <Text style={styles.recapCountLabel}>Heroes</Text>
                    </View>
                  )}
                  {resultAnalysis.fillers.length > 0 && (
                    <View style={styles.recapCount}>
                      <Text style={styles.recapCountValue}>+{resultAnalysis.fillers.length}</Text>
                      <Text style={styles.recapCountLabel}>Rewards</Text>
                    </View>
                  )}
                </View>
                
                {/* Pity impact */}
                {pityBefore > 0 && (
                  <View style={styles.recapPity}>
                    <Text style={styles.recapPityText}>
                      Pity: {pityBefore} → {currentPity}
                      {resultAnalysis.pityReset && ' 🎉'}
                    </Text>
                  </View>
                )}
              </View>
              
              {/* Hero Cards Scroll */}
              <ScrollView horizontal contentContainerStyle={styles.resultsScroll} showsHorizontalScrollIndicator={false}>
                {pullResults.map((item, index) => (
                  <View key={index} style={[
                    styles.heroResultCard, 
                    { borderColor: item.is_filler 
                      ? getFillerRarityColor(item.rarity || 'common') 
                      : getRarityColor(item.rarity || 'SR') 
                    },
                    item.is_new && styles.heroResultCardNew,
                  ]}>
                    {item.is_filler ? (
                      // Filler Reward Card
                      <>
                        <View style={[styles.rarityBadge, { backgroundColor: getFillerRarityColor(item.rarity || 'common') }]}>
                          <Text style={styles.rarityText}>{item.rarity?.toUpperCase() || 'REWARD'}</Text>
                        </View>
                        <View style={styles.fillerIconContainer}>
                          <Text style={styles.fillerIcon}>{getFillerRewardIcon(item.type)}</Text>
                        </View>
                        <Text style={styles.heroName} numberOfLines={2}>{item.display || 'Reward'}</Text>
                      </>
                    ) : (
                      // Hero Card
                      <>
                        <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(item.rarity || 'SR') }]}>
                          <Text style={styles.rarityText}>{item.rarity || 'SR'}</Text>
                        </View>
                        {item.is_new && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                        {item.image_url ? (
                          <Image 
                            source={{ uri: item.image_url }} 
                            style={styles.heroImage} 
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.heroImagePlaceholder}>
                            <Ionicons name="person" size={40} color={COLORS.cream.soft} />
                          </View>
                        )}
                        <Text style={styles.heroName} numberOfLines={2}>{item.hero_name || item.name || 'Unknown'}</Text>
                        {item.element && (
                          <Text style={[styles.heroElement, { color: getElementColor(item.element) }]}>{item.element}</Text>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </ScrollView>
              
              {/* Phase 3.19.3: Progression tip (non-deceptive) */}
              <View style={styles.progressionTip}>
                <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.progressionTipText}>
                  Tip: Duplicates become shards used for star promotion.
                </Text>
              </View>
              
              {/* Phase 3.19.3: Smart CTA Stack */}
              <View style={styles.ctaStack}>
                {/* Primary CTA */}
                <PrimaryButton
                  title={primaryCTA.label}
                  onPress={primaryCTA.action}
                  leftIcon={<Ionicons name={primaryCTA.icon as any} size={18} color={COLORS.navy.darkest} />}
                  variant="gold"
                  size="lg"
                />
                
                {/* Secondary CTAs */}
                <View style={styles.secondaryCTAs}>
                  <SecondaryButton
                    title="Summon Again"
                    onPress={() => {
                      setShowResults(false);
                      // Small delay to let modal close
                      setTimeout(() => performPull(lastPullType), 300);
                    }}
                    variant="subtle"
                    size="sm"
                    leftIcon={<Ionicons name="refresh" size={14} color={COLORS.gold.light} />}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <SecondaryButton
                    title="Close"
                    onPress={() => setShowResults(false)}
                    variant="ghost"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    );
  };

  const getElementColor = (element: string) => {
    const colors: {[key: string]: string} = {
      Fire: '#e74c3c',
      Water: '#3498db',
      Earth: '#8b4513',
      Wind: '#2ecc71',
      Light: '#f1c40f',
      Dark: '#9b59b6',
    };
    return colors[element] || COLORS.gold.primary;
  };

  // Phase 3.19.7: Cinematic loading screen for initial hydration
  if (!hydrated) return <CinematicLoading subtitle="Preparing the summon altar..." />;
  
  if (!user) return (<LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}><SafeAreaView style={styles.container} edges={['top', 'left', 'right']}><Text style={styles.loginText}>Please log in first</Text></SafeAreaView></LinearGradient>);

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Phase 3.19.6: Canonical header */}
        <AppHeader
          title="Summon"
          subtitle="Choose a banner"
          left={{ type: 'back' }}
          includeSafeArea={false}
          centerTitle={false}
        />
        
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Scrollable Currency Bar */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.currencyBarScroll}
            contentContainerStyle={styles.currencyBarContent}
          >
            <View style={styles.currencyItem}>
              <Ionicons name="star" size={14} color={COLORS.gold.primary} />
              <Text style={styles.currencyText}>{(user.divine_essence || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="diamond" size={14} color="#9b4dca" />
              <Text style={styles.currencyText}>{(user.gems || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="cash" size={14} color={COLORS.gold.light} />
              <Text style={styles.currencyText}>{(user.coins || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="logo-bitcoin" size={14} color={COLORS.gold.primary} />
              <Text style={styles.currencyText}>{(user.gold || 0).toLocaleString()}</Text>
            </View>
          </ScrollView>
          <View style={styles.bannerSelector}>
            {(['common', 'premium', 'divine'] as const).map(banner => (
              <TouchableOpacity key={banner} style={[styles.bannerTab, selectedBanner === banner && styles.bannerTabActive]} onPress={() => setSelectedBanner(banner)}>
                <Text style={styles.bannerIcon}>{banner === 'common' ? '🪙' : banner === 'premium' ? '💎' : '✨'}</Text>
                <Text style={[styles.bannerLabel, selectedBanner === banner && styles.bannerLabelActive]}>{banner.charAt(0).toUpperCase() + banner.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.bannerCard}>
            <LinearGradient colors={selectedBanner === 'divine' ? [COLORS.gold.dark, COLORS.navy.primary] : selectedBanner === 'premium' ? ['#6b5b95', COLORS.navy.primary] : [COLORS.navy.medium, COLORS.navy.primary]} style={styles.bannerGradient}>
              <Text style={styles.bannerTitle}>{selectedBanner === 'divine' ? 'Divine Summon' : selectedBanner === 'premium' ? 'Crystal Summon' : 'Coin Summon'}</Text>
              <Text style={styles.bannerDesc}>{selectedBanner === 'divine' ? 'UR+ heroes, crystals & rewards!' : selectedBanner === 'premium' ? 'Premium pool with UR heroes' : 'Standard pool with SSR+ heroes'}</Text>
              <View style={styles.ratesBox}>
                <Text style={styles.ratesTitle}>Pull Rates</Text>
                <View style={styles.ratesRow}>
                  {Object.entries(selectedBanner === 'divine' ? DIVINE_RATES : selectedBanner === 'premium' ? PREMIUM_RATES : COMMON_RATES).map(([rarity, rate]) => (
                    <View key={rarity} style={styles.rateItem}><View style={[styles.rateBadge, { backgroundColor: getRarityColor(rarity) }]}><Text style={styles.rateRarity}>{rarity}</Text></View><Text style={styles.ratePercent}>{rate}%</Text></View>
                  ))}
                </View>
              </View>
              <View style={styles.pityBox}>
                <View style={styles.pityHeader}><Text style={styles.pityLabel}>Pity Progress</Text><Text style={styles.pityValue}>{getPityCounter()}/{getPityMax()}</Text></View>
                <View style={styles.pityBarOuter}><View style={[styles.pityBarFill, { width: `${(getPityCounter() / getPityMax()) * 100}%`, backgroundColor: selectedBanner === 'divine' ? COLORS.gold.primary : selectedBanner === 'premium' ? '#9b4dca' : COLORS.gold.light }]} /></View>
                <Text style={styles.pityHint}>{selectedBanner === 'divine' ? 'Guaranteed UR+ at 40' : selectedBanner === 'premium' ? 'Guaranteed UR at 50' : 'Guaranteed SSR+ at 50'}</Text>
              </View>
              <View style={styles.exclusiveBox}><Ionicons name="star" size={14} color={COLORS.gold.primary} /><Text style={styles.exclusiveText}>{selectedBanner === 'divine' ? 'UR+ Exclusive' : selectedBanner === 'premium' ? 'UR Exclusive' : 'SSR+ Exclusive'}</Text></View>
            </LinearGradient>
          </View>
          <View style={styles.summonButtons}>
            <TouchableOpacity style={styles.summonButton} onPress={() => performPull('single')} disabled={isLoading}>
              <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.summonButtonGradient}>
                {isLoading ? <ActivityIndicator color={COLORS.gold.primary} /> : (<><Text style={styles.summonButtonTitle}>Single</Text><View style={styles.costRow}><Ionicons name={selectedBanner === 'divine' ? 'star' : selectedBanner === 'premium' ? 'diamond' : 'cash'} size={14} color={COLORS.gold.light} /><Text style={styles.summonButtonCost}>{selectedBanner === 'divine' ? '1' : selectedBanner === 'premium' ? '100' : '1,000'}</Text></View></>)}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.summonButton} onPress={() => performPull('multi')} disabled={isLoading}>
              <LinearGradient colors={[COLORS.gold.dark, COLORS.gold.darkest]} style={styles.summonButtonGradient}>
                {isLoading ? <ActivityIndicator color={COLORS.navy.dark} /> : (<><Text style={[styles.summonButtonTitle, { color: COLORS.navy.darkest }]}>x10</Text><View style={styles.costRow}><Ionicons name={selectedBanner === 'divine' ? 'star' : selectedBanner === 'premium' ? 'diamond' : 'cash'} size={14} color={COLORS.navy.dark} /><Text style={[styles.summonButtonCost, { color: COLORS.navy.darkest }]}>{selectedBanner === 'divine' ? '10' : selectedBanner === 'premium' ? '900' : '9,000'}</Text></View></>)}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
        {renderResultsModal()}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 16, letterSpacing: 1 },
  currencyBar: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  currencyBarScroll: { maxHeight: 44, marginBottom: 16 },
  currencyBarContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  currencyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium + '90', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, gap: 5, borderWidth: 1, borderColor: COLORS.navy.light + '30' },
  currencyText: { color: COLORS.cream.soft, fontWeight: '600', fontSize: 12 },
  bannerSelector: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  bannerTab: { flex: 1, backgroundColor: COLORS.navy.medium, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.navy.light + '30' },
  bannerTabActive: { borderColor: COLORS.gold.primary, backgroundColor: COLORS.navy.primary },
  bannerIcon: { fontSize: 20, marginBottom: 4 },
  bannerLabel: { color: COLORS.cream.dark, fontSize: 12, fontWeight: '500' },
  bannerLabelActive: { color: COLORS.gold.light },
  bannerCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  bannerGradient: { padding: 20 },
  bannerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 8 },
  bannerDesc: { fontSize: 13, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 20 },
  ratesBox: { backgroundColor: COLORS.navy.darkest + '60', borderRadius: 12, padding: 16, marginBottom: 16 },
  ratesTitle: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 12, fontWeight: '600' },
  ratesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rateBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  rateRarity: { color: COLORS.cream.pure, fontSize: 11, fontWeight: 'bold' },
  ratePercent: { color: COLORS.cream.soft, fontSize: 13, fontWeight: '600' },
  pityBox: { backgroundColor: COLORS.navy.darkest + '60', borderRadius: 12, padding: 16, marginBottom: 12 },
  pityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pityLabel: { fontSize: 12, color: COLORS.cream.dark, fontWeight: '600' },
  pityValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  pityBarOuter: { height: 8, backgroundColor: COLORS.navy.dark, borderRadius: 4, overflow: 'hidden' },
  pityBarFill: { height: '100%', borderRadius: 4 },
  pityHint: { fontSize: 11, color: COLORS.gold.light, marginTop: 8, textAlign: 'center' },
  exclusiveBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.navy.darkest + '80', paddingVertical: 10, borderRadius: 8 },
  exclusiveText: { color: COLORS.gold.light, fontSize: 12, fontWeight: '600' },
  summonButtons: { flexDirection: 'row', gap: 12 },
  summonButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  summonButtonGradient: { paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  summonButtonTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  summonButtonCost: { fontSize: 14, color: COLORS.gold.light, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultsContainer: { width: '100%', borderRadius: 16, overflow: 'hidden', maxHeight: '90%' },
  resultsGradient: { padding: 20 },
  resultsTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.gold.primary, textAlign: 'center', marginBottom: 12 },
  
  // Phase 3.19.3: Recap strip styles
  recapStrip: { 
    backgroundColor: 'rgba(255, 215, 140, 0.08)', 
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 140, 0.15)',
  },
  recapHighlight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recapHighlightText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: COLORS.gold.primary,
  },
  recapCounts: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 20,
    marginTop: 4,
  },
  recapCount: { 
    alignItems: 'center',
  },
  recapCountValue: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.cream.pure,
  },
  recapCountLabel: { 
    fontSize: 10, 
    fontWeight: '600', 
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recapPity: { 
    marginTop: 8,
    alignItems: 'center',
  },
  recapPityText: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: 'rgba(255, 215, 140, 0.7)',
  },
  
  resultsScroll: { paddingVertical: 8 },
  heroResultCard: { 
    width: 100, 
    backgroundColor: COLORS.navy.medium, 
    borderRadius: 12, 
    borderWidth: 2, 
    overflow: 'hidden', 
    padding: 10, 
    alignItems: 'center', 
    marginRight: 10,
  },
  heroResultCardNew: {
    borderColor: COLORS.gold.primary,
    backgroundColor: 'rgba(201, 162, 39, 0.1)',
  },
  newBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 1,
  },
  newBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.navy.darkest,
  },
  rarityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  rarityText: { color: COLORS.cream.pure, fontSize: 9, fontWeight: 'bold' },
  heroImage: { width: 60, height: 60, borderRadius: 30, marginVertical: 6, borderWidth: 2, borderColor: COLORS.navy.light },
  heroImagePlaceholder: { width: 60, height: 60, borderRadius: 30, marginVertical: 6, backgroundColor: COLORS.navy.dark, justifyContent: 'center', alignItems: 'center' },
  fillerIconContainer: { width: 60, height: 60, borderRadius: 30, marginVertical: 6, backgroundColor: COLORS.navy.dark, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.gold.dark },
  fillerIcon: { fontSize: 30 },
  heroName: { color: COLORS.cream.soft, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  heroElement: { fontSize: 9, fontWeight: '500', marginTop: 2 },
  
  // Phase 3.19.3: Progression tip
  progressionTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  progressionTipText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  
  // Phase 3.19.3: CTA stack
  ctaStack: {
    marginTop: 16,
    gap: 10,
  },
  secondaryCTAs: {
    flexDirection: 'row',
    gap: 8,
  },
  
  closeResultsButton: { backgroundColor: COLORS.gold.primary, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  closeResultsText: { color: COLORS.navy.darkest, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  loginText: { color: COLORS.cream.soft, fontSize: 16, textAlign: 'center', marginTop: 100 },
});
