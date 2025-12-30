import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore, useHydration } from '../stores/gameStore';

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
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  const [selectedBanner, setSelectedBanner] = useState<'common' | 'premium' | 'divine'>('common');
  const [isLoading, setIsLoading] = useState(false);
  const [pullResults, setPullResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => { if (hydrated && user) fetchUser(); }, [hydrated, user?.username]);

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
    if (currencyBalance < cost) { Alert.alert('Insufficient Funds', `You need ${cost.toLocaleString()} ${currencyName}`); return; }
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/gacha/pull?username=${user.username}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pull_type: pullType, currency_type: currencyType }) });
      if (response.ok) { const data = await response.json(); setPullResults(data.heroes || []); setShowResults(true); await fetchUser(); }
      else { const error = await response.json(); Alert.alert('Error', error.detail || 'Failed to summon'); }
    } catch (error) { Alert.alert('Error', 'Failed to perform summon'); }
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

  const renderResultsModal = () => (
    <Modal visible={showResults} animationType="fade" transparent={true} onRequestClose={() => setShowResults(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.resultsContainer}>
          <LinearGradient colors={[COLORS.navy.dark, COLORS.navy.primary]} style={styles.resultsGradient}>
            <Text style={styles.resultsTitle}>Summon Results</Text>
            <ScrollView horizontal contentContainerStyle={styles.resultsScroll} showsHorizontalScrollIndicator={false}>
              {pullResults.map((item, index) => (
                <View key={index} style={[
                  styles.heroResultCard, 
                  { borderColor: item.is_filler 
                    ? getFillerRarityColor(item.rarity || 'common') 
                    : getRarityColor(item.rarity || 'SR') 
                  }
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
            <TouchableOpacity style={styles.closeResultsButton} onPress={() => setShowResults(false)}>
              <Text style={styles.closeResultsText}>Continue</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

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

  if (!hydrated) return (<LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}><SafeAreaView style={styles.container}><ActivityIndicator size="large" color={COLORS.gold.primary} /></SafeAreaView></LinearGradient>);
  
  if (!user) return (<LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}><SafeAreaView style={styles.container}><Text style={styles.loginText}>Please log in first</Text></SafeAreaView></LinearGradient>);

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Summon</Text>
          <View style={styles.currencyBar}>
            <View style={styles.currencyItem}><Ionicons name="star" size={16} color={COLORS.gold.primary} /><Text style={styles.currencyText}>{user.divine_essence || 0}</Text></View>
            <View style={styles.currencyItem}><Ionicons name="diamond" size={16} color="#9b4dca" /><Text style={styles.currencyText}>{user.gems || 0}</Text></View>
            <View style={styles.currencyItem}><Ionicons name="cash" size={16} color={COLORS.gold.light} /><Text style={styles.currencyText}>{user.coins || 0}</Text></View>
          </View>
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
                {isLoading ? <ActivityIndicator color={COLORS.navy.dark} /> : (<><Text style={[styles.summonButtonTitle, { color: COLORS.navy.darkest }]}>x10</Text><View style={styles.costRow}><Ionicons name={selectedBanner === 'divine' ? 'star' : selectedBanner === 'premium' ? 'diamond' : 'cash'} size={14} color={COLORS.navy.dark} /><Text style={[styles.summonButtonCost, { color: COLORS.navy.darkest }]}>{selectedBanner === 'divine' ? '10' : selectedBanner === 'premium' ? '1,000' : '10,000'}</Text></View></>)}
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
  currencyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium + '80', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, borderWidth: 1, borderColor: COLORS.navy.light + '30' },
  currencyText: { color: COLORS.cream.soft, fontWeight: '600', fontSize: 14 },
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
  resultsContainer: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  resultsGradient: { padding: 24 },
  resultsTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, textAlign: 'center', marginBottom: 20 },
  resultsScroll: { paddingVertical: 10, gap: 12 },
  heroResultCard: { width: 110, backgroundColor: COLORS.navy.medium, borderRadius: 12, borderWidth: 2, overflow: 'hidden', padding: 12, alignItems: 'center', marginRight: 12 },
  rarityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  rarityText: { color: COLORS.cream.pure, fontSize: 10, fontWeight: 'bold' },
  heroImage: { width: 70, height: 70, borderRadius: 35, marginVertical: 8, borderWidth: 2, borderColor: COLORS.navy.light },
  heroImagePlaceholder: { width: 70, height: 70, borderRadius: 35, marginVertical: 8, backgroundColor: COLORS.navy.dark, justifyContent: 'center', alignItems: 'center' },
  fillerIconContainer: { width: 70, height: 70, borderRadius: 35, marginVertical: 8, backgroundColor: COLORS.navy.dark, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.gold.dark },
  fillerIcon: { fontSize: 36 },
  heroName: { color: COLORS.cream.soft, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  heroElement: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  closeResultsButton: { backgroundColor: COLORS.gold.primary, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  closeResultsText: { color: COLORS.navy.darkest, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  loginText: { color: COLORS.cream.soft, fontSize: 16, textAlign: 'center', marginTop: 100 },
});
