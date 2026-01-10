import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import {
  adminGetUser,
  adminGrantResources,
  adminSetVIP,
  adminMuteUser,
  adminBanUser,
  adminDeleteAccount,
} from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

interface UserSearchResult {
  username: string;
  level: number;
  vip_level: number;
  is_banned: boolean;
  is_muted: boolean;
  created_at: string;
}

export default function AdminPanelScreen() {
  const router = useRouter();
  const { user } = useGameStore();
  const hydrated = useHydration();

  // State
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  
  // Modals
  const [showActionModal, setShowActionModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showVIPModal, setShowVIPModal] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  
  // Action inputs
  const [grantResources, setGrantResources] = useState({
    gems: '',
    coins: '',
    gold: '',
    divine_essence: '',
  });
  const [newVIPLevel, setNewVIPLevel] = useState('');
  const [muteDuration, setMuteDuration] = useState('24');
  const [banReason, setBanReason] = useState('');
  
  // Processing states
  const [processing, setProcessing] = useState(false);

  // Check if user is admin
  const isAdmin = user?.is_admin === true;
  const adminPermissions = user?.admin_permissions || [];

  const hasPermission = (perm: string) => adminPermissions.includes(perm);

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a username to search');
      return;
    }
    
    setLoading(true);
    try {
      const data = await adminGetUser(searchQuery.trim());
      if (data) {
        setSearchResults([{
          username: data.username,
          level: data.level || 1,
          vip_level: data.vip_level || 0,
          is_banned: data.is_banned || false,
          is_muted: data.is_muted || false,
          created_at: data.created_at || 'Unknown',
        }]);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        Alert.alert('Not Found', 'User not found');
        setSearchResults([]);
      } else {
        Alert.alert('Error', 'Failed to search users');
      }
    } finally {
      setLoading(false);
    }
  };

  const grantResourcesToUser = async () => {
    if (!selectedUser || !user) return;
    
    const resources: any = {};
    if (grantResources.gems) resources.gems = parseInt(grantResources.gems);
    if (grantResources.coins) resources.coins = parseInt(grantResources.coins);
    if (grantResources.gold) resources.gold = parseInt(grantResources.gold);
    if (grantResources.divine_essence) resources.divine_essence = parseInt(grantResources.divine_essence);
    
    if (Object.keys(resources).length === 0) {
      Alert.alert('Error', 'Please enter at least one resource amount');
      return;
    }
    
    setProcessing(true);
    try {
      await adminGrantResources(selectedUser.username, user.username, resources);
      Alert.alert('Success', `Resources granted to ${selectedUser.username}`);
      setShowGrantModal(false);
      setGrantResources({ gems: '', coins: '', gold: '', divine_essence: '' });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to grant resources');
    } finally {
      setProcessing(false);
    }
  };

  const setUserVIP = async () => {
    if (!selectedUser || !user || !newVIPLevel) return;
    
    const level = parseInt(newVIPLevel);
    if (isNaN(level) || level < 0 || level > 15) {
      Alert.alert('Error', 'VIP level must be between 0 and 15');
      return;
    }
    
    setProcessing(true);
    try {
      await adminSetVIP(selectedUser.username, user.username, level);
      Alert.alert('Success', `VIP level set to ${level} for ${selectedUser.username}`);
      setShowVIPModal(false);
      setNewVIPLevel('');
      searchUsers(); // Refresh
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to set VIP');
    } finally {
      setProcessing(false);
    }
  };

  const muteUser = async () => {
    if (!selectedUser || !user) return;
    
    const hours = parseInt(muteDuration) || 24;
    
    setProcessing(true);
    try {
      await adminMuteUser(selectedUser.username, user.username, hours);
      Alert.alert('Success', `${selectedUser.username} has been muted for ${hours} hours`);
      setShowMuteModal(false);
      searchUsers(); // Refresh
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to mute user');
    } finally {
      setProcessing(false);
    }
  };

  const banUser = async () => {
    if (!selectedUser || !user) return;
    
    const reason = banReason.trim() || 'Violation of terms';
    
    Alert.alert(
      'Confirm Ban',
      `Are you sure you want to ban ${selectedUser.username}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban User',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await adminBanUser(selectedUser.username, user.username, reason);
              Alert.alert('Success', `${selectedUser.username} has been banned`);
              setShowBanModal(false);
              setBanReason('');
              searchUsers(); // Refresh
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to ban user');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const deleteUserAccount = async () => {
    if (!selectedUser || !user) return;
    
    Alert.alert(
      '⚠️ Delete Account',
      `Are you absolutely sure you want to DELETE ${selectedUser.username}'s account? This will permanently remove all their data and CANNOT be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE FOREVER',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await axios.delete(
                `${API_BASE}/admin/delete-account/${selectedUser.username}?admin_key=${user.username}`
              );
              Alert.alert('Deleted', `${selectedUser.username}'s account has been deleted`);
              setShowActionModal(false);
              setSelectedUser(null);
              setSearchResults([]);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete account');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  // Not hydrated yet
  if (!hydrated) {
    return (
      <LinearGradient colors={['#1a0a0a', '#2d1f1f']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <LinearGradient colors={['#1a0a0a', '#2d1f1f']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Please login first</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <LinearGradient colors={['#1a0a0a', '#2d1f1f']} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="shield-checkmark" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>You do not have admin privileges</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const renderUserCard = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => {
        setSelectedUser(item);
        setShowActionModal(true);
      }}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.username}</Text>
        <View style={styles.userBadges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Lv.{item.level}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: COLORS.gold.primary + '40' }]}>
            <Text style={[styles.badgeText, { color: COLORS.gold.primary }]}>VIP {item.vip_level}</Text>
          </View>
          {item.is_banned && (
            <View style={[styles.badge, { backgroundColor: '#ef444440' }]}>
              <Text style={[styles.badgeText, { color: '#ef4444' }]}>BANNED</Text>
            </View>
          )}
          {item.is_muted && (
            <View style={[styles.badge, { backgroundColor: '#f59e0b40' }]}>
              <Text style={[styles.badgeText, { color: '#f59e0b' }]}>MUTED</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color={COLORS.cream.dark} />
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#1a0a0a', '#2d1f1f', '#1a0a0a']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="shield-checkmark" size={24} color="#ef4444" />
            <Text style={styles.headerTitle}>Admin Panel</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Admin info */}
        <View style={styles.adminInfo}>
          <Text style={styles.adminWelcome}>Logged in as: {user.username}</Text>
          <View style={styles.permissionsList}>
            {adminPermissions.map((perm: string) => (
              <View key={perm} style={styles.permBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                <Text style={styles.permText}>{perm.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Search Section */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>🔍 Search User</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Enter username..."
              placeholderTextColor={COLORS.cream.dark}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={searchUsers}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="search" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Results */}
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {searchResults.length === 0 ? (
            <Text style={styles.noResults}>No users found. Search for a username above.</Text>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderUserCard}
              keyExtractor={item => item.username}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>

        {/* User Action Modal */}
        <Modal
          visible={showActionModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.actionModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Actions for {selectedUser?.username}
                </Text>
                <TouchableOpacity onPress={() => setShowActionModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.actionsScroll}>
                {/* Grant Resources */}
                {hasPermission('grant_resources') && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => {
                      setShowActionModal(false);
                      setShowGrantModal(true);
                    }}
                  >
                    <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.actionGradient}>
                      <Ionicons name="gift" size={24} color="#fff" />
                      <Text style={styles.actionText}>Grant Resources</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Set VIP */}
                {hasPermission('set_vip') && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => {
                      setShowActionModal(false);
                      setShowVIPModal(true);
                    }}
                  >
                    <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.actionGradient}>
                      <Ionicons name="star" size={24} color="#fff" />
                      <Text style={styles.actionText}>Set VIP Level</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Mute User */}
                {hasPermission('mute') && !selectedUser?.is_muted && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => {
                      setShowActionModal(false);
                      setShowMuteModal(true);
                    }}
                  >
                    <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.actionGradient}>
                      <Ionicons name="volume-mute" size={24} color="#fff" />
                      <Text style={styles.actionText}>Mute User</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Ban User */}
                {hasPermission('ban') && !selectedUser?.is_banned && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => {
                      setShowActionModal(false);
                      setShowBanModal(true);
                    }}
                  >
                    <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.actionGradient}>
                      <Ionicons name="ban" size={24} color="#fff" />
                      <Text style={styles.actionText}>Ban User</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Delete Account */}
                {hasPermission('delete_account') && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={deleteUserAccount}
                  >
                    <LinearGradient colors={['#7f1d1d', '#450a0a']} style={styles.actionGradient}>
                      <Ionicons name="trash" size={24} color="#fff" />
                      <Text style={styles.actionText}>Delete Account</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Grant Resources Modal */}
        <Modal
          visible={showGrantModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGrantModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.inputModal}>
              <Text style={styles.inputModalTitle}>Grant Resources</Text>
              <Text style={styles.inputModalSub}>to {selectedUser?.username}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>💎 Gems</Text>
                <TextInput
                  style={styles.input}
                  value={grantResources.gems}
                  onChangeText={v => setGrantResources({...grantResources, gems: v})}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.cream.dark}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🪙 Coins</Text>
                <TextInput
                  style={styles.input}
                  value={grantResources.coins}
                  onChangeText={v => setGrantResources({...grantResources, coins: v})}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.cream.dark}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>⭐ Gold</Text>
                <TextInput
                  style={styles.input}
                  value={grantResources.gold}
                  onChangeText={v => setGrantResources({...grantResources, gold: v})}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.cream.dark}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>✨ Divine Essence</Text>
                <TextInput
                  style={styles.input}
                  value={grantResources.divine_essence}
                  onChangeText={v => setGrantResources({...grantResources, divine_essence: v})}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.cream.dark}
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelBtn}
                  onPress={() => setShowGrantModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmBtn}
                  onPress={grantResourcesToUser}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Grant</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Set VIP Modal */}
        <Modal
          visible={showVIPModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowVIPModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.inputModal}>
              <Text style={styles.inputModalTitle}>Set VIP Level</Text>
              <Text style={styles.inputModalSub}>for {selectedUser?.username}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>VIP Level (0-15)</Text>
                <TextInput
                  style={styles.input}
                  value={newVIPLevel}
                  onChangeText={setNewVIPLevel}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.cream.dark}
                  maxLength={2}
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelBtn}
                  onPress={() => setShowVIPModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, { backgroundColor: COLORS.gold.primary }]}
                  onPress={setUserVIP}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Set VIP</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Mute Modal */}
        <Modal
          visible={showMuteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMuteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.inputModal}>
              <Text style={styles.inputModalTitle}>Mute User</Text>
              <Text style={styles.inputModalSub}>{selectedUser?.username}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Duration (hours)</Text>
                <TextInput
                  style={styles.input}
                  value={muteDuration}
                  onChangeText={setMuteDuration}
                  keyboardType="number-pad"
                  placeholder="24"
                  placeholderTextColor={COLORS.cream.dark}
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelBtn}
                  onPress={() => setShowMuteModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, { backgroundColor: '#f59e0b' }]}
                  onPress={muteUser}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Mute</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Ban Modal */}
        <Modal
          visible={showBanModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBanModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.inputModal}>
              <Text style={styles.inputModalTitle}>⚠️ Ban User</Text>
              <Text style={styles.inputModalSub}>{selectedUser?.username}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={banReason}
                  onChangeText={setBanReason}
                  placeholder="Violation of terms..."
                  placeholderTextColor={COLORS.cream.dark}
                  multiline
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelBtn}
                  onPress={() => setShowBanModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, { backgroundColor: '#ef4444' }]}
                  onPress={banUser}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Ban User</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: '#ef4444', marginTop: 16 },
  errorText: { fontSize: 16, color: COLORS.cream.dark, marginTop: 8, textAlign: 'center' },
  backBtn: { marginTop: 20, backgroundColor: '#ef4444', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: 'bold' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ef444430',
  },
  backButton: { padding: 8 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#ef4444' },

  // Admin Info
  adminInfo: {
    padding: 16,
    backgroundColor: '#2d1f1f',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  adminWelcome: { fontSize: 14, color: COLORS.cream.pure, marginBottom: 8 },
  permissionsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22c55e20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permText: { fontSize: 10, color: '#22c55e', textTransform: 'capitalize' },

  // Search
  searchSection: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#2d1f1f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.cream.pure,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  searchButton: {
    backgroundColor: '#ef4444',
    width: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Results
  resultsSection: { flex: 1, paddingHorizontal: 16 },
  noResults: { color: COLORS.cream.dark, textAlign: 'center', marginTop: 40 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  userBadges: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  badge: {
    backgroundColor: '#ffffff20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, color: COLORS.cream.pure, fontWeight: '600' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionModal: {
    backgroundColor: '#2d1f1f',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 350,
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  actionsScroll: { maxHeight: 300 },
  actionButton: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

  // Input Modal
  inputModal: {
    backgroundColor: '#2d1f1f',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  inputModalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  inputModalSub: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 6 },
  input: {
    backgroundColor: '#1a0a0a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.cream.pure,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#fff', fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
});
