import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import {
  getUserGuild,
  getUserFrames,
  equipFrameApi,
  unequipFrameApi,
  redeemCode,
} from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../theme/colors';
import ProfileFrame, { FRAME_DEFINITIONS, getAvailableFrames } from '../components/ProfileFrame';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userHeroes, fetchUserHeroes, fetchUser, logout } = useGameStore();
  const hydrated = useHydration();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{success: boolean; message: string; rewards?: any} | null>(null);
  
  // Frame state
  const [showFrameModal, setShowFrameModal] = useState(false);
  const [availableFrames, setAvailableFrames] = useState<any[]>([]);
  const [lockedFrames, setLockedFrames] = useState<any[]>([]);
  const [equippedFrame, setEquippedFrame] = useState('default');
  const [loadingFrames, setLoadingFrames] = useState(false);
  
  // Guild state
  const [guildInfo, setGuildInfo] = useState<any>(null);
  const [loadingGuild, setLoadingGuild] = useState(false);

  useEffect(() => {
    if (hydrated && user) {
      fetchUserHeroes();
      loadUserFrames();
      loadGuildInfo();
    }
  }, [hydrated, user?.username]);
  
  const loadGuildInfo = async () => {
    if (!user) return;
    setLoadingGuild(true);
    try {
      const response = await axios.get(`${API_BASE}/guild/${user.username}`);
      setGuildInfo(response.data);
    } catch (error) {
      // User not in a guild
      setGuildInfo(null);
    } finally {
      setLoadingGuild(false);
    }
  };

  const loadUserFrames = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE}/user/${user.username}/frames`);
      setAvailableFrames(response.data.available_frames || []);
      setLockedFrames(response.data.locked_frames || []);
      setEquippedFrame(response.data.equipped_frame || 'default');
    } catch (error) {
      console.error('Error loading frames:', error);
    }
  };

  const equipFrame = async (frameId: string) => {
    if (!user) return;
    try {
      setLoadingFrames(true);
      await axios.post(`${API_BASE}/user/${user.username}/equip-frame?frame_id=${frameId}`);
      setEquippedFrame(frameId);
      await loadUserFrames();
      Alert.alert('Success', 'Frame equipped successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to equip frame');
    } finally {
      setLoadingFrames(false);
    }
  };

  const unequipFrame = async () => {
    if (!user) return;
    try {
      setLoadingFrames(true);
      await axios.post(`${API_BASE}/user/${user.username}/unequip-frame`);
      setEquippedFrame('default');
      await loadUserFrames();
      Alert.alert('Success', 'Frame unequipped');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to unequip frame');
    } finally {
      setLoadingFrames(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleRedeemCode = async () => {
    if (!codeInput.trim()) {
      Alert.alert('Error', 'Please enter a code');
      return;
    }
    if (!user) return;

    setIsRedeeming(true);
    setRedeemResult(null);

    try {
      const response = await axios.post(
        `${API_BASE}/codes/redeem?username=${encodeURIComponent(user.username)}&code=${encodeURIComponent(codeInput.trim())}`
      );
      
      setRedeemResult({
        success: true,
        message: response.data.message,
        rewards: response.data.rewards
      });
      
      // Refresh user data to update currencies
      await fetchUser();
      setCodeInput('');
    } catch (error: any) {
      setRedeemResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to redeem code'
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
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
          <Text style={styles.noUserText}>Please login first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const rarityCount = userHeroes.reduce(
    (acc, hero) => {
      const rarity = hero.hero_data?.rarity || 'SR';
      acc[rarity] = (acc[rarity] || 0) + 1;
      return acc;
    },
    {} as { [key: string]: number }
  );

  const totalDuplicates = userHeroes.reduce((sum, hero) => sum + hero.duplicates, 0);
  const averageRank = userHeroes.length > 0
    ? (userHeroes.reduce((sum, hero) => sum + hero.rank, 0) / userHeroes.length).toFixed(1)
    : '0';

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header with ProfileFrame */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowFrameModal(true)} activeOpacity={0.8}>
              <ProfileFrame 
                username={user.username}
                frameId={equippedFrame}
                size="xlarge"
                vipLevel={user.vip_level || 0}
              />
              <View style={styles.editFrameBadge}>
                <Ionicons name="create" size={14} color={COLORS.cream.pure} />
              </View>
            </TouchableOpacity>
            <Text style={styles.username}>{user.username}</Text>
            <View style={styles.vipBadgeHeader}>
              <Text style={styles.vipText}>VIP {user.vip_level || 0}</Text>
            </View>
            <View style={styles.dayBadge}>
              <Ionicons name="calendar" size={16} color={COLORS.gold.primary} />
              <Text style={styles.dayText}>Day {user.login_days}</Text>
            </View>
          </View>

          {/* Guild Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚔️ Guild</Text>
            {loadingGuild ? (
              <ActivityIndicator size="small" color={COLORS.gold.primary} />
            ) : guildInfo ? (
              <TouchableOpacity 
                style={styles.guildCard} 
                onPress={() => router.push('/guild')}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={[COLORS.gold.dark + '40', COLORS.navy.medium]} 
                  style={styles.guildCardGradient}
                >
                  <View style={styles.guildCardLeft}>
                    <Ionicons name="shield" size={36} color={COLORS.gold.primary} />
                  </View>
                  <View style={styles.guildCardInfo}>
                    <Text style={styles.guildCardName}>{guildInfo.name}</Text>
                    <Text style={styles.guildCardLevel}>Level {guildInfo.level || 1}</Text>
                    <Text style={styles.guildCardMembers}>
                      {guildInfo.member_count || 1} Member{guildInfo.member_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={COLORS.cream.dark} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.joinGuildCard}
                onPress={() => router.push('/guild')}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-outline" size={32} color={COLORS.cream.dark} />
                <View style={styles.joinGuildInfo}>
                  <Text style={styles.joinGuildTitle}>No Guild</Text>
                  <Text style={styles.joinGuildSubtitle}>Tap to join or create a guild!</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={COLORS.cream.dark} />
              </TouchableOpacity>
            )}
          </View>

          {/* Currency Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resources</Text>
            <View style={styles.resourceGrid}>
              <View style={styles.resourceCard}>
                <Ionicons name="diamond" size={32} color={COLORS.rarity['UR+']} />
                <Text style={styles.resourceValue}>{user.gems}</Text>
                <Text style={styles.resourceLabel}>Crystals</Text>
              </View>
              <View style={styles.resourceCard}>
                <Ionicons name="cash" size={32} color={COLORS.gold.light} />
                <Text style={styles.resourceValue}>{user.coins}</Text>
                <Text style={styles.resourceLabel}>Coins</Text>
              </View>
              <View style={styles.resourceCard}>
                <Ionicons name="star" size={32} color={COLORS.gold.primary} />
                <Text style={styles.resourceValue}>{user.gold}</Text>
                <Text style={styles.resourceLabel}>Gold</Text>
              </View>
            </View>
          </View>

          {/* Gacha Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gacha Statistics</Text>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Pulls</Text>
                <Text style={styles.statValue}>{user.total_pulls}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Common Pity</Text>
                <Text style={styles.statValue}>{user.pity_counter || 0} / 50</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Premium Pity</Text>
                <Text style={styles.statValue}>{user.pity_counter_premium || 0} / 50</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Divine Pity</Text>
                <Text style={styles.statValue}>{user.pity_counter_divine || 0} / 40</Text>
              </View>
            </View>
          </View>

          {/* Collection Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collection</Text>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Heroes</Text>
                <Text style={styles.statValue}>{userHeroes.length}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Duplicates</Text>
                <Text style={styles.statValue}>{totalDuplicates}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Average Rank</Text>
                <Text style={styles.statValue}>{averageRank}</Text>
              </View>
            </View>

            {Object.keys(rarityCount).length > 0 && (
              <View style={styles.rarityBreakdown}>
                <Text style={styles.rarityTitle}>By Rarity</Text>
                <View style={styles.rarityGrid}>
                  {['SR', 'SSR', 'SSR+', 'UR', 'UR+'].map((rarity) => (
                    <View key={rarity} style={[styles.rarityItem, { borderColor: COLORS.rarity[rarity as keyof typeof COLORS.rarity] + '60' }]}>
                      <Text style={[styles.rarityName, { color: COLORS.rarity[rarity as keyof typeof COLORS.rarity] }]}>{rarity}</Text>
                      <Text style={styles.rarityCount}>{rarityCount[rarity] || 0}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Achievements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementsList}>
              <View style={[styles.achievementCard, user.login_days >= 7 && styles.achievementUnlocked]}>
                <Ionicons
                  name="trophy"
                  size={24}
                  color={user.login_days >= 7 ? COLORS.gold.primary : COLORS.navy.light}
                />
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>7 Day Warrior</Text>
                  <Text style={styles.achievementDesc}>Login for 7 days</Text>
                </View>
                {user.login_days >= 7 && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                )}
              </View>

              <View style={[styles.achievementCard, user.total_pulls >= 50 && styles.achievementUnlocked]}>
                <Ionicons
                  name="gift"
                  size={24}
                  color={user.total_pulls >= 50 ? COLORS.gold.primary : COLORS.navy.light}
                />
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>Gacha Enthusiast</Text>
                  <Text style={styles.achievementDesc}>Perform 50 summons</Text>
                </View>
                {user.total_pulls >= 50 && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                )}
              </View>

              <View style={[styles.achievementCard, userHeroes.length >= 10 && styles.achievementUnlocked]}>
                <Ionicons
                  name="people"
                  size={24}
                  color={userHeroes.length >= 10 ? COLORS.gold.primary : COLORS.navy.light}
                />
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>Collector</Text>
                  <Text style={styles.achievementDesc}>Collect 10 heroes</Text>
                </View>
                {userHeroes.length >= 10 && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                )}
              </View>
            </View>
          </View>

          {/* Redeem Code Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎁 Redeem Code</Text>
            <TouchableOpacity 
              style={styles.redeemButton}
              onPress={() => {
                setShowCodeModal(true);
                setRedeemResult(null);
                setCodeInput('');
              }}
            >
              <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.redeemButtonGradient}>
                <Ionicons name="gift" size={24} color={COLORS.navy.darkest} />
                <Text style={styles.redeemButtonText}>Enter Redemption Code</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.redeemHint}>
              Got a code? Enter it to claim free rewards!
            </Text>
          </View>

          {/* Admin Panel Button - Only visible for admins */}
          {user.is_admin && (
            <TouchableOpacity 
              style={styles.adminButton} 
              onPress={() => router.push('/admin')}
            >
              <LinearGradient colors={['#ef4444', '#dc2626', '#7f1d1d']} style={styles.adminButtonGradient}>
                <Ionicons name="shield-checkmark" size={24} color={COLORS.cream.pure} />
                <Text style={styles.adminButtonText}>Admin Panel</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.cream.pure} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color={COLORS.cream.pure} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          {/* Code Redemption Modal */}
          <Modal
            visible={showCodeModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowCodeModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🎁 Redeem Code</Text>
                  <TouchableOpacity onPress={() => setShowCodeModal(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={styles.codeInput}
                  value={codeInput}
                  onChangeText={setCodeInput}
                  placeholder="Enter your code"
                  placeholderTextColor={COLORS.navy.light}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                
                {redeemResult && (
                  <View style={[
                    styles.resultBox, 
                    redeemResult.success ? styles.resultSuccess : styles.resultError
                  ]}>
                    <Ionicons 
                      name={redeemResult.success ? "checkmark-circle" : "alert-circle"} 
                      size={20} 
                      color={redeemResult.success ? "#2ecc71" : "#e74c3c"} 
                    />
                    <View style={styles.resultTextContainer}>
                      <Text style={styles.resultMessage}>{redeemResult.message}</Text>
                      {redeemResult.rewards && (
                        <View style={styles.rewardsContainer}>
                          {Object.entries(redeemResult.rewards).map(([key, value]) => (
                            <Text key={key} style={styles.rewardItem}>
                              +{formatNumber(value as number)} {key}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}
                
                <TouchableOpacity
                  style={[styles.submitButton, isRedeeming && styles.submitButtonDisabled]}
                  onPress={handleRedeemCode}
                  disabled={isRedeeming}
                >
                  <LinearGradient 
                    colors={isRedeeming ? ['#666', '#444'] : [COLORS.gold.primary, COLORS.gold.dark]} 
                    style={styles.submitButtonGradient}
                  >
                    {isRedeeming ? (
                      <ActivityIndicator color={COLORS.cream.pure} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color={COLORS.navy.darkest} />
                        <Text style={styles.submitButtonText}>Redeem</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Frame Selection Modal */}
          <Modal
            visible={showFrameModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowFrameModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🖼️ Profile Frames</Text>
                  <TouchableOpacity onPress={() => setShowFrameModal(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.frameSubtitle}>
                  VIP Level: {user.vip_level || 0} • Tap a frame to equip
                </Text>

                <ScrollView style={styles.frameScrollView} showsVerticalScrollIndicator={false}>
                  {/* Available Frames */}
                  <Text style={styles.frameSectionTitle}>Available Frames</Text>
                  <View style={styles.framesGrid}>
                    {availableFrames.map((frame) => (
                      <TouchableOpacity
                        key={frame.id}
                        style={[
                          styles.frameCard,
                          frame.is_equipped && styles.frameCardEquipped,
                        ]}
                        onPress={() => frame.is_equipped ? unequipFrame() : equipFrame(frame.id)}
                        disabled={loadingFrames}
                      >
                        <ProfileFrame
                          username={user.username}
                          frameId={frame.id}
                          size="medium"
                        />
                        <Text style={styles.frameCardName} numberOfLines={1}>
                          {frame.name}
                        </Text>
                        {frame.is_equipped && (
                          <View style={styles.equippedBadge}>
                            <Text style={styles.equippedBadgeText}>EQUIPPED</Text>
                          </View>
                        )}
                        {frame.is_special && (
                          <View style={styles.specialBadge}>
                            <Text style={styles.specialBadgeText}>SPECIAL</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Locked Frames */}
                  {lockedFrames.length > 0 && (
                    <>
                      <Text style={[styles.frameSectionTitle, { marginTop: 20 }]}>
                        Locked Frames
                      </Text>
                      <View style={styles.framesGrid}>
                        {lockedFrames.map((frame) => (
                          <View
                            key={frame.id}
                            style={[styles.frameCard, styles.frameCardLocked]}
                          >
                            <View style={styles.lockedOverlay}>
                              <Ionicons name="lock-closed" size={20} color={COLORS.cream.dark} />
                            </View>
                            <ProfileFrame
                              username={user.username}
                              frameId={frame.id}
                              size="medium"
                            />
                            <Text style={[styles.frameCardName, { color: COLORS.cream.dark }]} numberOfLines={1}>
                              {frame.name}
                            </Text>
                            <Text style={styles.frameRequirement}>
                              {frame.is_special 
                                ? 'Special Achievement'
                                : `VIP ${frame.required_vip} Required`
                              }
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </ScrollView>

                {loadingFrames && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.gold.primary} />
                  </View>
                )}
              </View>
            </View>
          </Modal>

          {/* Version Info */}
          <Text style={styles.versionText}>Divine Heroes v1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { marginBottom: 12 },
  avatarGradient: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.gold.light },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.navy.darkest },
  username: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 8 },
  dayBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  dayText: { color: COLORS.gold.primary, fontWeight: 'bold', fontSize: 14 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.light, marginBottom: 12 },
  resourceGrid: { flexDirection: 'row', gap: 12 },
  resourceCard: { flex: 1, backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  resourceValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  resourceLabel: { fontSize: 12, color: COLORS.cream.dark, marginTop: 4 },
  statsCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.navy.light + '30' },
  statLabel: { fontSize: 14, color: COLORS.cream.dark },
  statValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  rarityBreakdown: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginTop: 12, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  rarityTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  rarityGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rarityItem: { flex: 1, minWidth: 60, backgroundColor: COLORS.navy.dark, borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1 },
  rarityName: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
  rarityCount: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  achievementsList: { gap: 12 },
  achievementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, gap: 12, opacity: 0.5, borderWidth: 1, borderColor: COLORS.navy.light + '30' },
  achievementUnlocked: { opacity: 1, borderWidth: 2, borderColor: COLORS.success },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 2 },
  achievementDesc: { fontSize: 12, color: COLORS.cream.dark },
  
  // Guild Card Styles
  guildCard: { borderRadius: 12, overflow: 'hidden' },
  guildCardGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  guildCardLeft: { width: 50, height: 50, backgroundColor: COLORS.navy.dark + '80', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  guildCardInfo: { flex: 1 },
  guildCardName: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  guildCardLevel: { fontSize: 14, color: COLORS.gold.primary, fontWeight: '600' },
  guildCardMembers: { fontSize: 12, color: COLORS.cream.dark },
  joinGuildCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: COLORS.navy.light + '40', borderStyle: 'dashed' },
  joinGuildInfo: { flex: 1 },
  joinGuildTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.soft },
  joinGuildSubtitle: { fontSize: 12, color: COLORS.cream.dark },
  
  // Redeem Code Section
  redeemButton: { borderRadius: 12, overflow: 'hidden' },
  redeemButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 },
  redeemButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  redeemHint: { fontSize: 12, color: COLORS.cream.dark, textAlign: 'center', marginTop: 8 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.navy.primary, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, borderWidth: 2, borderColor: COLORS.gold.dark },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  codeInput: { backgroundColor: COLORS.navy.dark, borderRadius: 12, padding: 16, fontSize: 18, color: COLORS.cream.pure, borderWidth: 1, borderColor: COLORS.gold.dark + '60', textAlign: 'center', letterSpacing: 2, marginBottom: 16 },
  resultBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 8, marginBottom: 16, gap: 10 },
  resultSuccess: { backgroundColor: '#2ecc7120', borderWidth: 1, borderColor: '#2ecc71' },
  resultError: { backgroundColor: '#e74c3c20', borderWidth: 1, borderColor: '#e74c3c' },
  resultTextContainer: { flex: 1 },
  resultMessage: { fontSize: 14, color: COLORS.cream.pure, fontWeight: '500' },
  rewardsContainer: { marginTop: 8, gap: 4 },
  rewardItem: { fontSize: 13, color: COLORS.gold.primary, fontWeight: '600' },
  submitButton: { borderRadius: 12, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 8 },
  submitButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.error, borderRadius: 12, padding: 16, marginTop: 16, gap: 8 },
  logoutText: { color: COLORS.cream.pure, fontSize: 16, fontWeight: 'bold' },
  
  // Admin Button
  adminButton: { borderRadius: 12, overflow: 'hidden', marginTop: 16 },
  adminButtonGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    gap: 8 
  },
  adminButtonText: { color: COLORS.cream.pure, fontSize: 16, fontWeight: 'bold', flex: 1 },
  
  versionText: { textAlign: 'center', color: COLORS.navy.light, fontSize: 12, marginTop: 24, marginBottom: 16 },
  noUserText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
  
  // Frame Modal Styles
  editFrameBadge: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    backgroundColor: COLORS.gold.primary, 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.navy.darkest,
  },
  vipBadgeHeader: {
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  vipText: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy.darkest },
  frameSubtitle: { fontSize: 12, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 16 },
  frameScrollView: { maxHeight: 400 },
  frameSectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 12 },
  framesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  frameCard: {
    width: 100,
    backgroundColor: COLORS.navy.dark,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  frameCardEquipped: {
    borderColor: COLORS.gold.primary,
    backgroundColor: COLORS.gold.dark + '30',
  },
  frameCardLocked: {
    opacity: 0.5,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  frameCardName: { fontSize: 10, color: COLORS.cream.pure, textAlign: 'center', marginTop: 8 },
  equippedBadge: {
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  equippedBadgeText: { fontSize: 8, fontWeight: 'bold', color: COLORS.navy.darkest },
  specialBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  specialBadgeText: { fontSize: 8, fontWeight: 'bold', color: COLORS.cream.pure },
  frameRequirement: { fontSize: 9, color: COLORS.gold.light, textAlign: 'center', marginTop: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
});
