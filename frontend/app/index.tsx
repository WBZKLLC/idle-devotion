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

export default function HomeScreen() {
  const { user, initUser, login, claimIdleRewards, isLoading } = useGameStore();
  const [username, setUsername] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [idleRewards, setIdleRewards] = useState<any>(null);

  useEffect(() => {
    checkExistingUser();
  }, []);

  useEffect(() => {
    if (user) {
      handleLogin();
    }
  }, [user?.username]);

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
          'Login Rewards! 🎁',
          `Day ${loginReward.day_count}\n\n` +
          `Coins: +${loginReward.coins}\n` +
          `Gold: +${loginReward.gold}\n` +
          (loginReward.gems > 0 ? `Gems: +${loginReward.gems}\n` : '') +
          (loginReward.free_summons > 0 ? `Free Summons: +${loginReward.free_summons}` : '')
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <Text style={styles.title}>Divine Heroes</Text>
          <Text style={styles.subtitle}>Gacha RPG</Text>
          
          <View style={styles.loginBox}>
            <Text style={styles.label}>Enter Your Name</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#666"
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
                <Text style={styles.buttonText}>Start Adventure</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome, {user.username}</Text>
          <View style={styles.dayBadge}>
            <Ionicons name="calendar" size={16} color="#FFD700" />
            <Text style={styles.dayText}>Day {user.login_days}</Text>
          </View>
        </View>

        {/* Currency Display */}
        <View style={styles.currencyContainer}>
          <View style={styles.currencyCard}>
            <Ionicons name="diamond" size={24} color="#FF6B9D" />
            <View style={styles.currencyInfo}>
              <Text style={styles.currencyLabel}>Gems</Text>
              <Text style={styles.currencyValue}>{user.gems}</Text>
            </View>
          </View>

          <View style={styles.currencyCard}>
            <Ionicons name="cash" size={24} color="#FFD700" />
            <View style={styles.currencyInfo}>
              <Text style={styles.currencyLabel}>Coins</Text>
              <Text style={styles.currencyValue}>{user.coins}</Text>
            </View>
          </View>

          <View style={styles.currencyCard}>
            <Ionicons name="star" size={24} color="#FFA500" />
            <View style={styles.currencyInfo}>
              <Text style={styles.currencyLabel}>Gold</Text>
              <Text style={styles.currencyValue}>{user.gold}</Text>
            </View>
          </View>
        </View>

        {/* Idle Rewards */}
        {idleRewards && idleRewards.gold_earned > 0 && (
          <View style={styles.rewardCard}>
            <Ionicons name="time" size={32} color="#4CAF50" />
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardTitle}>Idle Rewards Claimed!</Text>
              <Text style={styles.rewardText}>
                +{idleRewards.gold_earned} Gold ({Math.floor(idleRewards.time_away / 60)} min away)
              </Text>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Pulls</Text>
            <Text style={styles.statValue}>{user.total_pulls}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Pity Counter</Text>
            <View style={styles.pityContainer}>
              <Text style={styles.statValue}>{user.pity_counter}/50</Text>
              <View style={styles.pityBar}>
                <View
                  style={[
                    styles.pityFill,
                    { width: `${(user.pity_counter / 50) * 100}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Daily Summons</Text>
            <Text style={styles.statValue}>{user.daily_summons_claimed}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="gift" size={32} color="#FF6B9D" />
            <Text style={styles.actionText}>Gacha</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="people" size={32} color="#4CAF50" />
            <Text style={styles.actionText}>Heroes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="shield" size={32} color="#2196F3" />
            <Text style={styles.actionText}>Team</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f1e',
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
    color: '#FF6B9D',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 48,
    textAlign: 'center',
  },
  loginBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#FF6B9D',
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f0f1e',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#FF6B9D',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  dayText: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  currencyContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  currencyCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyLabel: {
    fontSize: 12,
    color: '#999',
  },
  currencyValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  rewardCard: {
    backgroundColor: '#1a3a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  rewardText: {
    fontSize: 14,
    color: '#8BC34A',
  },
  statsContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  pityContainer: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 16,
  },
  pityBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  pityFill: {
    height: '100%',
    backgroundColor: '#FF6B9D',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
