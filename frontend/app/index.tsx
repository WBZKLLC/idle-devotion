import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Sidebar from '../components/Sidebar';

export default function HomeScreen() {
  const { user, initUser, login, claimIdleRewards, isLoading, fetchCR } = useGameStore();
  const [username, setUsername] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [idleRewards, setIdleRewards] = useState<any>(null);
  const [cr, setCR] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    checkExistingUser();
  }, []);

  useEffect(() => {
    if (user) {
      handleLogin();
      loadCR();
    }
  }, [user?.username]);

  const loadCR = async () => {
    try {
      const crData = await fetchCR();
      setCR(crData.cr);
    } catch (error) {
      console.error('Failed to load CR:', error);
    }
  };

  const checkExistingUser = async () => {
    try {
      const savedUsername = await AsyncStorage.getItem('username');
      if (savedUsername) {
        await initUser(savedUsername);
      }
    } catch (error) {
      console.error('Error checking existing user:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLogin = async () => {
    try {
      const loginReward = await login();
      const rewards = await claimIdleRewards();
      setIdleRewards(rewards);
      
      if (loginReward.free_summons > 0 || loginReward.gems > 0) {
        Alert.alert(
          '🎁 Login Rewards',
          `Day ${loginReward.day_count}\n\n` +
          `💰 Coins: +${loginReward.coins}\n` +
          `⭐ Gold: +${loginReward.gold}\n` +
          (loginReward.gems > 0 ? `💎 Gems: +${loginReward.gems}\n` : '') +
          (loginReward.free_summons > 0 ? `🎫 Free Summons: +${loginReward.free_summons}` : '')
        );
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleInitUser = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    
    try {
      await initUser(username.trim());
    } catch (error) {
      Alert.alert('Error', 'Failed to create user');
    }
  };

  if (isInitializing) {
    return (
      <LinearGradient colors={['#FF1493', '#9400D3', '#4B0082']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFF" />
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={['#FF1493', '#9400D3', '#4B0082']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.loginContainer}>
            <Text style={styles.title}>✨ Divine Heroes ✨</Text>
            <Text style={styles.subtitle}>Gacha RPG</Text>
            
            <View style={styles.loginBox}>
              <Text style={styles.label}>Enter Your Name</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
              
              <TouchableOpacity
                style={styles.button}
                onPress={handleInitUser}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>⚔️ Start Adventure</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFB6C1', '#FF69B4', '#FF1493']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Sidebar Button */}
        <TouchableOpacity
          style={styles.sidebarButton}
          onPress={() => setSidebarVisible(true)}
        >
          <LinearGradient
            colors={['#9400D3', '#4B0082']}
            style={styles.sidebarButtonGradient}
          >
            <Ionicons name=\"menu\" size={28} color=\"#FFF\" />
          </LinearGradient>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Header with CR */}
          <LinearGradient
            colors={['#FF6347', '#FF1493', '#8B008B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.welcomeText}>Welcome, {user.username}!</Text>
                <View style={styles.dayBadge}>
                  <Ionicons name="calendar" size={16} color="#FFD700" />
                  <Text style={styles.dayText}>Day {user.login_days}</Text>
                </View>
              </View>
              <View style={styles.crBadge}>
                <Text style={styles.crLabel}>CR</Text>
                <Text style={styles.crValue}>{cr.toLocaleString()}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Currency Display */}
          <View style={styles.currencyContainer}>
            <LinearGradient
              colors={['#FF1493', '#FF69B4']}
              style={styles.currencyCard}
            >
              <Ionicons name="diamond" size={32} color="#FFF" />
              <View style={styles.currencyInfo}>
                <Text style={styles.currencyLabel}>Gems</Text>
                <Text style={styles.currencyValue}>{user.gems}</Text>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.currencyCard}
            >
              <Ionicons name="cash" size={32} color="#FFF" />
              <View style={styles.currencyInfo}>
                <Text style={styles.currencyLabel}>Coins</Text>
                <Text style={styles.currencyValue}>{user.coins}</Text>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={['#32CD32', '#00CED1']}
              style={styles.currencyCard}
            >
              <Ionicons name="star" size={32} color="#FFF" />
              <View style={styles.currencyInfo}>
                <Text style={styles.currencyLabel}>Gold</Text>
                <Text style={styles.currencyValue}>{user.gold}</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Idle Rewards */}
          {idleRewards && idleRewards.gold_earned > 0 && (
            <LinearGradient
              colors={['#32CD32', '#00CED1']}
              style={styles.rewardCard}
            >
              <Ionicons name="time" size={32} color="#FFF" />
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardTitle}>⚡ Idle Rewards!</Text>
                <Text style={styles.rewardText}>
                  +{idleRewards.gold_earned} Gold ({Math.floor(idleRewards.time_away / 60)} min)
                </Text>
              </View>
            </LinearGradient>
          )}

          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButtonWrapper}
              onPress={() => router.push('/story')}
            >
              <LinearGradient
                colors={['#9370DB', '#8B008B']}
                style={styles.actionButton}
              >
                <Ionicons name="map" size={40} color="#FFF" />
                <Text style={styles.actionText}>Story Mode</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButtonWrapper}
              onPress={() => router.push('/summon-hub')}
            >
              <LinearGradient
                colors={['#FF1493', '#FF69B4']}
                style={styles.actionButton}
              >
                <Ionicons name="gift" size={40} color="#FFF" />
                <Text style={styles.actionText}>Summon</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>⚔️ Your Progress</Text>
            
            <LinearGradient
              colors={['#FFFFFF', '#F0F8FF']}
              style={styles.statsCard}
            >
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Pulls</Text>
                <Text style={styles.statValue}>{user.total_pulls}</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pity Counter</Text>
                <View style={styles.pityContainer}>
                  <Text style={styles.statValue}>{user.pity_counter}/50</Text>
                  <View style={styles.pityBar}>
                    <LinearGradient
                      colors={['#FF1493', '#9400D3']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.pityFill,
                        { width: `${(user.pity_counter / 50) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>

        {/* Sidebar Component */}
        <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 24,
    color: '#FFF',
    marginBottom: 48,
    textAlign: 'center',
  },
  loginBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    color: '#333',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FF1493',
  },
  button: {
    backgroundColor: '#FF1493',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#FF1493',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  dayText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
  },
  crBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  crLabel: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  crValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  currencyContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  currencyCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyLabel: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  currencyValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  rewardCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  rewardText: {
    fontSize: 14,
    color: '#FFF',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButtonWrapper: {
    flex: 1,
  },
  actionButton: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  statsCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  pityContainer: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 16,
  },
  pityBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  pityFill: {
    height: '100%',
  },
});
