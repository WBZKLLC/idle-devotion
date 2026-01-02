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
  TextInput,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { router } from 'expo-router';

export default function GuildScreen() {
  const { user, fetchUser } = useGameStore();
  const hydrated = useHydration();
  const [guildData, setGuildData] = useState<any>(null);
  const [availableGuilds, setAvailableGuilds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [guildName, setGuildName] = useState('');
  const [guildDescription, setGuildDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'boss' | 'donate'>('info');
  
  // Boss state
  const [bossData, setBossData] = useState<any>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [lastAttackResult, setLastAttackResult] = useState<any>(null);
  const [attacksRemaining, setAttacksRemaining] = useState<number>(3);
  const [maxAttacks, setMaxAttacks] = useState<number>(3);
  
  // Donation state - now using tiers
  const [selectedDonationTier, setSelectedDonationTier] = useState<'small' | 'medium' | 'large'>('small');
  const [donationHistory, setDonationHistory] = useState<any[]>([]);
  const [isDonating, setIsDonating] = useState(false);
  const [guildLevelInfo, setGuildLevelInfo] = useState<any>(null);
  
  // Boss animation
  const bossShakeAnim = useRef(new Animated.Value(0)).current;
  const damagePopAnim = useRef(new Animated.Value(0)).current;
  const bossScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hydrated && user) {
      loadGuildData();
      loadGuildLevelInfo();
    } else if (hydrated && !user) {
      setIsLoading(false);
    }
  }, [hydrated, user]);

  useEffect(() => {
    if (guildData && activeTab === 'boss') {
      loadBossData();
    }
    if (guildData && activeTab === 'donate') {
      loadDonationHistory();
      loadGuildLevelInfo();
    }
  }, [guildData, activeTab]);

  const loadGuildData = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/${user?.username}`
      );
      if (response.ok) {
        const data = await response.json();
        setGuildData(data);
      } else {
        setGuildData(null);
        loadAvailableGuilds();
      }
    } catch (error) {
      console.error('Failed to load guild:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableGuilds = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guilds?limit=20`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableGuilds(data);
      }
    } catch (error) {
      console.error('Failed to load guilds:', error);
    }
  };

  const loadBossData = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/${user?.username}/boss`
      );
      if (response.ok) {
        const data = await response.json();
        setBossData(data);
      }
    } catch (error) {
      console.error('Failed to load boss:', error);
    }
  };

  const loadDonationHistory = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/${user?.username}/donations`
      );
      if (response.ok) {
        const data = await response.json();
        setDonationHistory(data.donations || []);
      }
    } catch (error) {
      console.error('Failed to load donations:', error);
    }
  };

  const createGuild = async () => {
    if (!guildName.trim()) {
      Alert.alert('Error', 'Please enter a guild name');
      return;
    }
    
    setIsCreating(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/create?username=${user?.username}&guild_name=${encodeURIComponent(guildName.trim())}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        Alert.alert('Success!', 'Guild created successfully!');
        setShowCreateModal(false);
        setGuildName('');
        setGuildDescription('');
        loadGuildData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to create guild');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create guild');
    } finally {
      setIsCreating(false);
    }
  };

  const joinGuild = async (guildId: string) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/join?username=${user?.username}&guild_id=${guildId}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        Alert.alert('Success!', 'Joined guild successfully!');
        setShowJoinModal(false);
        loadGuildData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to join guild');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to join guild');
    }
  };

  const leaveGuild = async () => {
    Alert.alert(
      'Leave Guild',
      'Are you sure you want to leave the guild?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/leave?username=${user?.username}`,
                { method: 'POST' }
              );
              if (response.ok) {
                Alert.alert('Success', 'You left the guild');
                setGuildData(null);
                loadAvailableGuilds();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to leave guild');
            }
          }
        }
      ]
    );
  };

  const attackBoss = async () => {
    if (!bossData || bossData.defeated) return;
    
    setIsAttacking(true);
    
    // Play attack animation
    playBossHitAnimation();
    
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/${user?.username}/boss/attack`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const result = await response.json();
        setLastAttackResult(result);
        
        // Update attack count
        if (result.attacks_remaining !== undefined) {
          setAttacksRemaining(result.attacks_remaining);
          setMaxAttacks(result.attacks_max);
        }
        
        // Update boss HP
        setBossData((prev: any) => ({
          ...prev,
          current_hp: result.boss_hp_remaining,
          defeated: result.defeated
        }));
        
        if (result.defeated) {
          Alert.alert(
            '🎉 Boss Defeated!',
            `Your contribution: ${result.contribution_percent}%\nRewards: ${JSON.stringify(result.rewards)}`
          );
          loadBossData();
        }
        
        fetchUser();
      } else {
        const error = await response.json();
        Alert.alert('Attack Failed', error.detail || 'Attack failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to attack boss');
    } finally {
      setIsAttacking(false);
    }
  };

  const playBossHitAnimation = () => {
    // Shake animation
    Animated.sequence([
      Animated.timing(bossShakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
      Animated.timing(bossShakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
      Animated.timing(bossShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(bossShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(bossShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    // Scale pop
    Animated.sequence([
      Animated.timing(bossScaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.spring(bossScaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();

    // Damage pop
    damagePopAnim.setValue(0);
    Animated.timing(damagePopAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const makeDonation = async () => {
    setIsDonating(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/${user?.username}/donate?tier=${selectedDonationTier}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          '💎 Donation Successful!',
          `Earned ${result.guild_coins_earned} Guild Coins\nGuild gained ${result.guild_exp_earned} EXP!`
        );
        setShowDonateModal(false);
        fetchUser();
        loadDonationHistory();
        loadGuildData();
        loadGuildLevelInfo();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Donation failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to donate');
    } finally {
      setIsDonating(false);
    }
  };

  const loadGuildLevelInfo = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/${user.username}/level-info`);
      if (response.ok) {
        setGuildLevelInfo(await response.json());
      }
    } catch (error) {
      console.error('Failed to load guild level info:', error);
    }
  };

  const getBossHealthPercent = () => {
    if (!bossData) return 0;
    return (bossData.current_hp / bossData.max_hp) * 100;
  };

  const getBossHealthColor = () => {
    const percent = getBossHealthPercent();
    if (percent > 60) return '#27ae60';
    if (percent > 30) return '#f39c12';
    return '#e74c3c';
  };

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={48} color={COLORS.gold.primary} />
          <Text style={styles.errorText}>Please log in first</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/')}>
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.title}>⚔️ Guild</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.gold.primary} style={styles.loader} />
          ) : guildData ? (
            <>
              {/* Guild Info Card */}
              <LinearGradient
                colors={[COLORS.gold.primary, COLORS.gold.dark]}
                style={styles.guildCard}
              >
                <View style={styles.guildHeader}>
                  <Ionicons name="shield" size={40} color={COLORS.navy.darkest} />
                  <View style={styles.guildInfo}>
                    <Text style={styles.guildName}>{guildData.name}</Text>
                    <Text style={styles.guildLevel}>Level {guildData.level || 1}</Text>
                  </View>
                </View>
                <View style={styles.guildStats}>
                  <View style={styles.guildStat}>
                    <Text style={styles.guildStatValue}>{guildData.member_count || 0}</Text>
                    <Text style={styles.guildStatLabel}>Members</Text>
                  </View>
                  <View style={styles.guildStat}>
                    <Text style={styles.guildStatValue}>{(guildData.treasury_coins || 0).toLocaleString()}</Text>
                    <Text style={styles.guildStatLabel}>Treasury</Text>
                  </View>
                  <View style={styles.guildStat}>
                    <Text style={styles.guildStatValue}>{guildData.exp || 0}</Text>
                    <Text style={styles.guildStatLabel}>EXP</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Tab Navigation */}
              <View style={styles.tabBar}>
                {(['info', 'boss', 'donate'] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Ionicons 
                      name={tab === 'info' ? 'information-circle' : tab === 'boss' ? 'skull' : 'gift'} 
                      size={20} 
                      color={activeTab === tab ? COLORS.navy.darkest : COLORS.cream.soft} 
                    />
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab === 'info' ? 'Info' : tab === 'boss' ? 'Boss' : 'Donate'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tab Content */}
              {activeTab === 'info' && (
                <View style={styles.tabContent}>
                  <Text style={styles.sectionTitle}>Guild Benefits</Text>
                  {[
                    { icon: 'people', text: 'Team up with other players' },
                    { icon: 'skull', text: 'Fight powerful Guild Bosses' },
                    { icon: 'gift', text: 'Donate and earn Guild Points' },
                    { icon: 'trophy', text: 'Compete in Guild Wars' },
                    { icon: 'cart', text: 'Access exclusive Guild Shop' },
                  ].map((benefit, idx) => (
                    <View key={idx} style={styles.benefitItem}>
                      <Ionicons name={benefit.icon as any} size={20} color={COLORS.gold.primary} />
                      <Text style={styles.benefitText}>{benefit.text}</Text>
                    </View>
                  ))}
                  
                  <TouchableOpacity style={styles.leaveButton} onPress={leaveGuild}>
                    <Text style={styles.leaveButtonText}>Leave Guild</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'boss' && (
                <View style={styles.tabContent}>
                  {bossData ? (
                    <>
                      {/* Boss Display */}
                      <Animated.View 
                        style={[
                          styles.bossContainer,
                          { 
                            transform: [
                              { translateX: bossShakeAnim },
                              { scale: bossScaleAnim }
                            ] 
                          }
                        ]}
                      >
                        <LinearGradient
                          colors={bossData.defeated ? ['#555', '#333'] : ['#8e44ad', '#6c3483']}
                          style={styles.bossCard}
                        >
                          <View style={styles.bossIconContainer}>
                            <Text style={styles.bossEmoji}>
                              {bossData.boss_name?.includes('Dragon') ? '🐉' : 
                               bossData.boss_name?.includes('Titan') ? '⚡' : '👹'}
                            </Text>
                          </View>
                          <Text style={styles.bossName}>{bossData.boss_name}</Text>
                          <Text style={styles.bossElement}>Element: {bossData.element}</Text>
                          
                          {/* HP Bar */}
                          <View style={styles.bossHpContainer}>
                            <View style={styles.bossHpBarOuter}>
                              <View 
                                style={[
                                  styles.bossHpBarFill, 
                                  { 
                                    width: `${getBossHealthPercent()}%`,
                                    backgroundColor: getBossHealthColor()
                                  }
                                ]} 
                              />
                            </View>
                            <Text style={styles.bossHpText}>
                              {bossData.current_hp?.toLocaleString()} / {bossData.max_hp?.toLocaleString()}
                            </Text>
                          </View>
                          
                          {bossData.defeated && (
                            <View style={styles.defeatedBadge}>
                              <Text style={styles.defeatedText}>DEFEATED</Text>
                            </View>
                          )}
                        </LinearGradient>
                        
                        {/* Damage Popup */}
                        {lastAttackResult && (
                          <Animated.View 
                            style={[
                              styles.damagePopup,
                              {
                                opacity: damagePopAnim,
                                transform: [{
                                  translateY: damagePopAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -50]
                                  })
                                }]
                              }
                            ]}
                          >
                            <Text style={[
                              styles.damageText,
                              lastAttackResult.is_critical && styles.criticalDamage
                            ]}>
                              {lastAttackResult.is_critical ? '💥 CRIT! ' : ''}-{lastAttackResult.damage_dealt?.toLocaleString()}
                            </Text>
                          </Animated.View>
                        )}
                      </Animated.View>
                      
                      {/* Attack Button */}
                      <TouchableOpacity
                        style={[styles.attackButton, (isAttacking || bossData.defeated || attacksRemaining <= 0) && styles.attackButtonDisabled]}
                        onPress={attackBoss}
                        disabled={isAttacking || bossData.defeated || attacksRemaining <= 0}
                      >
                        <LinearGradient
                          colors={bossData.defeated ? ['#555', '#333'] : attacksRemaining <= 0 ? ['#666', '#444'] : ['#e74c3c', '#c0392b']}
                          style={styles.attackButtonGradient}
                        >
                          {isAttacking ? (
                            <ActivityIndicator color={COLORS.cream.pure} />
                          ) : (
                            <>
                              <Ionicons name="flash" size={24} color={COLORS.cream.pure} />
                              <Text style={styles.attackButtonText}>
                                {bossData.defeated ? 'Boss Defeated' : attacksRemaining <= 0 ? 'No Attacks Left' : 'ATTACK!'}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                      
                      {/* Attacks Remaining Counter */}
                      <View style={styles.attacksCounter}>
                        <Ionicons name="flame" size={16} color={attacksRemaining > 0 ? COLORS.gold.primary : '#666'} />
                        <Text style={[styles.attacksCounterText, attacksRemaining <= 0 && { color: '#666' }]}>
                          {attacksRemaining}/{maxAttacks} attacks today
                        </Text>
                        {user?.vip_level && user.vip_level >= 7 && (
                          <Text style={styles.vipBonusText}>👑 VIP Bonus</Text>
                        )}
                      </View>
                      
                      {/* Your Contribution */}
                      {lastAttackResult && (
                        <View style={styles.contributionCard}>
                          <Text style={styles.contributionTitle}>Your Contribution</Text>
                          <Text style={styles.contributionValue}>
                            {lastAttackResult.your_total_damage?.toLocaleString()} damage
                          </Text>
                        </View>
                      )}
                      
                      {/* Boss Rewards */}
                      <View style={styles.rewardsPreview}>
                        <Text style={styles.rewardsPreviewTitle}>Boss Rewards</Text>
                        <View style={styles.rewardsRow}>
                          {Object.entries(bossData.rewards || {}).map(([type, amount]) => (
                            <View key={type} style={styles.rewardItem}>
                              <Ionicons 
                                name={type === 'crystals' ? 'diamond' : type === 'divine_essence' ? 'sparkles' : 'star'} 
                                size={16} 
                                color={COLORS.gold.primary} 
                              />
                              <Text style={styles.rewardText}>{(amount as number).toLocaleString()}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  ) : (
                    <ActivityIndicator size="large" color={COLORS.gold.primary} />
                  )}
                </View>
              )}

              {activeTab === 'donate' && (
                <View style={styles.tabContent}>
                  {/* Donation Card */}
                  <View style={styles.donateCard}>
                    <Text style={styles.donateTitle}>Support Your Guild</Text>
                    <Text style={styles.donateSubtitle}>Donate to earn Guild Points!</Text>
                    
                    {/* Currency Selection */}
                    <View style={styles.currencySelect}>
                      <TouchableOpacity
                        style={[styles.currencyOption, donationType === 'coins' && styles.currencyOptionActive]}
                        onPress={() => setDonationType('coins')}
                      >
                        <Ionicons name="cash" size={24} color={donationType === 'coins' ? COLORS.navy.darkest : COLORS.cream.soft} />
                        <Text style={[styles.currencyText, donationType === 'coins' && styles.currencyTextActive]}>Coins</Text>
                        <Text style={[styles.currencyBalance, donationType === 'coins' && styles.currencyBalanceActive]}>
                          {(user?.coins || 0).toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.currencyOption, donationType === 'gold' && styles.currencyOptionActive]}
                        onPress={() => setDonationType('gold')}
                      >
                        <Ionicons name="star" size={24} color={donationType === 'gold' ? COLORS.navy.darkest : COLORS.cream.soft} />
                        <Text style={[styles.currencyText, donationType === 'gold' && styles.currencyTextActive]}>Gold</Text>
                        <Text style={[styles.currencyBalance, donationType === 'gold' && styles.currencyBalanceActive]}>
                          {(user?.gold || 0).toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Amount Input */}
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.amountLabel}>Amount to Donate</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={donationAmount}
                        onChangeText={setDonationAmount}
                        keyboardType="numeric"
                        placeholder="Enter amount"
                        placeholderTextColor={COLORS.navy.light}
                      />
                    </View>
                    
                    {/* Quick Amounts */}
                    <View style={styles.quickAmounts}>
                      {['1000', '5000', '10000', '50000'].map((amount) => (
                        <TouchableOpacity
                          key={amount}
                          style={styles.quickAmountBtn}
                          onPress={() => setDonationAmount(amount)}
                        >
                          <Text style={styles.quickAmountText}>{parseInt(amount).toLocaleString()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    {/* Donate Button */}
                    <TouchableOpacity
                      style={[styles.donateButton, isDonating && styles.donateButtonDisabled]}
                      onPress={makeDonation}
                      disabled={isDonating}
                    >
                      <LinearGradient
                        colors={[COLORS.gold.primary, COLORS.gold.dark]}
                        style={styles.donateButtonGradient}
                      >
                        {isDonating ? (
                          <ActivityIndicator color={COLORS.navy.darkest} />
                        ) : (
                          <>
                            <Ionicons name="gift" size={20} color={COLORS.navy.darkest} />
                            <Text style={styles.donateButtonText}>Donate</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Recent Donations */}
                  <View style={styles.donationHistory}>
                    <Text style={styles.historyTitle}>Recent Donations</Text>
                    {donationHistory.length === 0 ? (
                      <Text style={styles.noHistory}>No donations yet</Text>
                    ) : (
                      donationHistory.slice(0, 5).map((donation, idx) => (
                        <View key={idx} style={styles.historyItem}>
                          <Ionicons 
                            name={donation.currency_type === 'coins' ? 'cash' : 'star'} 
                            size={16} 
                            color={COLORS.gold.primary} 
                          />
                          <Text style={styles.historyUsername}>{donation.username}</Text>
                          <Text style={styles.historyAmount}>
                            +{donation.amount?.toLocaleString()}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}
            </>
          ) : (
            // No Guild - Show Create/Join options
            <View style={styles.noGuild}>
              <Ionicons name="shield-outline" size={80} color={COLORS.gold.primary} />
              <Text style={styles.noGuildTitle}>Join a Guild</Text>
              <Text style={styles.noGuildSubtitle}>Team up with other players!</Text>
              
              <TouchableOpacity
                style={styles.createGuildButton}
                onPress={() => setShowCreateModal(true)}
              >
                <LinearGradient
                  colors={[COLORS.gold.primary, COLORS.gold.dark]}
                  style={styles.createGuildGradient}
                >
                  <Ionicons name="add-circle" size={24} color={COLORS.navy.darkest} />
                  <Text style={styles.createGuildText}>Create Guild</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.findGuildButton}
                onPress={() => { loadAvailableGuilds(); setShowJoinModal(true); }}
              >
                <Text style={styles.findGuildText}>Find Guild</Text>
              </TouchableOpacity>
              
              {/* Benefits Preview */}
              <View style={styles.benefitsPreview}>
                <Text style={styles.benefitsTitle}>Guild Benefits</Text>
                {[
                  { icon: 'people', text: 'Team up with other players' },
                  { icon: 'skull', text: 'Fight powerful Guild Bosses' },
                  { icon: 'gift', text: 'Donate and request items' },
                  { icon: 'trophy', text: 'Compete in Guild Wars' },
                  { icon: 'cart', text: 'Access exclusive Guild Shop' },
                ].map((benefit, idx) => (
                  <View key={idx} style={styles.benefitItem}>
                    <Ionicons name={benefit.icon as any} size={20} color={COLORS.gold.primary} />
                    <Text style={styles.benefitText}>{benefit.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Create Guild Modal */}
        <Modal visible={showCreateModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Guild</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Guild Name"
                placeholderTextColor={COLORS.navy.light}
                value={guildName}
                onChangeText={setGuildName}
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Description (optional)"
                placeholderTextColor={COLORS.navy.light}
                value={guildDescription}
                onChangeText={setGuildDescription}
                multiline
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, isCreating && styles.modalConfirmDisabled]}
                  onPress={createGuild}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color={COLORS.navy.darkest} />
                  ) : (
                    <Text style={styles.modalConfirmText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Join Guild Modal */}
        <Modal visible={showJoinModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Available Guilds</Text>
              <ScrollView style={styles.guildList}>
                {availableGuilds.length === 0 ? (
                  <Text style={styles.noGuildsText}>No guilds available</Text>
                ) : (
                  availableGuilds.map((guild, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.guildListItem}
                      onPress={() => joinGuild(guild.id)}
                    >
                      <Ionicons name="shield" size={24} color={COLORS.gold.primary} />
                      <View style={styles.guildListInfo}>
                        <Text style={styles.guildListName}>{guild.name}</Text>
                        <Text style={styles.guildListMembers}>{guild.member_count} members</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.cream.dark} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowJoinModal(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
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
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  placeholder: { width: 40 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 100 },
  loader: { marginTop: 40 },
  
  // Guild Card
  guildCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  guildHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  guildInfo: { marginLeft: 12 },
  guildName: { fontSize: 20, fontWeight: 'bold', color: COLORS.navy.darkest },
  guildLevel: { fontSize: 14, color: COLORS.navy.dark },
  guildStats: { flexDirection: 'row', justifyContent: 'space-around' },
  guildStat: { alignItems: 'center' },
  guildStatValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy.darkest },
  guildStatLabel: { fontSize: 12, color: COLORS.navy.dark },
  
  // Tab Bar
  tabBar: { flexDirection: 'row', marginBottom: 16, backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  tabActive: { backgroundColor: COLORS.gold.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.cream.soft },
  tabTextActive: { color: COLORS.navy.darkest },
  tabContent: { flex: 1 },
  
  // Benefits
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, backgroundColor: COLORS.navy.medium, padding: 12, borderRadius: 10 },
  benefitText: { fontSize: 14, color: COLORS.cream.soft, flex: 1 },
  
  leaveButton: { marginTop: 20, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c', borderRadius: 10 },
  leaveButtonText: { color: '#e74c3c', fontSize: 14, fontWeight: '600' },
  
  // Boss
  bossContainer: { alignItems: 'center', marginBottom: 20, position: 'relative' },
  bossCard: { borderRadius: 20, padding: 24, alignItems: 'center', width: '100%' },
  bossIconContainer: { marginBottom: 12 },
  bossEmoji: { fontSize: 60 },
  bossName: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 4 },
  bossElement: { fontSize: 14, color: COLORS.cream.soft, marginBottom: 16 },
  bossHpContainer: { width: '100%' },
  bossHpBarOuter: { height: 16, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
  bossHpBarFill: { height: '100%', borderRadius: 8 },
  bossHpText: { fontSize: 12, color: COLORS.cream.soft, textAlign: 'center' },
  defeatedBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#555', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  defeatedText: { fontSize: 10, fontWeight: 'bold', color: COLORS.cream.pure },
  
  damagePopup: { position: 'absolute', top: 20 },
  damageText: { fontSize: 24, fontWeight: 'bold', color: '#e74c3c' },
  criticalDamage: { fontSize: 32, color: COLORS.gold.primary },
  
  attackButton: { borderRadius: 30, overflow: 'hidden', marginBottom: 16 },
  attackButtonDisabled: { opacity: 0.6 },
  attackButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 12 },
  attackButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, letterSpacing: 1 },
  
  contributionCard: { backgroundColor: COLORS.navy.medium, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  contributionTitle: { fontSize: 12, color: COLORS.cream.dark },
  contributionValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  
  // Attacks counter
  attacksCounter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  attacksCounterText: { fontSize: 14, color: COLORS.cream.soft },
  vipBonusText: { fontSize: 12, color: COLORS.gold.primary, marginLeft: 4 },
  
  rewardsPreview: { backgroundColor: COLORS.navy.medium, padding: 16, borderRadius: 12 },
  rewardsPreviewTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  rewardsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rewardText: { fontSize: 14, color: COLORS.cream.soft },
  
  // Donate
  donateCard: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 20, marginBottom: 16 },
  donateTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  donateSubtitle: { fontSize: 12, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 16 },
  
  currencySelect: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  currencyOption: { flex: 1, backgroundColor: COLORS.navy.primary, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  currencyOptionActive: { backgroundColor: COLORS.gold.primary, borderColor: COLORS.gold.light },
  currencyText: { fontSize: 14, fontWeight: '600', color: COLORS.cream.soft, marginTop: 4 },
  currencyTextActive: { color: COLORS.navy.darkest },
  currencyBalance: { fontSize: 12, color: COLORS.cream.dark },
  currencyBalanceActive: { color: COLORS.navy.dark },
  
  amountInputContainer: { marginBottom: 12 },
  amountLabel: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 6 },
  amountInput: { backgroundColor: COLORS.navy.primary, borderRadius: 10, padding: 14, color: COLORS.cream.pure, fontSize: 16, textAlign: 'center' },
  
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickAmountBtn: { flex: 1, backgroundColor: COLORS.navy.primary, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  quickAmountText: { fontSize: 12, color: COLORS.cream.soft },
  
  donateButton: { borderRadius: 25, overflow: 'hidden' },
  donateButtonDisabled: { opacity: 0.6 },
  donateButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  donateButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  
  donationHistory: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16 },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  noHistory: { fontSize: 12, color: COLORS.cream.dark, textAlign: 'center' },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  historyUsername: { flex: 1, fontSize: 12, color: COLORS.cream.soft },
  historyAmount: { fontSize: 12, color: COLORS.gold.primary, fontWeight: '600' },
  
  // No Guild
  noGuild: { alignItems: 'center', paddingTop: 40 },
  noGuildTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 16 },
  noGuildSubtitle: { fontSize: 14, color: COLORS.cream.dark, marginBottom: 24 },
  
  createGuildButton: { borderRadius: 25, overflow: 'hidden', marginBottom: 12 },
  createGuildGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 32, gap: 8 },
  createGuildText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  
  findGuildButton: { padding: 14 },
  findGuildText: { fontSize: 16, color: COLORS.gold.primary },
  
  benefitsPreview: { marginTop: 32, width: '100%' },
  benefitsTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12, textAlign: 'center' },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { backgroundColor: COLORS.navy.medium, borderRadius: 20, padding: 24, width: '85%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: COLORS.navy.primary, borderRadius: 10, padding: 14, color: COLORS.cream.pure, marginBottom: 12 },
  modalTextArea: { height: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cream.dark, borderRadius: 10 },
  modalCancelText: { color: COLORS.cream.soft, fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, backgroundColor: COLORS.gold.primary, padding: 14, alignItems: 'center', borderRadius: 10 },
  modalConfirmDisabled: { opacity: 0.6 },
  modalConfirmText: { color: COLORS.navy.darkest, fontSize: 14, fontWeight: '600' },
  
  guildList: { maxHeight: 300 },
  noGuildsText: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', paddingVertical: 20 },
  guildListItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.navy.primary, borderRadius: 10, marginBottom: 8 },
  guildListInfo: { flex: 1, marginLeft: 12 },
  guildListName: { fontSize: 14, fontWeight: '600', color: COLORS.cream.pure },
  guildListMembers: { fontSize: 12, color: COLORS.cream.dark },
  
  // Error states
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
  loginButton: { backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  loginButtonText: { color: COLORS.navy.darkest, fontSize: 16, fontWeight: 'bold' },
});
