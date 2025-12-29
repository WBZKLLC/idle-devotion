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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../stores/gameStore';

const COMMON_RATES = {
  "SR": 65,
  "SSR": 32,
  "SSR+": 3,
};

const PREMIUM_RATES = {
  "SR": 45,
  "SSR": 40,
  "UR": 13,
  "UR+": 2,
};

export default function SummonHubScreen() {
  const { user, fetchUser } = useGameStore();
  const [selectedBanner, setSelectedBanner] = useState<'common' | 'premium'>('common');
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
    
    const currencyType = selectedBanner === 'premium' ? 'crystals' : 'coins';
    const cost = pullType === 'single' ? (currencyType === 'crystals' ? 100 : 1000) : (currencyType === 'crystals' ? 1000 : 10000);
    const currency = currencyType === 'crystals' ? user.gems : user.coins;
    
    if (currency < cost) {
      Alert.alert('Not Enough Currency', `You need ${cost} ${currencyType === 'crystals' ? 'Crystals' : 'Coins'} for this summon`);
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
    return selectedBanner === 'premium' ? (user.pity_counter_premium || 0) : (user.pity_counter || 0);
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
          colors={selectedBanner === 'premium' ? ['#9400D3', '#FF1493'] : ['#FFD700', '#FFA500']}
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
              <Ionicons name="diamond" size={20} color="#FF1493" />
              <Text style={styles.currencyText}>{user.gems || 0}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="cash" size={20} color="#FFD700" />
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
                <Ionicons name="cash" size={24} color="#FFF" />
                <Text style={styles.bannerTabText}>Common</Text>
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
                <Ionicons name="diamond" size={24} color="#FFF" />
                <Text style={styles.bannerTabText}>Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Selected Banner Info */}
          <LinearGradient
            colors={selectedBanner === 'premium' ? ['#9400D3', '#4B0082'] : ['#FFD700', '#B8860B']}
            style={styles.bannerCard}
          >
            <Text style={styles.bannerTitle}>
              {selectedBanner === 'premium' ? '💎 Crystal Summon' : '🪙 Coin Summon'}
            </Text>
            <Text style={styles.bannerDescription}>
              {selectedBanner === 'premium' 
                ? 'Premium pool with UR & UR+ heroes!' 
                : 'Standard pool with SR, SSR & SSR+ heroes'}
            </Text>
            
            {/* Rates Display */}
            <View style={styles.ratesContainer}>
              <Text style={styles.ratesTitle}>Pull Rates:</Text>
              <View style={styles.ratesGrid}>
                {Object.entries(selectedBanner === 'premium' ? PREMIUM_RATES : COMMON_RATES).map(([rarity, rate]) => (
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
                    colors={['#FF1493', '#FFD700']}
                    style={[styles.pityFill, { width: `${(getPityCounter() / 50) * 100}%` }]}
                  />
                </View>
                <Text style={styles.pityText}>{getPityCounter()}/50</Text>
              </View>
              <Text style={styles.pityHint}>
                {selectedBanner === 'premium' 
                  ? 'Guaranteed SSR or better at 50 pulls!'
                  : 'Guaranteed SSR or SSR+ at 50 pulls!'}
              </Text>
            </View>

            {/* Exclusive Notice for Premium */}
            {selectedBanner === 'premium' && (
              <View style={styles.exclusiveNotice}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.exclusiveText}>UR & UR+ heroes are EXCLUSIVE to Crystal Summon!</Text>
              </View>
            )}
            
            {/* Exclusive Notice for Common */}
            {selectedBanner === 'common' && (
              <View style={styles.exclusiveNotice}>
                <Ionicons name="sparkles" size={16} color="#FF6B6B" />
                <Text style={styles.exclusiveText}>SSR+ heroes are only in Common Summon!</Text>
              </View>
            )}
          </LinearGradient>

          {/* Summon Buttons */}
          <View style={styles.summonButtons}>
            <TouchableOpacity
              style={styles.summonButton}
              onPress={() => performPull('single')}
              disabled={isLoading}
            >
              <LinearGradient
                colors={selectedBanner === 'premium' ? ['#FF1493', '#9400D3'] : ['#FFD700', '#FFA500']}
                style={styles.summonButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.summonButtonTitle}>Single</Text>
                    <View style={styles.costRow}>
                      <Ionicons 
                        name={selectedBanner === 'premium' ? 'diamond' : 'cash'} 
                        size={16} 
                        color="#FFF" 
                      />
                      <Text style={styles.summonButtonCost}>
                        {selectedBanner === 'premium' ? '100' : '1,000'}
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
                colors={selectedBanner === 'premium' ? ['#FFD700', '#FF1493'] : ['#32CD32', '#FFD700']}
                style={styles.summonButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.summonButtonTitle}>x10</Text>
                    <View style={styles.costRow}>
                      <Ionicons 
                        name={selectedBanner === 'premium' ? 'diamond' : 'cash'} 
                        size={16} 
                        color="#FFF" 
                      />
                      <Text style={styles.summonButtonCost}>
                        {selectedBanner === 'premium' ? '1,000' : '10,000'}
                      </Text>
                    </View>
                  </>
                )}
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
    gap: 24,
    marginBottom: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  currencyText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  bannerSelector: {
    flexDirection: 'row',
    gap: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  bannerTabText: {
    color: '#FFF',
    fontSize: 16,
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
    fontSize: 12,
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
