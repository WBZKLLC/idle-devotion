import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../stores/gameStore';

const COMMON_RATES = { "SR": 90.8, "SSR": 8, "SSR+": 1.2 };
const PREMIUM_RATES = { "SR": 66.8, "SSR": 32, "UR": 1.2 };
const DIVINE_RATES = { "UR+": 100 };

export default function SummonHubScreen() {
  const { user, fetchUser } = useGameStore();
  const [selectedBanner, setSelectedBanner] = useState<'common' | 'premium' | 'divine'>('common');
  const [isLoading, setIsLoading] = useState(false);
  const [pullResults, setPullResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUser();
    }
  }, []);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'SR': return '#C0C0C0';
      case 'SSR': return '#FFD700';
      case 'SSR+': return '#FF6B6B';
      case 'UR': return '#9400D3';
      case 'UR+': return '#FF1493';
      default: return '#808080';
    }
  };

  const performPull = async (pullType: 'single' | 'multi') => {
    if (!user) return;
    
    let currencyType = 'coins';
    let cost = 0;
    let currencyBalance = 0;
    let currencyName = 'Coins';
    
    if (selectedBanner === 'divine') {
      currencyType = 'divine_essence';
      cost = pullType === 'single' ? 1 : 10;
      currencyBalance = user.divine_essence || 0;
      currencyName = 'Divine Essence';
    } else if (selectedBanner === 'premium') {
      currencyType = 'crystals';
      cost = pullType === 'single' ? 100 : 1000;
      currencyBalance = user.gems || 0;
      currencyName = 'Crystals';
    } else {
      currencyType = 'coins';
      cost = pullType === 'single' ? 1000 : 10000;
      currencyBalance = user.coins || 0;
      currencyName = 'Coins';
    }
    
    if (currencyBalance < cost) {
      Alert.alert('Not Enough Currency', `You need ${cost.toLocaleString()} ${currencyName} for this summon`);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/gacha/pull?username=${user.username}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pull_type: pullType,
            currency_type: currencyType,
          }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPullResults(data.heroes || []);
        setShowResults(true);
        await fetchUser();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to summon');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to perform summon');
    } finally {
      setIsLoading(false);
    }
  };

  const getPityCounter = () => {
    if (!user) return 0;
    if (selectedBanner === 'divine') return user.pity_counter_divine || 0;
    if (selectedBanner === 'premium') return user.pity_counter_premium || 0;
    return user.pity_counter || 0;
  };

  const getPityMax = () => {
    return selectedBanner === 'divine' ? 40 : 50;
  };

  const renderResultsModal = () => (
    <Modal
      visible={showResults}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowResults(false)}
    >
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={
            selectedBanner === 'divine' ? ['#FFD700', '#FF1493'] :
            selectedBanner === 'premium' ? ['#9400D3', '#FF1493'] : 
            ['#FFD700', '#FFA500']
          }
          style={styles.resultsContainer}
        >
          <Text style={styles.resultsTitle}>✨ Summon Results!</Text>
          
          <ScrollView horizontal contentContainerStyle={styles.resultsScroll}>
            {pullResults.map((hero, index) => (
              <View 
                key={index} 
                style={[styles.heroResultCard, { borderColor: getRarityColor(hero.rarity || 'SR') }]}
              >
                <LinearGradient
                  colors={[getRarityColor(hero.rarity || 'SR'), '#000']}
                  style={styles.heroResultGradient}
                >
                  <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(hero.rarity || 'SR') }]}>
                    <Text style={styles.rarityText}>{hero.rarity || 'SR'}</Text>
                  </View>
                  <Ionicons name="person" size={50} color="#FFF" />
                  <Text style={styles.heroName} numberOfLines={2}>
                    {hero.hero_name || hero.name || 'Unknown Hero'}
                  </Text>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>
          
          <TouchableOpacity
            style={styles.closeResultsButton}
            onPress={() => setShowResults(false)}
          >
            <Text style={styles.closeResultsText}>Continue</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );

  if (!user) {
    return (
      <LinearGradient colors={['#FF1493', '#9400D3']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.loginText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FF1493', '#9400D3', '#4B0082']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>🎁 Summon</Text>
          
          {/* Currency Display */}
          <View style={styles.currencyBar}>
            <View style={styles.currencyItem}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <Text style={styles.currencyText}>{user.divine_essence || 0}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="diamond" size={18} color="#FF1493" />
              <Text style={styles.currencyText}>{user.gems || 0}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="cash" size={18} color="#FFD700" />
              <Text style={styles.currencyText}>{user.coins || 0}</Text>
            </View>
          </View>

          {/* Banner Selection */}
          <View style={styles.bannerSelector}>
            <TouchableOpacity
              style={[styles.bannerTab, selectedBanner === 'common' && styles.bannerTabActive]}
              onPress={() => setSelectedBanner('common')}
            >
              <LinearGradient
                colors={selectedBanner === 'common' ? ['#FFD700', '#FFA500'] : ['#333', '#555']}
                style={styles.bannerTabGradient}
              >
                <Text style={styles.bannerTabText}>🪙</Text>
                <Text style={styles.bannerTabLabel}>Common</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.bannerTab, selectedBanner === 'premium' && styles.bannerTabActive]}
              onPress={() => setSelectedBanner('premium')}
            >
              <LinearGradient
                colors={selectedBanner === 'premium' ? ['#9400D3', '#FF1493'] : ['#333', '#555']}
                style={styles.bannerTabGradient}
              >
                <Text style={styles.bannerTabText}>💎</Text>
                <Text style={styles.bannerTabLabel}>Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.bannerTab, selectedBanner === 'divine' && styles.bannerTabActive]}
              onPress={() => setSelectedBanner('divine')}
            >
              <LinearGradient
                colors={selectedBanner === 'divine' ? ['#FFD700', '#FF1493'] : ['#333', '#555']}
                style={styles.bannerTabGradient}
              >
                <Text style={styles.bannerTabText}>✨</Text>
                <Text style={styles.bannerTabLabel}>Divine</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Selected Banner Info */}
          <LinearGradient
            colors={
              selectedBanner === 'divine' ? ['#FFD700', '#FF1493', '#9400D3'] :
              selectedBanner === 'premium' ? ['#9400D3', '#4B0082'] : 
              ['#FFD700', '#B8860B']
            }
            style={styles.bannerCard}
          >
            <Text style={styles.bannerTitle}>
              {selectedBanner === 'divine' ? '✨ Divine Summon' :
               selectedBanner === 'premium' ? '💎 Crystal Summon' : 
               '🪙 Coin Summon'}
            </Text>
            <Text style={styles.bannerDescription}>
              {selectedBanner === 'divine' 
                ? 'Guaranteed UR+ heroes only!' 
                : selectedBanner === 'premium'
                ? 'Premium pool with UR heroes!' 
                : 'Standard pool with SR, SSR & SSR+ heroes'}
            </Text>
            
            {/* Rates Display */}
            <View style={styles.ratesContainer}>
              <Text style={styles.ratesTitle}>Pull Rates:</Text>
              <View style={styles.ratesGrid}>
                {Object.entries(
                  selectedBanner === 'divine' ? DIVINE_RATES :
                  selectedBanner === 'premium' ? PREMIUM_RATES : 
                  COMMON_RATES
                ).map(([rarity, rate]) => (
                  <View key={rarity} style={styles.rateItem}>
                    <View style={[styles.rateBadge, { backgroundColor: getRarityColor(rarity) }]}>
                      <Text style={styles.rateRarity}>{rarity}</Text>
                    </View>
                    <Text style={styles.ratePercent}>{rate}%</Text>
                  </View>
                ))}
              </View>
            </View>
            
            {/* Pity Display */}
            <View style={styles.pitySection}>
              <Text style={styles.pityLabel}>Pity Counter</Text>
              <View style={styles.pityBarContainer}>
                <View style={styles.pityBar}>
                  <LinearGradient
                    colors={
                      selectedBanner === 'divine' ? ['#FFD700', '#FF1493'] :
                      ['#FF1493', '#FFD700']
                    }
                    style={[styles.pityFill, { width: `${(getPityCounter() / getPityMax()) * 100}%` }]}
                  />
                </View>
                <Text style={styles.pityText}>{getPityCounter()}/{getPityMax()}</Text>
              </View>
              <Text style={styles.pityHint}>
                {selectedBanner === 'divine' 
                  ? 'Guaranteed UR+ at 40 pulls!'
                  : selectedBanner === 'premium'
                  ? 'Guaranteed UR at 50 pulls!'
                  : 'Guaranteed SSR or SSR+ at 50 pulls!'}
              </Text>
            </View>

            {/* Exclusive Notice */}
            <View style={styles.exclusiveNotice}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.exclusiveText}>
                {selectedBanner === 'divine' 
                  ? 'UR+ heroes are EXCLUSIVE to Divine Summon!'
                  : selectedBanner === 'premium'
                  ? 'UR heroes are EXCLUSIVE to Crystal Summon!'
                  : 'SSR+ heroes are EXCLUSIVE to Coin Summon!'}
              </Text>
            </View>
          </LinearGradient>

          {/* Summon Buttons */}
          <View style={styles.summonButtons}>
            <TouchableOpacity
              style={styles.summonButton}
              onPress={() => performPull('single')}
              disabled={isLoading}
            >
              <LinearGradient
                colors={
                  selectedBanner === 'divine' ? ['#FFD700', '#FF6B6B'] :
                  selectedBanner === 'premium' ? ['#FF1493', '#9400D3'] : 
                  ['#FFD700', '#FFA500']
                }
                style={styles.summonButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.summonButtonTitle}>Single</Text>
                    <View style={styles.costRow}>
                      <Ionicons 
                        name={selectedBanner === 'divine' ? 'star' : selectedBanner === 'premium' ? 'diamond' : 'cash'} 
                        size={16} 
                        color="#FFF" 
                      />
                      <Text style={styles.summonButtonCost}>
                        {selectedBanner === 'divine' ? '1' : selectedBanner === 'premium' ? '100' : '1,000'}
                      </Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.summonButton}
              onPress={() => performPull('multi')}
              disabled={isLoading}
            >
              <LinearGradient
                colors={
                  selectedBanner === 'divine' ? ['#FF1493', '#FFD700'] :
                  selectedBanner === 'premium' ? ['#FFD700', '#FF1493'] : 
                  ['#32CD32', '#FFD700']
                }
                style={styles.summonButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.summonButtonTitle}>x10</Text>
                    <View style={styles.costRow}>
                      <Ionicons 
                        name={selectedBanner === 'divine' ? 'star' : selectedBanner === 'premium' ? 'diamond' : 'cash'} 
                        size={16} 
                        color="#FFF" 
                      />
                      <Text style={styles.summonButtonCost}>
                        {selectedBanner === 'divine' ? '10' : selectedBanner === 'premium' ? '1,000' : '10,000'}
                      </Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Divine Essence Info */}
          {selectedBanner === 'divine' && (
            <View style={styles.divineInfo}>
              <Text style={styles.divineInfoText}>
                💫 Divine Essence is ultra-rare! Purchase Divine Packages in the Store for more.
              </Text>
            </View>
          )}
        </ScrollView>
        
        {renderResultsModal()}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
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
  currencyBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  currencyText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  bannerTab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerTabActive: {
    transform: [{ scale: 1.02 }],
  },
  bannerTabGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  bannerTabText: {
    fontSize: 20,
  },
  bannerTabLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bannerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  bannerDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  ratesContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  ratesTitle: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  ratesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rateRarity: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ratePercent: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pitySection: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pityLabel: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  pityBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pityBar: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  pityFill: {
    height: '100%',
    borderRadius: 6,
  },
  pityText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    width: 60,
  },
  pityHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  exclusiveNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: 10,
    borderRadius: 8,
  },
  exclusiveText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
  },
  summonButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  summonButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summonButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  summonButtonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  summonButtonCost: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  divineInfo: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  divineInfoText: {
    color: '#FFD700',
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultsContainer: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultsScroll: {
    paddingVertical: 10,
    gap: 12,
  },
  heroResultCard: {
    width: 120,
    borderRadius: 12,
    borderWidth: 3,
    overflow: 'hidden',
    marginRight: 12,
  },
  heroResultGradient: {
    padding: 12,
    alignItems: 'center',
    minHeight: 140,
  },
  rarityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  rarityText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  heroName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  closeResultsButton: {
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  closeResultsText: {
    color: '#FF1493',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loginText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});
