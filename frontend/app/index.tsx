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
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, useHydration } from '../stores/gameStore';
import { isErrorHandledGlobally } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Sidebar from '../components/Sidebar';
// Phase 3.11: Canonical store navigation
import { goToStore } from '../lib/entitlements/navigation';
// Phase 3.19.2: Canonical button component
import { PrimaryButton } from '../components/ui/PrimaryButton';
// Phase 3.19.9: Unified reward recap modal
import { RewardRecapModal, RewardRecapData } from '../components/ui/RewardRecapModal';
// Phase 3.19.10: Canonical confirm modal
import { ConfirmModal, ConfirmModalData } from '../components/ui/ConfirmModal';
// Phase 3.18.4: Toast for non-blocking feedback
import { toast } from '../components/ui/Toast';
// Phase 3.19.7: Cinematic loading screen
import { CinematicLoading } from '../components/ui/CinematicLoading';
// Single source of truth for login hero
import { LOGIN_HERO_URI } from '../lib/assets/loginHero';

// Centralized API wrappers (no raw fetch in screens)
import { fetchUser as apiFetchUser, getIdleStatus, instantCollectIdle } from '../lib/api';

// Dashboard background (Sanctum environment art) - LOCAL ASSET
// Celestial sanctum/temple environment - instant render, no flicker
const SANCTUM_BG_IMAGE = require('../assets/backgrounds/sanctum_environment_01.jpg');

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
  // Phase 3.19.8: Split loading states for button cadence
  const [isClaimingCollect, setIsClaimingCollect] = useState(false);
  const [isClaimingInstant, setIsClaimingInstant] = useState(false);
  const [cr, setCR] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [instantCooldown, setInstantCooldown] = useState<number>(0); // seconds remaining
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  
  // Phase 3.19.9: In-app reward recap modal (unified component)
  const [rewardRecap, setRewardRecap] = useState<RewardRecapData | null>(null);

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
      // Use centralized API wrapper
      const userData = await apiFetchUser(user.username);
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
      // Use centralized API wrapper
      const data = await getIdleStatus(user?.username || '');
      setIdleStatus(data);
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
    if (isClaimingCollect || isClaimingInstant) return;
    setIsClaimingCollect(true);
    try {
      const rewards = await claimIdleRewards();
      if (rewards?.gold_earned) {
        // Phase 3.19.8: In-app recap modal (replaces blocking Alert)
        setRewardRecap({
          title: 'Rewards Collected',
          message: `+${rewards.gold_earned.toLocaleString()} Gold`,
          tone: 'gold',
        });
      }
      // Reload idle status to reset timer
      loadIdleStatus();
    } catch (error: any) {
      console.error('Failed to claim idle rewards:', error);
      if (!isErrorHandledGlobally(error)) {
        toast.error(error?.message || 'Failed to collect idle rewards');
      }
    } finally {
      setIsClaimingCollect(false);
    }
  };

  const handleInstantCollect = async () => {
    // Phase 3.19.8: VIP check moved to button onPress for better UX
    if (instantCooldown > 0) {
      toast.warning(`Instant Collect available in ${formatCooldown(instantCooldown)}`);
      return;
    }
    if (isClaimingCollect || isClaimingInstant) return;
    setIsClaimingInstant(true);
    try {
      // Use centralized API wrapper
      const data = await instantCollectIdle(user!.username);
      if (data.success) {
        // Build detailed rewards message
        const resources = data.resources_earned || {};
        let rewardsText = `⚡ Collected 2 hours of rewards!\n\n`;
        if (data.gold_earned > 0) rewardsText += `💰 +${data.gold_earned.toLocaleString()} Gold\n`;
        if (data.exp_earned > 0) rewardsText += `✨ +${data.exp_earned.toLocaleString()} EXP\n`;
        if (resources.coins > 0) rewardsText += `🪙 +${resources.coins.toLocaleString()} Coins\n`;
        if (resources.crystals > 0) rewardsText += `💎 +${resources.crystals.toLocaleString()} Crystals\n`;
        if (resources.stamina > 0) rewardsText += `⚡ +${resources.stamina} Stamina\n`;
        
        // Phase 3.19.8: In-app recap modal (replaces blocking Alert)
        setRewardRecap({
          title: '⚡ Instant Collect!',
          message: rewardsText,
          tone: 'purple',
        });
        
        // Set 4 hour cooldown
        setInstantCooldown(4 * 60 * 60);
        loadIdleStatus();
        fetchUser();
      } else {
        // Extract cooldown from error message if present
        const errorMsg = data.detail || 'Instant collect on cooldown';
        // Phase 3.18.4: Toast for errors
        toast.warning(errorMsg);
        // Refresh cooldown state
        loadInstantCooldown();
      }
    } catch (error: any) {
      if (!isErrorHandledGlobally(error)) {
        toast.error(error?.message || 'Failed to instant collect');
      }
    } finally {
      setIsClaimingInstant(false);
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
      // Phase 3.18.4: Toast for validation
      toast.warning('Please enter a username to begin');
      return; 
    }
    if (!password) {
      toast.warning('Please enter a password to secure your account');
      return;
    }
    if (password.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }
    
    setAuthError('');
    
    if (isRegistering) {
      // Registration flow
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
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
          // Legacy account - prompt to set password (KEEP as Alert - user decision required)
          // ALERT_ALLOWED: legacy_account_flow
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
                    toast.success('Password set successfully! Your account is now secure.');
                  }
                }
              }
            ]
          );
        } else if (result.error?.includes('Invalid username')) {
          // User doesn't exist - offer to register (KEEP as Alert - user decision required)
          // ALERT_ALLOWED: legacy_account_flow
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

  // Phase 3.19.7: Cinematic loading screen for initial hydration
  if (!hydrated || isLoading) {
    return <CinematicLoading />;
  }

  if (!user) {
    return (
      <View style={loginStyles.screenContainer}>
        {/* Background: Login hero - MATH-CENTERED (Login "wow" moment) */}
        <CenteredBackground
          source={{ uri: LOGIN_HERO_URI }}
          mode="contain"
          zoom={1.06}
          opacity={1}
        />
        
        {/* Divine Overlays - premium celestial aesthetic */}
        <DivineOverlays vignette rays grain />
        
        {/* Additional gradient overlays for text readability */}
        <View style={loginStyles.topGradientA} />
        <View style={loginStyles.topGradientB} />
        <View style={loginStyles.bottomGradientA} />
        <View style={loginStyles.bottomGradientB} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={loginStyles.keyboardAvoid}
        >
          <SafeAreaView style={loginStyles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView 
              contentContainerStyle={loginStyles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* TOP BRAND BLOCK */}
              <View style={loginStyles.brandContainer}>
                {/* Brand Circle */}
                <View style={loginStyles.brandCircle}>
                  <Text style={loginStyles.brandText}>DH</Text>
                </View>
                
                {/* Title */}
                <Text style={loginStyles.title}>IDLE DEVOTION</Text>
                
                {/* Subtitle */}
                <Text style={loginStyles.subtitle}>A SOUL BOUND FANTASY</Text>
              </View>

              {/* LOGIN CARD */}
              <View style={loginStyles.card}>
                {/* Card Header */}
                <Text style={loginStyles.cardTitle}>
                  {isRegistering ? 'Create Account' : 'Welcome Back'}
                </Text>
                <Text style={loginStyles.cardSubtitle}>
                  {isRegistering ? 'Begin your divine journey' : 'Your heroes await'}
                </Text>
                
                {/* Error Display */}
                {authError ? (
                  <View style={loginStyles.errorBox}>
                    <Ionicons name="alert-circle" size={14} color="rgba(255,210,215,0.95)" style={{ opacity: 0.9 }} />
                    <Text style={loginStyles.errorText}>{authError}</Text>
                  </View>
                ) : null}
                
                {/* Username Input */}
                <View style={loginStyles.inputContainer}>
                  <Ionicons name="person" size={18} color="rgba(255,255,255,0.7)" style={loginStyles.inputIcon} />
                  <TextInput
                    style={loginStyles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Username"
                    placeholderTextColor="rgba(255,255,255,0.40)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                
                {/* Password Input */}
                <View style={loginStyles.inputContainer}>
                  <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.7)" style={loginStyles.inputIcon} />
                  <TextInput
                    style={loginStyles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.40)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    style={loginStyles.eyeButton} 
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? 'eye-off' : 'eye'} 
                      size={18} 
                      color="rgba(255,255,255,0.6)" 
                    />
                  </TouchableOpacity>
                </View>
                
                {/* Confirm Password (Registration) */}
                {isRegistering && (
                  <View style={loginStyles.inputContainer}>
                    <Ionicons name="shield-checkmark" size={18} color="rgba(255,255,255,0.7)" style={loginStyles.inputIcon} />
                    <TextInput
                      style={loginStyles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm Password"
                      placeholderTextColor="rgba(255,255,255,0.40)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>
                )}
                
                {/* Primary Button */}
                <TouchableOpacity style={loginStyles.primaryButton} onPress={handleStartGame}>
                  <View style={loginStyles.buttonHighlight} />
                  <Text style={loginStyles.buttonText}>
                    {isRegistering ? 'CREATE ACCOUNT →' : 'BEGIN JOURNEY →'}
                  </Text>
                </TouchableOpacity>
                
                {/* Secondary Link */}
                <TouchableOpacity 
                  style={loginStyles.secondaryLink} 
                  onPress={() => {
                    setIsRegistering(!isRegistering);
                    setAuthError('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={loginStyles.secondaryText}>
                    {isRegistering ? 'Already have an account? ' : 'New player? '}
                    <Text style={loginStyles.secondaryHighlight}>
                      {isRegistering ? 'Login' : 'Create Account'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Footer removed - Phase 3.19.7 cleanup */}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // AUTHENTICATED DASHBOARD
  return (
    <View style={styles.container}>
      {/* Background: Sanctum environment (local asset - instant render, no flicker) */}
      <CenteredBackground 
        source={SANCTUM_BG_IMAGE} 
        mode="contain" 
        zoom={1.04}
        opacity={1}
      />
      <SanctumAtmosphere />
      <DivineOverlays vignette grain />
      
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
                <Text style={styles.idlePendingText}>+{(idleStatus?.gold_pending || 0).toLocaleString()} Gold Pending</Text>
              </View>
              <View style={styles.buttonRow}>
                {/* Collect Button */}
                <TouchableOpacity 
                  style={[styles.claimButton, { flex: 1 }]} 
                  onPress={handleClaimIdle} 
                  disabled={isClaimingCollect || isClaimingInstant}
                >
                  <LinearGradient colors={[COLORS.gold.primary, COLORS.gold.dark]} style={styles.claimButtonGradient}>
                    {isClaimingCollect ? (
                      <ActivityIndicator color={COLORS.navy.dark} size="small" />
                    ) : (
                      <>
                        <Ionicons name="download" size={18} color={COLORS.navy.dark} />
                        <Text style={styles.claimButtonText}>Collect</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                
                {/* Phase 3.19.8: Instant button always visible (VIP lock state for better UX) */}
                <TouchableOpacity 
                  style={[
                    styles.claimButton, 
                    { 
                      flex: 1, 
                      marginLeft: 8, 
                      opacity: instantCooldown > 0 || (user?.vip_level || 0) < 1 ? 0.6 : 1 
                    }
                  ]} 
                  onPress={() => {
                    if ((user?.vip_level || 0) < 1) {
                      toast.info('VIP 1+ unlocks Instant Collect (2 hours of rewards instantly).');
                      return;
                    }
                    handleInstantCollect();
                  }}
                  disabled={isClaimingCollect || isClaimingInstant || instantCooldown > 0}
                >
                  <LinearGradient 
                    colors={
                      (user?.vip_level || 0) < 1 
                        ? ['#4a4a6a', '#3a3a5a'] 
                        : instantCooldown > 0 
                          ? ['#4a4a6a', '#3a3a5a'] 
                          : ['#8b5cf6', '#6d28d9']
                    } 
                    style={styles.claimButtonGradient}
                  >
                    {isClaimingInstant ? (
                      <ActivityIndicator color={COLORS.cream.pure} size="small" />
                    ) : (user?.vip_level || 0) < 1 ? (
                      <>
                        <Ionicons name="lock-closed" size={16} color={COLORS.cream.soft} />
                        <Text style={[styles.claimButtonText, { color: COLORS.cream.soft, fontSize: 11 }]}>VIP 1+</Text>
                      </>
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
            <TouchableOpacity style={styles.quickLink} onPress={() => goToStore('store')}>
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
      
      {/* Phase 3.19.9: Unified Reward Recap Modal */}
      <RewardRecapModal 
        visible={!!rewardRecap} 
        data={rewardRecap} 
        onClose={() => setRewardRecap(null)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16, fontWeight: '500' },
  
  // ============ LEGACY LOGIN STYLES (deprecated - using loginStyles instead) ============
  loginScreenContainer: { flex: 1, backgroundColor: COLORS.celestial.deep },
  backgroundImage: { 
    position: 'absolute', 
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundOverlay: { 
    ...StyleSheet.absoluteFillObject,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
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

// ============ PIXEL-SPECIFIC LOGIN STYLES ============
const loginStyles = StyleSheet.create({
  // Screen container
  screenContainer: {
    flex: 1,
    backgroundColor: '#080614',
  },
  
  // Note: Background image styles are now inline using useWindowDimensions() for perfect centering
  
  // OVERLAY 1: Vignette
  vignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  
  // OVERLAY 2: Top gradient (faked with stacked Views)
  topGradientA: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(8,6,20,0.65)',
  },
  topGradientB: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(8,6,20,0.25)',
  },
  
  // OVERLAY 3: Bottom gradient
  bottomGradientA: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(8,6,20,0.20)',
  },
  bottomGradientB: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(8,6,20,0.70)',
  },
  
  // Layout
  keyboardAvoid: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
  },
  
  // Brand container
  brandContainer: {
    alignItems: 'center',
    marginTop: 14,
  },
  
  // Brand circle
  brandCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginBottom: 10,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#a855f7',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  brandText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E9D5FF',
  },
  
  // Title
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3.2,
    marginTop: 6,
    color: '#F5F3FF',
    textShadowColor: 'rgba(168,85,247,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  
  // Subtitle
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.0,
    marginTop: 6,
    marginBottom: 18,
    color: 'rgba(253,230,138,0.92)',
  },
  
  // Login card
  card: {
    width: '92%',
    maxWidth: 420,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(12,10,30,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  
  // Card header
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  
  // Input container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    marginTop: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(8,6,20,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  inputIcon: {
    marginRight: 10,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  eyeButton: {
    padding: 8,
  },
  
  // Primary button
  primaryButton: {
    height: 52,
    borderRadius: 14,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.95)',
    overflow: 'hidden',
  },
  buttonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#F5F3FF',
  },
  
  // Secondary link
  secondaryLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.70)',
  },
  secondaryHighlight: {
    color: 'rgba(253,230,138,0.95)',
    fontWeight: '700',
  },
  
  // Error box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(120,20,30,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,140,0.35)',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,210,215,0.95)',
  },
  
  // Footer
  footer: {
    marginTop: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.55)',
  },
});

// ============ 2DLIVE SHELL COMPONENTS (UI-only) ============

type CenterFitMode = "contain" | "native";

/**
 * CenteredBackground - Hardened version with no-jump, truly deterministic centering
 * Works with both local require() and remote { uri } sources
 * Prevents the "flash/jump" on remote URLs by waiting for intrinsic size
 */
function CenteredBackground(props: {
  source: any;                 // require() or {uri}
  mode?: CenterFitMode;        // default: contain
  zoom?: number;               // default: 1
  opacity?: number;            // default: 1
  waitForSize?: boolean;       // default: true - prevents "1x1 then jump" on remote URIs
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const mode = props.mode ?? "contain";
  const zoom = props.zoom ?? 1;
  const opacity = props.opacity ?? 1;
  const waitForSize = props.waitForSize ?? true;

  const resolvedLocal = React.useMemo(() => {
    try {
      return Image.resolveAssetSource(props.source);
    } catch {
      return undefined;
    }
  }, [props.source]);

  const uri = props.source?.uri as string | undefined;
  const [remoteSize, setRemoteSize] = React.useState<{ w: number; h: number } | null>(null);
  const [remoteReady, setRemoteReady] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    // Local require: size known immediately.
    if (!uri) {
      setRemoteSize(null);
      setRemoteReady(true);
      return;
    }

    setRemoteReady(false);
    Image.getSize(
      uri,
      (w, h) => {
        if (!alive) return;
        setRemoteSize({ w, h });
        setRemoteReady(true);
      },
      () => {
        if (!alive) return;
        // If remote size fails, mark ready but keep size null (we'll fallback)
        setRemoteSize(null);
        setRemoteReady(true);
      }
    );

    return () => {
      alive = false;
    };
  }, [uri]);

  // If remote and we want to prevent a "jump", wait until we know it's ready.
  if (uri && waitForSize && !remoteReady) return null;

  const imgW = resolvedLocal?.width ?? remoteSize?.w ?? screenW;
  const imgH = resolvedLocal?.height ?? remoteSize?.h ?? screenH;

  let scale = 1;
  if (mode === "contain") {
    const sx = screenW / imgW;
    const sy = screenH / imgH;
    scale = Math.min(sx, sy) * zoom;
  } else {
    scale = zoom;
  }

  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const left = (screenW - scaledW) / 2;
  const top = (screenH - scaledH) / 2;

  return (
    <Image
      source={props.source}
      style={{
        position: "absolute",
        width: scaledW,
        height: scaledH,
        left,
        top,
        opacity,
      }}
      resizeMode="stretch"
    />
  );
}

/**
 * DivineOverlays - Premium overlay effects for celestial gacha aesthetic
 */
function DivineOverlays(props: { vignette?: boolean; rays?: boolean; grain?: boolean }) {
  return (
    <>
      {props.rays ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -120,
            top: -120,
            right: -120,
            bottom: -120,
            transform: [{ rotate: "-12deg" }],
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />
      ) : null}

      {props.vignette ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.28)",
          }}
        />
      ) : null}

      {props.grain ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.02)",
          }}
        />
      ) : null}
    </>
  );
}

/**
 * GlassCard - Divine glass + gold stroke card wrapper
 * Use to wrap any content for unified celestial styling
 */
function GlassCard(props: { children: React.ReactNode; style?: any }) {
  return (
    <View
      style={[
        {
          borderRadius: 22,
          padding: 1.2,
          backgroundColor: "rgba(255, 215, 140, 0.28)",
          shadowOpacity: 0.35,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        },
        props.style,
      ]}
    >
      <View
        style={{
          borderRadius: 21,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: "rgba(10, 12, 18, 0.72)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
        }}
      >
        {props.children}
      </View>
    </View>
  );
}

/**
 * SanctumAtmosphere - Adds depth and readability to Sanctum environment
 * - Cool violet wash for deeper feel
 * - Bottom fade for UI density/readability
 */
function SanctumAtmosphere() {
  return (
    <>
      {/* Cool violet wash */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(20, 18, 40, 0.18)",
        }}
      />

      {/* Bottom fade for UI density */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 240,
          backgroundColor: "rgba(0,0,0,0.22)",
        }}
      />
    </>
  );
}
