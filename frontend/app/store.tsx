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
  Modal,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface CrystalPackage {
  id: string;
  price_usd: number;
  crystals: number;
  display_name: string;
  bonus: number;
}

interface VIPTier {
  level: number;
  required_spend: number;
  idle_hours: number;
  idle_gold_rate: number;
  active_uses: number;
  active_cost: number;
  avatar_frame: string;
}

const VIP_TIERS: VIPTier[] = [
  { level: 0, required_spend: 0, idle_hours: 8, idle_gold_rate: 1.0, active_uses: 1, active_cost: 0, avatar_frame: 'default' },
  { level: 1, required_spend: 5, idle_hours: 10, idle_gold_rate: 1.05, active_uses: 2, active_cost: 50, avatar_frame: 'bronze' },
  { level: 2, required_spend: 15, idle_hours: 10, idle_gold_rate: 1.1, active_uses: 2, active_cost: 45, avatar_frame: 'bronze' },
  { level: 3, required_spend: 30, idle_hours: 12, idle_gold_rate: 1.15, active_uses: 3, active_cost: 40, avatar_frame: 'silver' },
  { level: 4, required_spend: 50, idle_hours: 12, idle_gold_rate: 1.2, active_uses: 3, active_cost: 35, avatar_frame: 'silver' },
  { level: 5, required_spend: 100, idle_hours: 14, idle_gold_rate: 1.25, active_uses: 4, active_cost: 30, avatar_frame: 'gold' },
  { level: 6, required_spend: 200, idle_hours: 14, idle_gold_rate: 1.3, active_uses: 4, active_cost: 25, avatar_frame: 'gold' },
  { level: 7, required_spend: 500, idle_hours: 16, idle_gold_rate: 1.4, active_uses: 5, active_cost: 20, avatar_frame: 'gold' },
  { level: 8, required_spend: 1000, idle_hours: 18, idle_gold_rate: 1.5, active_uses: 5, active_cost: 15, avatar_frame: 'platinum' },
  { level: 9, required_spend: 2000, idle_hours: 20, idle_gold_rate: 1.6, active_uses: 6, active_cost: 10, avatar_frame: 'platinum' },
  { level: 10, required_spend: 3500, idle_hours: 22, idle_gold_rate: 1.7, active_uses: 6, active_cost: 5, avatar_frame: 'diamond' },
  { level: 11, required_spend: 5000, idle_hours: 24, idle_gold_rate: 1.8, active_uses: 7, active_cost: 0, avatar_frame: 'diamond' },
  { level: 12, required_spend: 7500, idle_hours: 24, idle_gold_rate: 1.9, active_uses: 8, active_cost: 0, avatar_frame: 'rainbow' },
  { level: 13, required_spend: 10000, idle_hours: 24, idle_gold_rate: 2.0, active_uses: 9, active_cost: 0, avatar_frame: 'legendary' },
  { level: 14, required_spend: 15000, idle_hours: 24, idle_gold_rate: 2.25, active_uses: 10, active_cost: 0, avatar_frame: 'divine' },
  { level: 15, required_spend: 25000, idle_hours: 24, idle_gold_rate: 2.5, active_uses: 12, active_cost: 0, avatar_frame: 'celestial' },
];

export default function StoreScreen() {
  const { user, fetchUser } = useGameStore();
  const [packages, setPackages] = useState<CrystalPackage[]>([]);
  const [divinePackages, setDivinePackages] = useState<any>(null);
  const [vipInfo, setVipInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showVIPModal, setShowVIPModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'crystals' | 'divine' | 'vip'>('crystals');

  useEffect(() => {
    if (user) {
      loadStoreData();
    }
  }, [user]);

  const loadStoreData = async () => {
    setIsLoading(true);
    try {
      const [packagesRes, divineRes, vipRes] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/crystal-packages`),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/divine-packages?username=${user?.username}`),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/vip/info/${user?.username}`)
      ]);
      
      const packagesData = await packagesRes.json();
      const divineData = await divineRes.json();
      const vipData = await vipRes.json();
      
      // Convert packages object to array
      const packagesObj = packagesData.packages || packagesData;
      const packagesArray = Object.values(packagesObj) as CrystalPackage[];
      setPackages(packagesArray);
      setDivinePackages(divineData);
      setVipInfo(vipData);
    } catch (error) {
      console.error('Failed to load store data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseCrystals = async (packageId: string, packageName: string, price: number) => {
    Alert.alert(
      '💎 Purchase Crystals',
      `Purchase ${packageName} for $${price.toFixed(2)}?\n\n(This is a simulation - no real payment)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/purchase-crystals?username=${user?.username}&package_id=${packageId}`,
                { method: 'POST' }
              );
              
              if (response.ok) {
                const result = await response.json();
                Alert.alert(
                  '🎉 Purchase Successful!',
                  `You received ${result.crystals_received} crystals!\n` +
                  (result.first_purchase_bonus ? `🎁 First Purchase Bonus: +${result.first_purchase_bonus}!\n` : '') +
                  `\nTotal Crystals: ${result.new_crystal_total}`
                );
                fetchUser();
                loadStoreData();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'Purchase failed');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to process purchase');
            }
          }
        }
      ]
    );
  };

  const purchaseDivinePackage = async (packageId: string, packageName: string, price: number) => {
    const purchaseInfo = divinePackages?.user_purchases?.[packageId];
    if (purchaseInfo?.remaining <= 0) {
      Alert.alert('Limit Reached', `You've purchased the maximum of 3 ${packageName} packages this month.`);
      return;
    }
    
    Alert.alert(
      '✨ Purchase Divine Package',
      `Purchase ${packageName} for $${price.toFixed(2)}?\n\n` +
      `Contains: Divine Essence + Crystals + VIP XP\n` +
      `Remaining: ${purchaseInfo?.remaining || 3}/3 this month\n\n` +
      `(This is a simulation - no real payment)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/purchase-divine?username=${user?.username}&package_id=${packageId}`,
                { method: 'POST' }
              );
              
              if (response.ok) {
                const result = await response.json();
                Alert.alert(
                  '🎉 Divine Package Purchased!',
                  `✨ Divine Essence: +${result.divine_essence_received}\n` +
                  `💎 Crystals: +${result.crystals_received}\n` +
                  `👑 New VIP Level: ${result.new_vip_level}\n\n` +
                  `${result.purchases_remaining} purchases remaining this month`
                );
                fetchUser();
                loadStoreData();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'Purchase failed');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to process purchase');
            }
          }
        }
      ]
    );
  };

  const getFrameColor = (frame: string) => {
    switch (frame) {
      case 'bronze': return '#CD7F32';
      case 'silver': return '#C0C0C0';
      case 'gold': return '#FFD700';
      case 'platinum': return '#E5E4E2';
      case 'diamond': return '#B9F2FF';
      case 'rainbow': return '#FF6B6B';
      case 'legendary': return '#FF1493';
      case 'divine': return '#9400D3';
      case 'celestial': return '#FFD700';
      default: return '#666';
    }
  };

  const renderVIPComparison = () => {
    const currentLevel = vipInfo?.current_vip_level || 0;
    const currentTier = VIP_TIERS[currentLevel];
    const nextTier = VIP_TIERS[Math.min(currentLevel + 1, 15)];
    const prevTier = VIP_TIERS[Math.max(currentLevel - 1, 0)];

    return (
      <Modal
        visible={showVIPModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVIPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowVIPModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>👑 VIP Comparison</Text>
            
            <ScrollView style={styles.vipScrollView}>
              {/* Previous Tier */}
              {currentLevel > 0 && (
                <View style={[styles.tierCard, styles.tierCardPrev]}>
                  <Text style={styles.tierLabel}>Previous Level</Text>
                  <Text style={styles.tierLevel}>VIP {prevTier.level}</Text>
                  <View style={styles.tierStats}>
                    <Text style={styles.tierStat}>⏰ {prevTier.idle_hours}h idle cap</Text>
                    <Text style={styles.tierStat}>💰 {(prevTier.idle_gold_rate * 100).toFixed(0)}% gold rate</Text>
                    <Text style={styles.tierStat}>⚡ {prevTier.active_uses} active uses</Text>
                  </View>
                </View>
              )}
              
              {/* Current Tier */}
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                style={[styles.tierCard, styles.tierCardCurrent]}
              >
                <Text style={styles.tierLabelCurrent}>Current Level</Text>
                <Text style={styles.tierLevelCurrent}>VIP {currentTier.level}</Text>
                <View style={styles.tierStats}>
                  <Text style={styles.tierStatCurrent}>⏰ {currentTier.idle_hours}h idle cap</Text>
                  <Text style={styles.tierStatCurrent}>💰 {(currentTier.idle_gold_rate * 100).toFixed(0)}% gold rate</Text>
                  <Text style={styles.tierStatCurrent}>⚡ {currentTier.active_uses} active uses/day</Text>
                  <Text style={styles.tierStatCurrent}>💎 {currentTier.active_cost} crystal cost</Text>
                  <View style={[styles.frameBadge, { borderColor: getFrameColor(currentTier.avatar_frame) }]}>
                    <Text style={[styles.frameText, { color: getFrameColor(currentTier.avatar_frame) }]}>
                      {currentTier.avatar_frame.toUpperCase()} FRAME
                    </Text>
                  </View>
                </View>
              </LinearGradient>
              
              {/* Next Tier */}
              {currentLevel < 15 && (
                <View style={[styles.tierCard, styles.tierCardNext]}>
                  <Text style={styles.tierLabel}>Next Level</Text>
                  <Text style={styles.tierLevel}>VIP {nextTier.level}</Text>
                  <Text style={styles.unlockText}>
                    Earn {Math.floor((nextTier.required_spend - (vipInfo?.total_spent || 0)) * 100).toLocaleString()} more XP to unlock
                  </Text>
                  <View style={styles.tierStats}>
                    <Text style={styles.tierStat}>⏰ {nextTier.idle_hours}h idle cap</Text>
                    <Text style={styles.tierStat}>💰 {(nextTier.idle_gold_rate * 100).toFixed(0)}% gold rate</Text>
                    <Text style={styles.tierStat}>⚡ {nextTier.active_uses} active uses</Text>
                    {nextTier.avatar_frame !== currentTier.avatar_frame && (
                      <View style={[styles.frameBadgeSmall, { borderColor: getFrameColor(nextTier.avatar_frame) }]}>
                        <Text style={[styles.frameTextSmall, { color: getFrameColor(nextTier.avatar_frame) }]}>
                          🎁 {nextTier.avatar_frame.toUpperCase()} FRAME
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              
              {/* All Tiers Preview */}
              <Text style={styles.allTiersTitle}>All VIP Tiers</Text>
              {VIP_TIERS.map((tier) => (
                <View 
                  key={tier.level} 
                  style={[
                    styles.tierRow,
                    tier.level === currentLevel && styles.tierRowCurrent
                  ]}
                >
                  <Text style={[
                    styles.tierRowLevel,
                    tier.level === currentLevel && styles.tierRowLevelCurrent
                  ]}>
                    VIP {tier.level}
                  </Text>
                  <Text style={styles.tierRowSpend}>{(tier.required_spend * 100).toLocaleString()} XP</Text>
                  <Text style={styles.tierRowBonus}>{(tier.idle_gold_rate * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (!user) {
    return (
      <LinearGradient colors={['#FF6B9D', '#FF1493', '#9400D3']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FF6B9D', '#FF1493', '#9400D3']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>💎 Store</Text>
          
          {/* Currency Display */}
          <View style={styles.currencyBar}>
            <View style={styles.currencyItem}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <Text style={styles.currencyText}>{user.divine_essence || 0}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="diamond" size={18} color="#FF6B9D" />
              <Text style={styles.currencyText}>{user.gems || 0}</Text>
            </View>
            <View style={styles.currencyItem}>
              <Ionicons name="cash" size={18} color="#FFD700" />
              <Text style={styles.currencyText}>{user.coins || 0}</Text>
            </View>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'crystals' && styles.tabActive]}
              onPress={() => setSelectedTab('crystals')}
            >
              <Text style={[styles.tabText, selectedTab === 'crystals' && styles.tabTextActive]}>
                💎 Crystals
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'divine' && styles.tabActive]}
              onPress={() => setSelectedTab('divine')}
            >
              <Text style={[styles.tabText, selectedTab === 'divine' && styles.tabTextActive]}>
                ✨ Divine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'vip' && styles.tabActive]}
              onPress={() => setSelectedTab('vip')}
            >
              <Text style={[styles.tabText, selectedTab === 'vip' && styles.tabTextActive]}>
                👑 VIP
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#FFF" style={styles.loader} />
          ) : selectedTab === 'divine' ? (
            <>
              {/* Divine Packages Section */}
              <LinearGradient
                colors={['#FFD700', '#FF1493', '#9400D3']}
                style={styles.divineHeader}
              >
                <Text style={styles.divineHeaderTitle}>✨ Divine Packages</Text>
                <Text style={styles.divineHeaderSubtitle}>
                  Limited to 3 purchases per package every 30 days
                </Text>
                {divinePackages && (
                  <Text style={styles.divineResetText}>
                    🔄 Resets in {divinePackages.days_until_reset} days
                  </Text>
                )}
              </LinearGradient>
              
              <View style={styles.divinePackagesGrid}>
                {/* $49.99 Package */}
                <TouchableOpacity
                  style={styles.divinePackageCard}
                  onPress={() => purchaseDivinePackage('divine_49', 'Divine Blessing', 49.99)}
                >
                  <LinearGradient
                    colors={['#FFD700', '#FF8C00']}
                    style={styles.divinePackageGradient}
                  >
                    <Text style={styles.divinePackageTitle}>Divine Blessing</Text>
                    <View style={styles.divinePackageContents}>
                      <Text style={styles.divinePackageItem}>✨ 40 Divine Essence</Text>
                      <Text style={styles.divinePackageItem}>💎 3,440 Crystals</Text>
                      <Text style={styles.divinePackageItem}>👑 VIP XP</Text>
                    </View>
                    <View style={styles.divinePriceTag}>
                      <Text style={styles.divinePriceText}>$49.99</Text>
                    </View>
                    <View style={styles.divineRemainingBadge}>
                      <Text style={styles.divineRemainingText}>
                        {divinePackages?.user_purchases?.divine_49?.remaining || 3}/3 left
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                
                {/* $99.99 Package */}
                <TouchableOpacity
                  style={styles.divinePackageCard}
                  onPress={() => purchaseDivinePackage('divine_99', 'Divine Ascension', 99.99)}
                >
                  <LinearGradient
                    colors={['#FF1493', '#9400D3']}
                    style={styles.divinePackageGradient}
                  >
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>BEST VALUE</Text>
                    </View>
                    <Text style={styles.divinePackageTitle}>Divine Ascension</Text>
                    <View style={styles.divinePackageContents}>
                      <Text style={styles.divinePackageItem}>✨ 75 Divine Essence</Text>
                      <Text style={styles.divinePackageItem}>💎 6,880 Crystals</Text>
                      <Text style={styles.divinePackageItem}>👑 VIP XP</Text>
                    </View>
                    <View style={styles.divinePriceTag}>
                      <Text style={styles.divinePriceText}>$99.99</Text>
                    </View>
                    <View style={styles.divineRemainingBadge}>
                      <Text style={styles.divineRemainingText}>
                        {divinePackages?.user_purchases?.divine_99?.remaining || 3}/3 left
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              {/* Divine Info */}
              <View style={styles.divineInfoBox}>
                <Ionicons name="information-circle" size={20} color="#FFD700" />
                <Text style={styles.divineInfoText}>
                  Divine Essence is used for Divine Summons to get exclusive UR+ heroes!
                </Text>
              </View>
            </>
          ) : selectedTab === 'crystals' ? (
            <>
              {/* First Purchase Banner */}
              {vipInfo && !vipInfo.first_purchase_used && (
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.firstPurchaseBanner}
                >
                  <Ionicons name="gift" size={24} color="#FFF" />
                  <View style={styles.bannerTextContainer}>
                    <Text style={styles.bannerTitle}>First Purchase Bonus!</Text>
                    <Text style={styles.bannerSubtitle}>Get 2x crystals on your first purchase!</Text>
                  </View>
                </LinearGradient>
              )}

              {/* Crystal Packages */}
              <View style={styles.packagesGrid}>
                {packages.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={styles.packageCard}
                    onPress={() => purchaseCrystals(pkg.id, pkg.display_name, pkg.price_usd)}
                  >
                    <LinearGradient
                      colors={
                        pkg.id === 'ultimate' ? ['#FFD700', '#FF6B6B'] :
                        pkg.id === 'premium' ? ['#9400D3', '#FF1493'] :
                        ['#4B0082', '#9400D3']
                      }
                      style={styles.packageGradient}
                    >
                      {pkg.bonus > 0 && (
                        <View style={styles.bonusBadge}>
                          <Text style={styles.bonusText}>+{pkg.bonus} BONUS</Text>
                        </View>
                      )}
                      <Ionicons name="diamond" size={40} color="#FFF" />
                      <Text style={styles.packageCrystals}>{pkg.crystals}</Text>
                      <Text style={styles.packageName}>{pkg.display_name}</Text>
                      <View style={styles.priceTag}>
                        <Text style={styles.priceText}>${pkg.price_usd.toFixed(2)}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* VIP Info Card */}
              {vipInfo && (
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.vipCard}
                >
                  <View style={styles.vipHeader}>
                    <View>
                      <Text style={styles.vipTitle}>VIP Level {vipInfo.current_vip_level}</Text>
                      <Text style={styles.vipSpent}>VIP XP: {Math.floor((vipInfo.total_spent || 0) * 100).toLocaleString()}</Text>
                    </View>
                    <View style={[styles.avatarFrame, { borderColor: getFrameColor(vipInfo.current_avatar_frame || 'default') }]}>
                      <Ionicons name="person" size={30} color={getFrameColor(vipInfo.current_avatar_frame || 'default')} />
                    </View>
                  </View>
                  
                  <View style={styles.vipBenefits}>
                    <View style={styles.benefitRow}>
                      <Text style={styles.benefitLabel}>⏰ Idle Cap</Text>
                      <Text style={styles.benefitValue}>{vipInfo.current_idle_hours || 8}h</Text>
                    </View>
                    <View style={styles.benefitRow}>
                      <Text style={styles.benefitLabel}>💰 Gold Rate</Text>
                      <Text style={styles.benefitValue}>{(vipInfo.current_idle_rate || 100).toFixed(0)}%</Text>
                    </View>
                    <View style={styles.benefitRow}>
                      <Text style={styles.benefitLabel}>⚡ Active Uses</Text>
                      <Text style={styles.benefitValue}>{VIP_TIERS[vipInfo.current_vip_level]?.active_uses || 1}/day</Text>
                    </View>
                    <View style={styles.benefitRow}>
                      <Text style={styles.benefitLabel}>🖼️ Frame</Text>
                      <Text style={[styles.benefitValue, { color: getFrameColor(vipInfo.current_avatar_frame || 'default') }]}>
                        {(vipInfo.current_avatar_frame || 'DEFAULT').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  {vipInfo.current_vip_level < 15 && (
                    <View style={styles.progressSection}>
                      <Text style={styles.progressLabel}>
                        Next VIP: {Math.floor((vipInfo.spend_needed_for_next || 0) * 100).toLocaleString()} XP needed
                      </Text>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(((vipInfo.total_spent || 0) / ((vipInfo.total_spent || 0) + (vipInfo.spend_needed_for_next || 1))) * 100, 100)}%` }
                          ]} 
                        />
                      </View>
                    </View>
                  )}
                </LinearGradient>
              )}
              
              <TouchableOpacity
                style={styles.compareButton}
                onPress={() => setShowVIPModal(true)}
              >
                <LinearGradient
                  colors={['#FF1493', '#9400D3']}
                  style={styles.compareButtonGradient}
                >
                  <Ionicons name="git-compare" size={20} color="#FFF" />
                  <Text style={styles.compareButtonText}>Compare VIP Levels</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* VIP Benefits List */}
              <View style={styles.benefitsList}>
                <Text style={styles.benefitsTitle}>VIP Benefits</Text>
                <View style={styles.benefitItem}>
                  <Ionicons name="time" size={20} color="#FFD700" />
                  <Text style={styles.benefitItemText}>Extended idle collection time (up to 24h)</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="trending-up" size={20} color="#32CD32" />
                  <Text style={styles.benefitItemText}>Increased gold generation rate (up to 250%)</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="flash" size={20} color="#FF6B6B" />
                  <Text style={styles.benefitItemText}>More instant collection uses per day</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="image" size={20} color="#9400D3" />
                  <Text style={styles.benefitItemText}>Exclusive avatar frames</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
        
        {renderVIPComparison()}
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
    marginBottom: 16,
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
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tabTextActive: {
    color: '#FF1493',
  },
  loader: {
    marginTop: 40,
  },
  firstPurchaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bannerSubtitle: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.9,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  packageCard: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  packageGradient: {
    padding: 16,
    alignItems: 'center',
    minHeight: 160,
  },
  bonusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bonusText: {
    color: '#333',
    fontSize: 10,
    fontWeight: 'bold',
  },
  packageCrystals: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  packageName: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 12,
  },
  priceTag: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  priceText: {
    color: '#FF1493',
    fontWeight: 'bold',
    fontSize: 16,
  },
  vipCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  vipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vipTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  vipSpent: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
  },
  avatarFrame: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  vipBenefits: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  benefitLabel: {
    color: '#FFF',
    fontSize: 14,
  },
  benefitValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressSection: {
    marginTop: 8,
  },
  progressLabel: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  compareButton: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  compareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  compareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  benefitsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  benefitItemText: {
    color: '#FFF',
    fontSize: 14,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  vipScrollView: {
    maxHeight: 500,
  },
  tierCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tierCardPrev: {
    backgroundColor: '#E0E0E0',
  },
  tierCardCurrent: {
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  tierCardNext: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#9400D3',
    borderStyle: 'dashed',
  },
  tierLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  tierLabelCurrent: {
    fontSize: 12,
    color: '#FFF',
    marginBottom: 4,
  },
  tierLevel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tierLevelCurrent: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  unlockText: {
    fontSize: 12,
    color: '#9400D3',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tierStats: {
    gap: 4,
  },
  tierStat: {
    fontSize: 14,
    color: '#666',
  },
  tierStatCurrent: {
    fontSize: 14,
    color: '#FFF',
  },
  frameBadge: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  frameText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  frameBadgeSmall: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  frameTextSmall: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  allTiersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tierRowCurrent: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
  },
  tierRowLevel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  tierRowLevelCurrent: {
    fontWeight: 'bold',
  },
  tierRowSpend: {
    fontSize: 14,
    color: '#666',
    width: 60,
    textAlign: 'center',
  },
  tierRowBonus: {
    fontSize: 14,
    color: '#32CD32',
    width: 50,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  divineHeader: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  divineHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  divineHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  divineResetText: {
    fontSize: 12,
    color: '#FFD700',
    marginTop: 8,
    fontWeight: 'bold',
  },
  divinePackagesGrid: {
    gap: 16,
    marginBottom: 20,
  },
  divinePackageCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  divinePackageGradient: {
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  divinePackageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  divinePackageContents: {
    alignItems: 'center',
    marginBottom: 16,
  },
  divinePackageItem: {
    fontSize: 16,
    color: '#FFF',
    marginVertical: 4,
  },
  divinePriceTag: {
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  divinePriceText: {
    color: '#FF1493',
    fontSize: 20,
    fontWeight: 'bold',
  },
  divineRemainingBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  divineRemainingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestValueText: {
    color: '#333',
    fontSize: 10,
    fontWeight: 'bold',
  },
  divineInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  divineInfoText: {
    flex: 1,
    color: '#FFD700',
    fontSize: 14,
  },
});
