import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';

const RARITY_COLORS: { [key: string]: string } = {
  'SR': '#4CAF50',
  'SSR': '#9C27B0',
  'UR': '#FF9800',
  'UR+': '#F44336',
};

export default function GachaScreen() {
  const { user, pullGacha, isLoading } = useGameStore();
  const [showResult, setShowResult] = useState(false);
  const [gachaResult, setGachaResult] = useState<any>(null);

  const handlePull = async (pullType: 'single' | 'multi', currencyType: 'gems' | 'coins') => {
    if (!user) return;

    const cost = pullType === 'single' 
      ? (currencyType === 'gems' ? 100 : 1000)
      : (currencyType === 'gems' ? 900 : 9000);

    const currency = currencyType === 'gems' ? user.gems : user.coins;

    if (currency < cost) {
      Alert.alert('Insufficient Funds', `You need ${cost} ${currencyType} to pull`);
      return;
    }

    try {
      const result = await pullGacha(pullType, currencyType);
      setGachaResult(result);
      setShowResult(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to pull gacha');
    }
  };

  const closeResult = () => {
    setShowResult(false);
    setGachaResult(null);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.noUserText}>Please login first</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Divine Summon</Text>
          <Text style={styles.subtitle}>Call upon legendary heroes</Text>
        </View>

        {/* Currency Display */}
        <View style={styles.currencyDisplay}>
          <View style={styles.currencyItem}>
            <Ionicons name="diamond" size={24} color="#FF6B9D" />
            <Text style={styles.currencyText}>{user.gems}</Text>
          </View>
          <View style={styles.currencyItem}>
            <Ionicons name="cash" size={24} color="#FFD700" />
            <Text style={styles.currencyText}>{user.coins}</Text>
          </View>
        </View>

        {/* Pity Counter */}
        <View style={styles.pityCard}>
          <Text style={styles.pityLabel}>Pity Counter</Text>
          <Text style={styles.pityValue}>{user.pity_counter} / 50</Text>
          <View style={styles.pityBar}>
            <View
              style={[
                styles.pityFill,
                { width: `${(user.pity_counter / 50) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.pityText}>
            {50 - user.pity_counter} pulls until guaranteed SSR!
          </Text>
        </View>

        {/* Summon Buttons - Gems */}
        <View style={styles.summonSection}>
          <Text style={styles.sectionTitle}>Premium Summon (Gems)</Text>
          
          <TouchableOpacity
            style={styles.summonButton}
            onPress={() => handlePull('single', 'gems')}
            disabled={isLoading}
          >
            <View style={styles.summonContent}>
              <Ionicons name="diamond" size={32} color="#FF6B9D" />
              <View style={styles.summonInfo}>
                <Text style={styles.summonTitle}>Single Summon</Text>
                <Text style={styles.summonCost}>100 Gems</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.summonButton, styles.multiButton]}
            onPress={() => handlePull('multi', 'gems')}
            disabled={isLoading}
          >
            <View style={styles.summonContent}>
              <Ionicons name="diamond" size={32} color="#FF6B9D" />
              <View style={styles.summonInfo}>
                <Text style={styles.summonTitle}>10x Summon</Text>
                <Text style={styles.summonCost}>900 Gems</Text>
                <Text style={styles.discountText}>Save 100 Gems!</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Summon Buttons - Coins */}
        <View style={styles.summonSection}>
          <Text style={styles.sectionTitle}>Standard Summon (Coins)</Text>
          
          <TouchableOpacity
            style={styles.summonButton}
            onPress={() => handlePull('single', 'coins')}
            disabled={isLoading}
          >
            <View style={styles.summonContent}>
              <Ionicons name="cash" size={32} color="#FFD700" />
              <View style={styles.summonInfo}>
                <Text style={styles.summonTitle}>Single Summon</Text>
                <Text style={styles.summonCost}>1,000 Coins</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.summonButton, styles.multiButton]}
            onPress={() => handlePull('multi', 'coins')}
            disabled={isLoading}
          >
            <View style={styles.summonContent}>
              <Ionicons name="cash" size={32} color="#FFD700" />
              <View style={styles.summonInfo}>
                <Text style={styles.summonTitle}>10x Summon</Text>
                <Text style={styles.summonCost}>9,000 Coins</Text>
                <Text style={styles.discountText}>Save 1,000 Coins!</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Rates Info */}
        <View style={styles.ratesCard}>
          <Text style={styles.ratesTitle}>Drop Rates</Text>
          <View style={styles.rateRow}>
            <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['SR'] }]} />
            <Text style={styles.rateText}>SR (Rare): 60%</Text>
          </View>
          <View style={styles.rateRow}>
            <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['SSR'] }]} />
            <Text style={styles.rateText}>SSR (Epic): 30%</Text>
          </View>
          <View style={styles.rateRow}>
            <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['UR'] }]} />
            <Text style={styles.rateText}>UR (Legendary): 9%</Text>
          </View>
          <View style={styles.rateRow}>
            <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS['UR+'] }]} />
            <Text style={styles.rateText}>UR+ (God-like): 1%</Text>
          </View>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={styles.loadingText}>Summoning...</Text>
        </View>
      )}

      {/* Result Modal */}
      <Modal
        visible={showResult}
        transparent
        animationType="fade"
        onRequestClose={closeResult}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Summon Results!</Text>
            
            <ScrollView style={styles.resultScroll}>
              {gachaResult?.heroes.map((hero: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.heroResultCard,
                    { borderColor: RARITY_COLORS[hero.hero_data?.rarity || 'SR'] },
                  ]}
                >
                  <Image
                    source={{ uri: hero.hero_data?.image_url }}
                    style={styles.heroResultImage}
                  />
                  <View style={styles.heroResultInfo}>
                    <Text style={styles.heroResultName}>{hero.hero_data?.name}</Text>
                    <Text
                      style={[
                        styles.heroResultRarity,
                        { color: RARITY_COLORS[hero.hero_data?.rarity || 'SR'] },
                      ]}
                    >
                      {hero.hero_data?.rarity}
                    </Text>
                    {hero.duplicates > 0 && (
                      <Text style={styles.duplicateText}>Duplicate +{hero.duplicates}</Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeButton} onPress={closeResult}>
              <Text style={styles.closeButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  currencyDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 24,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  pityCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FF6B9D',
  },
  pityLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  pityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginBottom: 8,
  },
  pityBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  pityFill: {
    height: '100%',
    backgroundColor: '#FF6B9D',
  },
  pityText: {
    fontSize: 12,
    color: '#999',
  },
  summonSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  summonButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  multiButton: {
    borderColor: '#FF6B9D',
  },
  summonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summonInfo: {
    flex: 1,
  },
  summonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summonCost: {
    fontSize: 14,
    color: '#999',
  },
  discountText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 2,
  },
  ratesCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  ratesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rarityDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  rateText: {
    fontSize: 14,
    color: '#999',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: '#FF6B9D',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultScroll: {
    maxHeight: 400,
  },
  heroResultCard: {
    flexDirection: 'row',
    backgroundColor: '#0f0f1e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  heroResultImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  heroResultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  heroResultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  heroResultRarity: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  duplicateText: {
    fontSize: 12,
    color: '#FFD700',
  },
  closeButton: {
    backgroundColor: '#FF6B9D',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noUserText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});
