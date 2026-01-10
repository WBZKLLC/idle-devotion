import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Sidebar from '../components/Sidebar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Raphael the Eternal - 5+ Star (6-star) Skin
const RAPHAEL_5PLUS_IMAGE = 'https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/b7izvrr1_3b23ca9d-fc3b-4d22-a99f-0dddae4c4d89_1.webp';

// Regal Color Palette - Enhanced for celestial theme
const COLORS = {
  navy: { darkest: '#050a14', dark: '#0a1222', primary: '#0f1a2e', medium: '#1a2740', light: '#2d4263' },
  gold: { darkest: '#8b7355', dark: '#b8860b', primary: '#c9a227', medium: '#d4af37', light: '#e6c666', pale: '#f5e6c4' },
  cream: { pure: '#ffffff', light: '#fefefe', soft: '#f8f6f0', warm: '#f5f0e6', dark: '#e8e0d0' },
  violet: { dark: '#2d1b4e', primary: '#5b3d8a', light: '#8b6bb8', glow: '#a78bfa' },
  celestial: { deep: '#0d0a1a', mid: '#1a1330', accent: '#3b2d5f' },
};

export default function HomeScreen() {
  const { user, initUser, login, claimIdleRewards, isLoading, fetchCR, fetchUser } = useGameStore();
  const hydrated = useHydration();
  const [username, setUsername] = useState('');
  const [idleStatus, setIdleStatus] = useState<any>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [cr, setCR] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [instantCooldown, setInstantCooldown] = useState<number>(0); // seconds remaining
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      handleLogin();
      loadCR();
      loadIdleStatus();
      loadInstantCooldown();
      timerRef.current = setInterval(() => updateIdleTimer(), 1000);
      cooldownRef.current = setInterval(() => {
        setInstantCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => { 
        if (timerRef.current) clearInterval(timerRef.current);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
      };
    }
  }, [user?.username]);

  const loadInstantCooldown = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user/${user.username}`);
      const userData = await response.json();
      if (userData.last_instant_collect) {
        const lastCollect = new Date(userData.last_instant_collect);
        const now = new Date();
        const cooldownEnd = new Date(lastCollect.getTime() + 4 * 60 * 60 * 1000); // 4 hours
        const remaining = Math.max(0, Math.floor((cooldownEnd.getTime() - now.getTime()) / 1000));
        setInstantCooldown(remaining);
      }
    } catch (error) { console.error('Failed to load cooldown:', error); }
  };

  const formatCooldown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

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
      if (rewards?.gold_earned) {
        Alert.alert('Rewards Collected', `+${rewards.gold_earned.toLocaleString()} Gold`, [{ text: 'Continue' }]);
      }
      // Reload idle status to reset timer
      loadIdleStatus();
    } catch (error) {
      console.error('Failed to claim idle rewards:', error);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleInstantCollect = async () => {
    if (!user || (user.vip_level || 0) < 1) {
      Alert.alert('VIP Required', 'VIP 1+ can use Instant Collect to claim 2 hours of rewards instantly!');
      return;
    }
    if (instantCooldown > 0) {
      Alert.alert('On Cooldown', `Instant Collect available in ${formatCooldown(instantCooldown)}`);
      return;
    }
    if (isClaiming) return;
    setIsClaiming(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/idle/instant-collect/${user.username}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        // Build detailed rewards message
        const resources = data.resources_earned || {};
        let rewardsText = `⚡ Collected 2 hours of rewards!\n\n`;
        if (data.gold_earned > 0) rewardsText += `💰 +${data.gold_earned.toLocaleString()} Gold\n`;
        if (data.exp_earned > 0) rewardsText += `✨ +${data.exp_earned.toLocaleString()} EXP\n`;
        if (resources.coins > 0) rewardsText += `🪙 +${resources.coins.toLocaleString()} Coins\n`;
        if (resources.crystals > 0) rewardsText += `💎 +${resources.crystals.toLocaleString()} Crystals\n`;
        if (resources.stamina > 0) rewardsText += `⚡ +${resources.stamina} Stamina\n`;
        
        Alert.alert('⚡ Instant Collect!', rewardsText, [{ text: 'Nice!' }]);
        
        // Set 4 hour cooldown
        setInstantCooldown(4 * 60 * 60);
        loadIdleStatus();
        fetchUser();
      } else {
        // Extract cooldown from error message if present
        const errorMsg = data.detail || 'Instant collect on cooldown';
        Alert.alert('Cannot Collect', errorMsg);
        // Refresh cooldown state
        loadInstantCooldown();
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to instant collect');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleLogin = async () => {
    try {
      // Just track login - no rewards popup
      await login();
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
        <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <View style={styles.loginScreenContainer}>
        {/* Background with Raphael 5+ Star Skin */}
        <ImageBackground
          source={{ uri: RAPHAEL_5PLUS_IMAGE }}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          {/* Gradient Overlays for readability */}
          <LinearGradient
            colors={['rgba(5, 10, 20, 0.75)', 'rgba(13, 10, 26, 0.85)', 'rgba(5, 10, 20, 0.95)']}
            style={styles.backgroundOverlay}
          />
          
          {/* Subtle vignette effect */}
          <LinearGradient
            colors={['transparent', 'rgba(5, 10, 20, 0.6)']}
            style={styles.vignetteBottom}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </ImageBackground>
        
        {/* Celestial particle texture overlay */}
        <View style={styles.particleOverlay} pointerEvents="none">
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.star,
                {
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.5 + 0.2,
                  width: Math.random() * 2 + 1,
                  height: Math.random() * 2 + 1,
                }
              ]}
            />
          ))}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <SafeAreaView style={styles.loginSafeArea} edges={['top', 'left', 'right']}>
            <ScrollView 
              contentContainerStyle={styles.loginScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Logo Section */}
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <LinearGradient
                    colors={[COLORS.violet.light, COLORS.violet.primary, COLORS.violet.dark]}
                    style={styles.logoGradient}
                  >
                    <Text style={styles.logoText}>DH</Text>
                  </LinearGradient>
                </View>
                <Text style={styles.gameTitle}>DIVINE HEROES</Text>
                <Text style={styles.gameSubtitle}>Enter the Divine Nexus</Text>
              </View>

              {/* Login Card */}
              <View style={styles.loginCard}>
                {/* Glow border effect */}
                <LinearGradient
                  colors={[COLORS.violet.glow + '40', COLORS.gold.primary + '30', COLORS.violet.glow + '40']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGlow}
                />
                
                <View style={styles.loginCardInner}>
                  <Text style={styles.loginLabel}>
                    {isRegistering ? 'Create Account' : 'Welcome Back'}
                  </Text>
                  <Text style={styles.loginSubLabel}>
                    {isRegistering ? 'Begin your divine journey' : 'Your heroes await'}
                  </Text>
                  
                  {/* Error Display */}
                  {authError ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={16} color="#f87171" />
                      <Text style={styles.errorText}>{authError}</Text>
                    </View>
                  ) : null}
                  
                  {/* Username Input */}
                  <View style={styles.inputContainer}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="person" size={18} color={COLORS.violet.light} />
                    </View>
                    <TextInput
                      style={styles.loginInput}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Username"
                      placeholderTextColor={COLORS.navy.light}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  
                  {/* Password Input */}
                  <View style={styles.inputContainer}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="lock-closed" size={18} color={COLORS.violet.light} />
                    </View>
                    <TextInput
                      style={styles.loginInput}
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
                        color={COLORS.violet.light} 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Confirm Password (Registration) */}
                  {isRegistering && (
                    <View style={styles.inputContainer}>
                      <View style={styles.inputIconContainer}>
                        <Ionicons name="shield-checkmark" size={18} color={COLORS.violet.light} />
                      </View>
                      <TextInput
                        style={styles.loginInput}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm Password"
                        placeholderTextColor={COLORS.navy.light}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                    </View>
                  )}
                  
                  {/* Login Button */}
                  <TouchableOpacity style={styles.loginButton} onPress={handleStartGame}>
                    <LinearGradient 
                      colors={[COLORS.violet.primary, COLORS.violet.dark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.loginButtonGradient}
                    >
                      <Text style={styles.loginButtonText}>
                        {isRegistering ? 'CREATE ACCOUNT' : 'BEGIN JOURNEY'}
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color={COLORS.cream.pure} />
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  {/* Switch Auth Mode */}
                  <TouchableOpacity 
                    style={styles.switchAuthMode} 
                    onPress={() => {
                      setIsRegistering(!isRegistering);
                      setAuthError('');
                      setConfirmPassword('');
                    }}
                  >
                    <Text style={styles.switchAuthText}>
                      {isRegistering ? 'Already have an account? ' : 'New player? '}
                      <Text style={styles.switchAuthHighlight}>
                        {isRegistering ? 'Login' : 'Create Account'}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Security Note */}
                  <View style={styles.securityNote}>
                    <Ionicons name="shield-checkmark" size={14} color={COLORS.gold.primary} />
                    <Text style={styles.securityNoteText}>Secured with encrypted authentication</Text>
                  </View>
                </View>
              </View>

              {/* Footer Attribution */}
              <View style={styles.loginFooter}>
                <Text style={styles.footerText}>Featuring Raphael the Eternal</Text>
                <Text style={styles.footerSubText}>5+ Star Ascension</Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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

        {/* Currency Bar - Scrollable */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.currencyBarScroll}
          contentContainerStyle={styles.currencyBarContent}
        >
          <View style={styles.currencyItem}>
            <Ionicons name="diamond" size={14} color="#9b4dca" />
            <Text style={styles.currencyText}>{(user.gems || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.currencyItem}>
            <Ionicons name="logo-bitcoin" size={14} color={COLORS.gold.primary} />
            <Text style={styles.currencyText}>{(user.gold || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.currencyItem}>
            <Ionicons name="cash" size={14} color={COLORS.gold.light} />
            <Text style={styles.currencyText}>{(user.coins || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.currencyItem}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.currencyText}>{(user.divine_essence || 0).toLocaleString()}</Text>
          </View>
        </ScrollView>

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
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.claimButton, { flex: 1 }]} onPress={handleClaimIdle} disabled={isClaiming}>
                  <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.claimButtonGradient}>
                    {isClaiming ? <ActivityIndicator color={COLORS.navy.dark} size="small" /> : <><Ionicons name="download" size={18} color={COLORS.navy.dark} /><Text style={styles.claimButtonText}>Collect</Text></>}
                  </LinearGradient>
                </TouchableOpacity>
                {(user.vip_level || 0) >= 1 && (
                  <TouchableOpacity 
                    style={[styles.claimButton, { flex: 1, marginLeft: 8, opacity: instantCooldown > 0 ? 0.6 : 1 }]} 
                    onPress={handleInstantCollect} 
                    disabled={isClaiming || instantCooldown > 0}
                  >
                    <LinearGradient 
                      colors={instantCooldown > 0 ? ['#4a4a6a', '#3a3a5a'] : ['#8b5cf6', '#6d28d9']} 
                      style={styles.claimButtonGradient}
                    >
                      {isClaiming ? (
                        <ActivityIndicator color={COLORS.cream.pure} size="small" />
                      ) : instantCooldown > 0 ? (
                        <>
                          <Ionicons name="time" size={16} color={COLORS.cream.soft} />
                          <Text style={[styles.claimButtonText, { color: COLORS.cream.soft, fontSize: 11 }]}>
                            {formatCooldown(instantCooldown)}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="flash" size={18} color={COLORS.cream.pure} />
                          <Text style={[styles.claimButtonText, { color: COLORS.cream.pure }]}>⚡ Instant</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
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
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/events')}>
              <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.quickLinkGradient}>
                <Ionicons name="sparkles" size={22} color={COLORS.cream.pure} />
                <Text style={[styles.quickLinkText, { color: COLORS.cream.pure }]}>Events</Text>
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
  
  // ============ NEW LOGIN SCREEN STYLES ============
  loginScreenContainer: { flex: 1, backgroundColor: COLORS.celestial.deep },
  backgroundImage: { 
    position: 'absolute', 
    width: SCREEN_WIDTH, 
    height: SCREEN_HEIGHT,
    top: 0,
    left: 0,
  },
  backgroundOverlay: { 
    ...StyleSheet.absoluteFillObject,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },
  particleOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    backgroundColor: COLORS.cream.pure,
    borderRadius: 50,
  },
  keyboardAvoid: { flex: 1 },
  loginSafeArea: { flex: 1 },
  loginScrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 24,
    paddingBottom: 40,
  },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.gold.primary + '60',
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 32, fontWeight: 'bold', color: COLORS.cream.pure, letterSpacing: 2 },
  gameTitle: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: COLORS.cream.pure, 
    letterSpacing: 6,
    textShadowColor: COLORS.violet.glow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  gameSubtitle: { 
    fontSize: 14, 
    color: COLORS.gold.light, 
    marginTop: 8, 
    letterSpacing: 3, 
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  loginCard: { 
    borderRadius: 24, 
    overflow: 'hidden',
    marginBottom: 24,
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  loginCardInner: {
    backgroundColor: COLORS.celestial.deep + 'E8',
    borderRadius: 24,
    padding: 28,
    margin: 2,
    borderWidth: 1,
    borderColor: COLORS.violet.primary + '40',
  },
  loginLabel: { 
    color: COLORS.cream.pure, 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center',
    marginBottom: 4,
  },
  loginSubLabel: {
    color: COLORS.violet.light,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.dark + 'CC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.violet.primary + '40',
    marginBottom: 16,
    overflow: 'hidden',
  },
  inputIconContainer: {
    paddingLeft: 16,
    paddingRight: 4,
  },
  loginInput: { 
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16, 
    color: COLORS.cream.pure,
  },
  eyeButton: { paddingHorizontal: 16, paddingVertical: 12 },
  loginButton: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  loginButtonGradient: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  loginButtonText: { 
    color: COLORS.cream.pure, 
    fontSize: 16, 
    fontWeight: 'bold', 
    letterSpacing: 2,
  },
  switchAuthMode: { marginTop: 20, alignItems: 'center' },
  switchAuthText: { color: COLORS.cream.dark, fontSize: 14 },
  switchAuthHighlight: { color: COLORS.gold.light, fontWeight: '600' },
  errorBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#7f1d1d40', 
    padding: 14, 
    borderRadius: 12, 
    marginBottom: 16, 
    gap: 10,
    borderWidth: 1,
    borderColor: '#f8717140',
  },
  errorText: { color: '#fca5a5', fontSize: 13, flex: 1 },
  securityNote: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 20, 
    gap: 8,
    opacity: 0.7,
  },
  securityNoteText: { color: COLORS.cream.dark, fontSize: 12 },
  loginFooter: {
    alignItems: 'center',
    opacity: 0.6,
  },
  footerText: {
    color: COLORS.gold.light,
    fontSize: 12,
    fontWeight: '500',
  },
  footerSubText: {
    color: COLORS.violet.light,
    fontSize: 10,
    marginTop: 2,
  },
  // ============ END LOGIN SCREEN STYLES ============
  
  // Legacy styles preserved for backward compatibility
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.dark, borderRadius: 12, borderWidth: 1, borderColor: COLORS.navy.light + '40', marginBottom: 12 },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: COLORS.cream.pure },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.navy.medium, borderWidth: 2, borderColor: COLORS.gold.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold.primary },
  welcomeText: { fontSize: 12, color: COLORS.cream.dark },
  usernameText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure },
  crBadge: { backgroundColor: COLORS.navy.medium, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.gold.dark + '60', alignItems: 'center' },
  crLabel: { fontSize: 10, color: COLORS.gold.light, fontWeight: '600' },
  crValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold.primary },
  currencyBarScroll: { maxHeight: 44, marginBottom: 8 },
  currencyBarContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  currencyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.medium + '90', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, gap: 5, borderWidth: 1, borderColor: COLORS.navy.light + '30' },
  currencyText: { color: COLORS.cream.soft, fontWeight: '600', fontSize: 12 },
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
  buttonRow: { flexDirection: 'row', alignItems: 'center' },
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
