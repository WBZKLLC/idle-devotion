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
  TextInput,
  Modal,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

export default function GuildScreen() {
  const { user, fetchUser } = useGameStore();
  const [guildData, setGuildData] = useState<any>(null);
  const [availableGuilds, setAvailableGuilds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [guildName, setGuildName] = useState('');
  const [guildDescription, setGuildDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadGuildData();
    }
  }, [user]);

  const loadGuildData = async () => {
    setIsLoading(true);
    try {
      // Check if user is in a guild
      const guildResponse = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/guild/${user?.username}`
      );
      
      if (guildResponse.ok) {
        const data = await guildResponse.json();
        if (data && data.id) {
          setGuildData(data);
        } else {
          setGuildData(null);
          loadAvailableGuilds();
        }
      } else {
        setGuildData(null);
        loadAvailableGuilds();
      }
    } catch (error) {
      console.error('Failed to load guild:', error);
      loadAvailableGuilds();
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
        setAvailableGuilds(data || []);
      }
    } catch (error) {
      console.error('Failed to load guilds:', error);
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
      'Are you sure you want to leave this guild?',
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
                Alert.alert('Left Guild', 'You have left the guild');
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'leader': return COLORS.gold.primary;
      case 'officer': return COLORS.rarity.UR;
      default: return COLORS.cream.soft;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'leader': return 'star';
      case 'officer': return 'shield';
      default: return 'person';
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

  // Guild Member View
  if (guildData) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            {/* Guild Header */}
            <LinearGradient
              colors={[COLORS.gold.primary, COLORS.gold.dark]}
              style={styles.guildHeader}
            >
              <View style={styles.guildIcon}>
                <Ionicons name="shield" size={40} color={COLORS.navy.darkest} />
              </View>
              <Text style={styles.guildName}>{guildData.name}</Text>
              <Text style={styles.guildDesc}>{guildData.description}</Text>
              <View style={styles.guildStats}>
                <View style={styles.guildStat}>
                  <Text style={styles.guildStatValue}>{guildData.member_count || 0}</Text>
                  <Text style={styles.guildStatLabel}>Members</Text>
                </View>
                <View style={styles.guildStatDivider} />
                <View style={styles.guildStat}>
                  <Text style={styles.guildStatValue}>{guildData.level || 1}</Text>
                  <Text style={styles.guildStatLabel}>Level</Text>
                </View>
                <View style={styles.guildStatDivider} />
                <View style={styles.guildStat}>
                  <Text style={styles.guildStatValue}>{guildData.total_power?.toLocaleString() || 0}</Text>
                  <Text style={styles.guildStatLabel}>Power</Text>
                </View>
              </View>
            </LinearGradient>
            
            {/* Guild Features */}
            <View style={styles.featuresGrid}>
              <TouchableOpacity style={styles.featureCard}>
                <LinearGradient colors={[COLORS.rarity.SSR, COLORS.rarity.UR]} style={styles.featureGradient}>
                  <Ionicons name="skull" size={28} color={COLORS.cream.pure} />
                  <Text style={styles.featureTitle}>Guild Boss</Text>
                  <Text style={styles.featureDesc}>Coming Soon</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.featureCard}>
                <LinearGradient colors={[COLORS.success, '#0d5c2e']} style={styles.featureGradient}>
                  <Ionicons name="gift" size={28} color={COLORS.cream.pure} />
                  <Text style={styles.featureTitle}>Donations</Text>
                  <Text style={styles.featureDesc}>Coming Soon</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.featureCard}>
                <LinearGradient colors={[COLORS.rarity.UR, COLORS.rarity['UR+']]} style={styles.featureGradient}>
                  <Ionicons name="trophy" size={28} color={COLORS.cream.pure} />
                  <Text style={styles.featureTitle}>Guild Wars</Text>
                  <Text style={styles.featureDesc}>Coming Soon</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.featureCard}>
                <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.featureGradient}>
                  <Ionicons name="cart" size={28} color={COLORS.navy.darkest} />
                  <Text style={[styles.featureTitle, { color: COLORS.navy.darkest }]}>Shop</Text>
                  <Text style={[styles.featureDesc, { color: COLORS.navy.dark }]}>Coming Soon</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Members List */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Members</Text>
              {guildData.members?.map((member: any, index: number) => (
                <View key={member.user_id || index} style={styles.memberCard}>
                  <View style={[styles.memberAvatar, { borderColor: getRoleColor(member.role) }]}>
                    <Ionicons name={getRoleIcon(member.role) as any} size={20} color={getRoleColor(member.role)} />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.username}</Text>
                    <Text style={[styles.memberRole, { color: getRoleColor(member.role) }]}>
                      {member.role?.charAt(0).toUpperCase() + member.role?.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.memberPower}>
                    <Text style={styles.memberPowerValue}>{member.power?.toLocaleString() || 0}</Text>
                    <Text style={styles.memberPowerLabel}>Power</Text>
                  </View>
                </View>
              ))}
            </View>
            
            {/* Leave Button */}
            <TouchableOpacity style={styles.leaveButton} onPress={leaveGuild}>
              <Text style={styles.leaveButtonText}>Leave Guild</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // No Guild View
  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Guild</Text>
          <Text style={styles.subtitle}>Join or create a guild to unlock exclusive features!</Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.gold.primary} style={styles.loader} />
          ) : (
            <>
              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowCreateModal(true)}
                >
                  <LinearGradient
                    colors={[COLORS.gold.primary, COLORS.gold.dark]}
                    style={styles.actionGradient}
                  >
                    <Ionicons name="add-circle" size={28} color={COLORS.navy.darkest} />
                    <Text style={styles.actionTitle}>Create Guild</Text>
                    <Text style={styles.actionDesc}>Start your own guild</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowJoinModal(true)}
                >
                  <LinearGradient
                    colors={[COLORS.rarity.UR, COLORS.rarity['UR+']]}
                    style={styles.actionGradient}
                  >
                    <Ionicons name="search" size={28} color={COLORS.cream.pure} />
                    <Text style={[styles.actionTitle, { color: COLORS.cream.pure }]}>Find Guild</Text>
                    <Text style={[styles.actionDesc, { color: COLORS.cream.soft }]}>Browse available guilds</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              {/* Benefits */}
              <View style={styles.benefitsSection}>
                <Text style={styles.benefitsTitle}>Guild Benefits</Text>
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <Ionicons name="people" size={24} color={COLORS.gold.primary} />
                    <Text style={styles.benefitText}>Team up with other players</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="skull" size={24} color={COLORS.rarity.UR} />
                    <Text style={styles.benefitText}>Fight powerful Guild Bosses</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="gift" size={24} color={COLORS.success} />
                    <Text style={styles.benefitText}>Donate and request items</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="trophy" size={24} color={COLORS.gold.light} />
                    <Text style={styles.benefitText}>Compete in Guild Wars</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="cart" size={24} color={COLORS.rarity['UR+']} />
                    <Text style={styles.benefitText}>Access exclusive Guild Shop</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
        
        {/* Create Guild Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.cream.pure} />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Create Guild</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Guild Name"
                placeholderTextColor={COLORS.navy.light}
                value={guildName}
                onChangeText={setGuildName}
                maxLength={20}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Guild Description (optional)"
                placeholderTextColor={COLORS.navy.light}
                value={guildDescription}
                onChangeText={setGuildDescription}
                multiline
                numberOfLines={3}
                maxLength={100}
              />
              
              <View style={styles.costInfo}>
                <Ionicons name="cash" size={20} color={COLORS.gold.light} />
                <Text style={styles.costText}>Cost: 10,000 Gold</Text>
              </View>
              
              <TouchableOpacity
                style={styles.createButton}
                onPress={createGuild}
                disabled={isCreating}
              >
                <LinearGradient
                  colors={[COLORS.gold.primary, COLORS.gold.dark]}
                  style={styles.createGradient}
                >
                  {isCreating ? (
                    <ActivityIndicator color={COLORS.navy.darkest} />
                  ) : (
                    <Text style={styles.createButtonText}>Create Guild</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        
        {/* Join Guild Modal */}
        <Modal
          visible={showJoinModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowJoinModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowJoinModal(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.cream.pure} />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Find Guild</Text>
              
              <ScrollView style={styles.guildsList}>
                {availableGuilds.length === 0 ? (
                  <View style={styles.noGuilds}>
                    <Ionicons name="search" size={48} color={COLORS.navy.light} />
                    <Text style={styles.noGuildsText}>No guilds available</Text>
                    <Text style={styles.noGuildsSubtext}>Be the first to create one!</Text>
                  </View>
                ) : (
                  availableGuilds.map((guild) => (
                    <TouchableOpacity
                      key={guild.id}
                      style={styles.guildListItem}
                      onPress={() => joinGuild(guild.id)}
                    >
                      <View style={styles.guildListIcon}>
                        <Ionicons name="shield" size={24} color={COLORS.gold.primary} />
                      </View>
                      <View style={styles.guildListInfo}>
                        <Text style={styles.guildListName}>{guild.name}</Text>
                        <Text style={styles.guildListDesc}>{guild.description}</Text>
                        <Text style={styles.guildListMembers}>
                          {guild.member_count || 0} members • Level {guild.level || 1}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.cream.dark} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
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
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.cream.dark, textAlign: 'center', marginBottom: 24 },
  loader: { marginTop: 40 },
  guildHeader: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  guildIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.navy.darkest + '40', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  guildName: { fontSize: 28, fontWeight: 'bold', color: COLORS.navy.darkest, marginBottom: 4 },
  guildDesc: { fontSize: 14, color: COLORS.navy.dark, textAlign: 'center', marginBottom: 16 },
  guildStats: { flexDirection: 'row', alignItems: 'center' },
  guildStat: { alignItems: 'center', paddingHorizontal: 20 },
  guildStatValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.navy.darkest },
  guildStatLabel: { fontSize: 12, color: COLORS.navy.dark },
  guildStatDivider: { width: 1, height: 30, backgroundColor: COLORS.navy.darkest + '40' },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  featureCard: { width: '48%', marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  featureGradient: { padding: 16, alignItems: 'center', minHeight: 100 },
  featureTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 8 },
  featureDesc: { fontSize: 11, color: COLORS.cream.soft },
  membersSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.light, marginBottom: 12 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy.dark },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  memberRole: { fontSize: 12 },
  memberPower: { alignItems: 'flex-end' },
  memberPowerValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary },
  memberPowerLabel: { fontSize: 10, color: COLORS.cream.dark },
  leaveButton: { backgroundColor: COLORS.error, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  leaveButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionButton: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionGradient: { padding: 20, alignItems: 'center' },
  actionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest, marginTop: 8 },
  actionDesc: { fontSize: 12, color: COLORS.navy.dark },
  benefitsSection: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  benefitsTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 16, textAlign: 'center' },
  benefitsList: { gap: 12 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, color: COLORS.cream.soft },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.navy.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingTop: 40, maxHeight: '80%' },
  closeButton: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.cream.pure, marginBottom: 12, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  textArea: { height: 80, textAlignVertical: 'top' },
  costInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  costText: { fontSize: 14, color: COLORS.gold.light },
  createButton: { borderRadius: 12, overflow: 'hidden' },
  createGradient: { padding: 16, alignItems: 'center' },
  createButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  guildsList: { maxHeight: 400 },
  noGuilds: { alignItems: 'center', paddingVertical: 40 },
  noGuildsText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 12 },
  noGuildsSubtext: { fontSize: 14, color: COLORS.cream.dark, marginTop: 4 },
  guildListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  guildListIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.gold.dark + '30', alignItems: 'center', justifyContent: 'center' },
  guildListInfo: { flex: 1, marginLeft: 12 },
  guildListName: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure },
  guildListDesc: { fontSize: 12, color: COLORS.cream.soft, marginTop: 2 },
  guildListMembers: { fontSize: 11, color: COLORS.cream.dark, marginTop: 4 },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
