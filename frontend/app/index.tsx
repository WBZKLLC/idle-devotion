import React, { useEffect, useState, useRef } from 'react';
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
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Sidebar from '../components/Sidebar';

// Regal Color Palette
const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845', light: '#3d5a80' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666', pale: '#f5e6c4' },
  cream: { pure: '#ffffff', light: '#fefefe', soft: '#f8f6f0', warm: '#f5f0e6', dark: '#e8e0d0' },
};

export default function HomeScreen() {
  const { user, initUser, login, claimIdleRewards, isLoading, fetchCR, fetchUser } = useGameStore();
  const hydrated = useHydration();
  const [username, setUsername] = useState('');
  const [idleStatus, setIdleStatus] = useState<any>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [cr, setCR] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      handleLogin();
      loadCR();
      loadIdleStatus();
      timerRef.current = setInterval(() => updateIdleTimer(), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [user?.username]);

  const loadIdleStatus = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/idle/status/${user?.username}`);
      setIdleStatus(await response.json());
    } catch (error) { console.error('Failed to load idle status:', error); }
  };

  const updateIdleTimer = () => {
    setIdleStatus((prev: any) => {
      if (!prev) return prev;
      const newTimeElapsed = prev.time_elapsed + 1;
      const maxSeconds = prev.max_hours * 3600;
      return { ...prev, time_elapsed: newTimeElapsed, gold_pending: Math.floor(Math.min(newTimeElapsed, maxSeconds) / 60) * 10, is_capped: newTimeElapsed >= maxSeconds };
    });
  };

  const formatIdleTime = (seconds: number, maxHours: number) => {
    const cappedSeconds = Math.min(seconds, maxHours * 3600);
    const hours = Math.floor(cappedSeconds / 3600);
    const minutes = Math.floor((cappedSeconds % 3600) / 60);
    const secs = Math.floor(cappedSeconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClaimIdle = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    try {
      const rewards = await claimIdleRewards();
      if (rewards.gold_earned > 0) {
        Alert.alert('Rewards Collected', `+${rewards.gold_earned.toLocaleString()} Gold`, [{ text: 'Continue' }]);
      }
      // Reload idle status to reset timer
      loadIdleStatus();
    } catch (error) {
      console.error('Failed to claim idle rewards:', error);
      Alert.alert('Error', 'Failed to claim rewards');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleLogin = async () => {
    try {
      const loginReward = await login();
      if (loginReward.free_summons > 0 || loginReward.gems > 0) {
        Alert.alert('Welcome Back', `Day ${loginReward.day_count}\n+${loginReward.coins} Coins\n+${loginReward.gold} Gold${loginReward.gems > 0 ? `\n+${loginReward.gems} Crystals` : ''}${loginReward.free_summons > 0 ? `\n+${loginReward.free_summons} Free Summons` : ''}`);
      }
    } catch (error) { console.error('Login error:', error); }
  };

  const loadCR = async () => {
    try {
      const crData = await fetchCR();
      setCR(crData?.cr || 0);
    } catch (error) { console.error('CR error:', error); }
  };

  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { registerUser, loginWithPassword, setPasswordForLegacyAccount, needsPassword } = useGameStore();

  const handleStartGame = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { 
      Alert.alert('Enter Username', 'Please enter a username to begin'); 
      return; 
    }
    if (!password) {
      Alert.alert('Enter Password', 'Please enter a password to secure your account');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters');
      return;
    }
    
    setAuthError('');
    
    if (isRegistering) {
      // Registration flow
      if (password !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match');
        return;
      }
      
      const result = await registerUser(trimmedUsername, password);
      if (!result.success) {
        setAuthError(result.error || 'Registration failed');
      }
    } else {
      // Login flow
      const result = await loginWithPassword(trimmedUsername, password);
      if (!result.success) {
        if (result.error === 'NEEDS_PASSWORD') {
          // Legacy account - prompt to set password
          Alert.alert(
            'Account Security Upgrade',
            'This account was created before passwords were required. Please set a password to secure your account.',
            [
              {
                text: 'Set Password',
                onPress: async () => {
                  const setResult = await setPasswordForLegacyAccount(trimmedUsername, password);
                  if (!setResult.success) {
                    setAuthError(setResult.error || 'Failed to set password');
                  } else {
                    Alert.alert('Success', 'Password set successfully! Your account is now secure.');
                  }
                }
              }
            ]
          );
        } else if (result.error?.includes('Invalid username')) {
          // User doesn't exist - offer to register
          Alert.alert(
            'Account Not Found',
            'No account with this username exists. Would you like to create a new account?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Create Account', onPress: () => setIsRegistering(true) }
            ]
          );
        } else {
          setAuthError(result.error || 'Login failed');
        }
      }
    }
  };

  if (!hydrated || isLoading) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark, COLORS.navy.primary]} style={styles.container}>
        <SafeAreaView style={styles.loginContainer}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>DH</Text>
            </View>
            <Text style={styles.gameTitle}>Divine Heroes</Text>
            <Text style={styles.gameSubtitle}>Collect • Battle • Conquer</Text>
          </View>
          <View style={styles.loginCard}>
            <Text style={styles.loginLabel}>{isRegistering ? 'Create Account' : 'Login'}</Text>
            
            {authError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#e74c3c" />
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            ) : null}
            
            <TextInput
              style={styles.loginInput}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={COLORS.navy.light}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={COLORS.navy.light}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={COLORS.navy.light} 
                />
              </TouchableOpacity>
            </View>
            
            {isRegistering && (
              <TextInput
                style={styles.loginInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm Password"
                placeholderTextColor={COLORS.navy.light}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            )}
            
            <TouchableOpacity style={styles.loginButton} onPress={handleStartGame}>
              <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.loginButtonGradient}>
                <Text style={styles.loginButtonText}>
                  {isRegistering ? 'Create Account' : 'Begin Journey'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.switchAuthMode} 
              onPress={() => {
                setIsRegistering(!isRegistering);
                setAuthError('');
                setConfirmPassword('');
              }}
            >
              <Text style={styles.switchAuthText}>
                {isRegistering ? 'Already have an account? Login' : 'New player? Create Account'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.gold.primary} />
              <Text style={styles.securityNoteText}>Your account is protected with a secure password</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.usernameText}>{user.username}</Text>
            </View>
          </View>
          <View style={styles.crBadge}>
            <Text style={styles.crLabel}>CR</Text>
            <Text style={styles.crValue}>{cr.toLocaleString()}</Text>
          </View>
        </View>

        {/* Currency Bar */}
        <View style={styles.currencyBar} key={`currency-${user.gems}-${user.gold}-${user.coins}`}>
          <View style={styles.currencyItem}>
            <Ionicons name="diamond" size={16} color="#9b4dca" />
            <Text style={styles.currencyText}>{(user.gems || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.currencyItem}>
            <Ionicons name="logo-bitcoin" size={16} color={COLORS.gold.primary} />
            <Text style={styles.currencyText}>{(user.gold || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.currencyItem}>
            <Ionicons name="cash" size={16} color={COLORS.gold.light} />
            <Text style={styles.currencyText}>{(user.coins || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.currencyItem}>
            <Ionicons name="star" size={16} color="#f59e0b" />
            <Text style={styles.currencyText}>{(user.divine_essence || 0).toLocaleString()}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Idle Rewards Card */}
          <View style={styles.idleCard}>
            <LinearGradient colors={idleStatus?.is_capped ? [COLORS.gold.primary, COLORS.gold.dark] : [COLORS.navy.medium, COLORS.navy.primary]} style={styles.idleGradient}>
              <View style={styles.idleHeader}>
                <Ionicons name="time" size={24} color={COLORS.gold.light} />
                <Text style={styles.idleTitle}>Idle Rewards</Text>
              </View>
              <View style={styles.idleTimerBox}>
                <Text style={styles.idleTimerLabel}>Time Elapsed</Text>
                <Text style={styles.idleTimer}>{idleStatus ? formatIdleTime(idleStatus.time_elapsed || 0, idleStatus.max_hours || 8) : '00:00:00'}</Text>
                <Text style={styles.idleCapText}>Max: {idleStatus?.max_hours || 8}h {idleStatus?.is_capped ? '• FULL' : ''}</Text>
              </View>
              <View style={styles.idlePendingRow}>
                <Ionicons name="star" size={18} color={COLORS.gold.primary} />
                <Text style={styles.idlePendingText}>+{idleStatus?.gold_pending || 0} Gold Pending</Text>
              </View>
              <TouchableOpacity style={styles.claimButton} onPress={handleClaimIdle} disabled={isClaiming}>
                <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.claimButtonGradient}>
                  {isClaiming ? <ActivityIndicator color={COLORS.navy.dark} size="small" /> : <><Ionicons name="download" size={18} color={COLORS.navy.dark} /><Text style={styles.claimButtonText}>Collect</Text></>}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Quick Links */}
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/hero-manager')}>
              <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.quickLinkGradient}>
                <Ionicons name="people" size={22} color={COLORS.navy.darkest} />
                <Text style={[styles.quickLinkText, { color: COLORS.navy.darkest }]}>Teams</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/heroes')}>
              <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.quickLinkGradient}>
                <Ionicons name="star" size={22} color={COLORS.gold.light} />
                <Text style={styles.quickLinkText}>Heroes</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/login-rewards')}>
              <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.quickLinkGradient}>
                <Ionicons name="calendar" size={22} color={COLORS.gold.light} />
                <Text style={styles.quickLinkText}>Rewards</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* More Quick Links */}
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/guild')}>
              <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.quickLinkGradient}>
                <Ionicons name="shield" size={22} color={COLORS.gold.light} />
                <Text style={styles.quickLinkText}>Guild</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/equipment')}>
              <LinearGradient colors={['#8b5cf6', '#6d28d9']} style={styles.quickLinkGradient}>
                <Ionicons name="hammer" size={22} color={COLORS.cream.pure} />
                <Text style={[styles.quickLinkText, { color: COLORS.cream.pure }]}>Gear</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/store')}>
              <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.quickLinkGradient}>
                <Ionicons name="cart" size={22} color={COLORS.gold.light} />
                <Text style={styles.quickLinkText}>Store</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* FEATURED: Launch Banner & Journey */}
          <View style={styles.quickLinks}>
            <TouchableOpacity style={[styles.quickLink, { flex: 2 }]} onPress={() => router.push('/selene-banner')}>
              <LinearGradient colors={['#6366f1', '#4338ca', '#1e1b4b']} style={[styles.quickLinkGradient, { paddingVertical: 20 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>⏳</Text>
                  <View>
                    <Text style={[styles.quickLinkText, { color: '#a5b4fc', fontSize: 14, fontWeight: 'bold' }]}>FATED CHRONOLOGY</Text>
                    <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>7 DAYS ONLY!</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/journey')}>
              <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.quickLinkGradient}>
                <Ionicons name="map" size={22} color={COLORS.cream.pure} />
                <Text style={[styles.quickLinkText, { color: COLORS.cream.pure }]}>Journey</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Second Featured Row - Aethon & Launch */}
          <View style={styles.quickLinks}>
            <TouchableOpacity style={[styles.quickLink, { flex: 1 }]} onPress={() => router.push('/launch-banner')}>
              <LinearGradient colors={['#7c3aed', '#5b21b6']} style={styles.quickLinkGradient}>
                <Text style={{ fontSize: 16 }}>✨</Text>
                <Text style={[styles.quickLinkText, { color: COLORS.gold.light, fontSize: 11 }]}>Aethon 72H</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/dungeons')}>
              <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.quickLinkGradient}>
                <Ionicons name="flash" size={22} color={COLORS.cream.pure} />
                <Text style={[styles.quickLinkText, { color: COLORS.cream.pure }]}>Dungeons</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/battle-pass')}>
              <LinearGradient colors={['#9b59b6', '#8e44ad']} style={styles.quickLinkGradient}>
                <Ionicons name="trophy" size={22} color={COLORS.cream.pure} />
                <Text style={[styles.quickLinkText, { color: COLORS.cream.pure }]}>Pass</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Campaign - Featured Row */}
          <View style={styles.quickLinks}>
            <TouchableOpacity style={[styles.quickLink, { flex: 2 }]} onPress={() => router.push('/campaign')}>
              <LinearGradient colors={['#1e40af', '#1e3a8a', '#172554']} style={[styles.quickLinkGradient, { paddingVertical: 18 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>📖</Text>
                  <View>
                    <Text style={[styles.quickLinkText, { color: '#93c5fd', fontSize: 14, fontWeight: 'bold' }]}>STORY CAMPAIGN</Text>
                    <Text style={{ color: '#60a5fa', fontSize: 10 }}>12 Chapters • Epic Adventure</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/abyss')}>
              <LinearGradient colors={['#1a202c', '#0d0d12']} style={styles.quickLinkGradient}>
                <Ionicons name="chevron-down-circle" size={22} color="#48bb78" />
                <Text style={[styles.quickLinkText, { color: '#48bb78' }]}>Abyss</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Third Row - More Options */}
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/guild-war')}>
              <LinearGradient colors={['#dc2626', '#7f1d1d']} style={styles.quickLinkGradient}>
                <Ionicons name="flame" size={22} color={COLORS.cream.pure} />
                <Text style={[styles.quickLinkText, { color: COLORS.cream.pure }]}>War</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/chat')}>
              <LinearGradient colors={['#0891b2', '#0e7490']} style={styles.quickLinkGradient}>
                <Ionicons name="chatbubbles" size={22} color={COLORS.cream.pure} />
                <Text style={[styles.quickLinkText, { color: COLORS.cream.pure }]}>Chat</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/leaderboard')}>
              <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.quickLinkGradient}>
                <Ionicons name="podium" size={22} color={COLORS.gold.light} />
                <Text style={styles.quickLinkText}>Ranks</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => setSidebarVisible(true)}>
              <LinearGradient colors={[COLORS.navy.medium, COLORS.navy.primary]} style={styles.quickLinkGradient}>
                <Ionicons name="menu" size={22} color={COLORS.gold.light} />
                <Text style={styles.quickLinkText}>More</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Pity Progress */}
          <View style={styles.pitySection}>
            <Text style={styles.sectionTitle}>Summon Progress</Text>
            <View style={styles.pityCard}>
              <View style={styles.pityRow}>
                <View style={styles.pityInfo}>
                  <Text style={styles.pityLabel}>Common</Text>
                  <Text style={styles.pityValue}>{user.pity_counter || 0}/50</Text>
                </View>
                <View style={styles.pityBarOuter}>
                  <View style={[styles.pityBarFill, { width: `${((user.pity_counter || 0) / 50) * 100}%`, backgroundColor: COLORS.gold.light }]} />
                </View>
              </View>
              <View style={styles.pityRow}>
                <View style={styles.pityInfo}>
                  <Text style={styles.pityLabel}>Premium</Text>
                  <Text style={styles.pityValue}>{user.pity_counter_premium || 0}/50</Text>
                </View>
                <View style={styles.pityBarOuter}>
                  <View style={[styles.pityBarFill, { width: `${((user.pity_counter_premium || 0) / 50) * 100}%`, backgroundColor: '#9b4dca' }]} />
                </View>
              </View>
              <View style={styles.pityRow}>
                <View style={styles.pityInfo}>
                  <Text style={styles.pityLabel}>Divine</Text>
                  <Text style={styles.pityValue}>{user.pity_counter_divine || 0}/40</Text>
                </View>
                <View style={styles.pityBarOuter}>
                  <View style={[styles.pityBarFill, { width: `${((user.pity_counter_divine || 0) / 40) * 100}%`, backgroundColor: COLORS.gold.primary }]} />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} user={user} cr={cr} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16, fontWeight: '500' },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.navy.medium, borderWidth: 3, borderColor: COLORS.gold.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { fontSize: 36, fontWeight: 'bold', color: COLORS.gold.primary },
  gameTitle: { fontSize: 36, fontWeight: 'bold', color: COLORS.cream.pure, letterSpacing: 2 },
  gameSubtitle: { fontSize: 14, color: COLORS.gold.light, marginTop: 8, letterSpacing: 4, textTransform: 'uppercase' },
  loginCard: { backgroundColor: COLORS.navy.medium, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  loginLabel: { color: COLORS.cream.soft, fontSize: 18, marginBottom: 16, fontWeight: '600', textAlign: 'center' },
  loginInput: { backgroundColor: COLORS.navy.dark, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.cream.pure, borderWidth: 1, borderColor: COLORS.navy.light + '40', marginBottom: 12 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.dark, borderRadius: 12, borderWidth: 1, borderColor: COLORS.navy.light + '40', marginBottom: 12 },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: COLORS.cream.pure },
  eyeButton: { padding: 12 },
  loginButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  loginButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  loginButtonText: { color: COLORS.navy.darkest, fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  switchAuthMode: { marginTop: 16, alignItems: 'center' },
  switchAuthText: { color: COLORS.gold.light, fontSize: 14 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e74c3c20', padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 },
  errorText: { color: '#e74c3c', fontSize: 13, flex: 1 },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  securityNoteText: { color: COLORS.cream.dark, fontSize: 11 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.navy.medium, borderWidth: 2, borderColor: COLORS.gold.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  welcomeText: { fontSize: 12, color: COLORS.cream.dark },
  usernameText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  crBadge: { backgroundColor: COLORS.navy.medium, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.gold.dark + '60', alignItems: 'center' },
  crLabel: { fontSize: 10, color: COLORS.gold.light, fontWeight: '600' },
  crValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold.primary },
  currencyBar: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingBottom: 12 },
  currencyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium + '80', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, borderWidth: 1, borderColor: COLORS.navy.light + '30' },
  currencyText: { color: COLORS.cream.soft, fontWeight: '600', fontSize: 14 },
  content: { padding: 16, paddingBottom: 100 },
  idleCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  idleGradient: { padding: 20 },
  idleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  idleTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  idleTimerBox: { backgroundColor: COLORS.navy.darkest + '60', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  idleTimerLabel: { fontSize: 12, color: COLORS.cream.dark, marginBottom: 4 },
  idleTimer: { fontSize: 40, fontWeight: 'bold', color: COLORS.cream.pure, fontFamily: 'monospace' },
  idleCapText: { fontSize: 12, color: COLORS.gold.light, marginTop: 4 },
  idlePendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  idlePendingText: { fontSize: 16, color: COLORS.gold.light, fontWeight: '600' },
  claimButton: { borderRadius: 12, overflow: 'hidden' },
  claimButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  claimButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy.darkest },
  quickLinks: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickLink: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  quickLinkGradient: { paddingVertical: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  quickLinkText: { color: COLORS.cream.soft, fontSize: 12, fontWeight: '600' },
  pitySection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 12 },
  pityCard: { backgroundColor: COLORS.navy.medium, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  pityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pityInfo: { width: 80 },
  pityLabel: { fontSize: 12, color: COLORS.cream.dark },
  pityValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.pure },
  pityBarOuter: { flex: 1, height: 8, backgroundColor: COLORS.navy.dark, borderRadius: 4, overflow: 'hidden', marginLeft: 12 },
  pityBarFill: { height: '100%', borderRadius: 4 },
});
