import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useGameStore, useHydration } from '../../stores/gameStore';
import { isErrorHandledGlobally } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Sidebar from '../../components/Sidebar';
// Phase 3.11: Canonical store navigation
import { goToStore } from '../../lib/entitlements/navigation';
// Phase 3.19.2: Canonical button component
import { PrimaryButton } from '../../components/ui/PrimaryButton';
// Phase 3.19.9: Unified reward recap modal
import { RewardRecapModal, RewardRecapData } from '../../components/ui/RewardRecapModal';
// Phase 3.19.11: Confirm modal hook
import { useConfirmModal } from '../../components/ui/useConfirmModal';
// Phase 3.18.4: Toast for non-blocking feedback
import { toast } from '../../components/ui/Toast';
// Phase 3.19.7: Cinematic loading screen
import { CinematicLoading } from '../../components/ui/CinematicLoading';
// Phase 3.22.9: Settle animation tokens
import { SECTION_GAP, LAYOUT, INVITATION, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../components/ui/tokens';
// Phase 3.22.8: Desire accents system
import {
  markScrollDetected,
  markInteraction,
  canTriggerEyeShift,
  markEyeShiftTriggered,
  canTriggerGlance,
  markGlanceTriggered,
} from '../../lib/ui/desire';

// Centralized API wrappers (no raw fetch in screens)
import { fetchUser as apiFetchUser, getIdleStatus, instantCollectIdle } from '../../lib/api';

// Dashboard background (Sanctum environment art) - LOCAL ASSET
// Celestial sanctum/temple environment - instant render, no flicker
const SANCTUM_BG_IMAGE = require('../../assets/backgrounds/sanctum_environment_01.jpg');

// Phase 3.22.1: Use canonical theme colors (no local duplication)
import COLORS from '../../theme/colors';
// Phase 3.22.1: Extracted home screen components
import { HomeHeader, CurrencyBar, IdleRewardsCard, QuickLinksGrid, QuickLinkRow } from '../../components/home';

export default function HomeScreen() {
  const { user, login, claimIdleRewards, isLoading, fetchCR, fetchUser } = useGameStore();
  const hydrated = useHydration();
  
  const [idleStatus, setIdleStatus] = useState<any>(null);
  // Phase 3.19.8: Split loading states for button cadence
  const [isClaimingCollect, setIsClaimingCollect] = useState(false);
  const [isClaimingInstant, setIsClaimingInstant] = useState(false);
  const [cr, setCR] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [instantCooldown, setInstantCooldown] = useState<number>(0); // seconds remaining
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Phase 3.19.9: In-app reward recap modal (unified component)
  const [rewardRecap, setRewardRecap] = useState<RewardRecapData | null>(null);
  
  // Phase 3.19.11: Confirm modal hook
  const { openConfirm, confirmNode } = useConfirmModal();

  // Phase 3.22.8: Desire accents - eye-shift trigger after first scroll + delay
  const eyeShiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    // Attempt eye-shift trigger after scroll is detected + short delay
    const attemptEyeShift = () => {
      if (!canTriggerEyeShift()) return;
      
      eyeShiftTimeoutRef.current = setTimeout(() => {
        if (canTriggerEyeShift()) {
          // Eye-shift would trigger subtle animation here
          // For now, just mark as triggered (spends budget)
          markEyeShiftTriggered();
        }
      }, 700); // 700ms delay after scroll for "noticed after movement" feel
    };
    
    attemptEyeShift();
    
    return () => {
      if (eyeShiftTimeoutRef.current) clearTimeout(eyeShiftTimeoutRef.current);
    };
  }, []);

  // Phase 3.22.8: Rare glance - trigger only if user is idle 30-90s
  const glanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glanceCancelledRef = useRef(false);
  
  useEffect(() => {
    glanceCancelledRef.current = false;
    
    const scheduleGlance = () => {
      if (!canTriggerGlance()) return;
      
      // Random delay 30-90s
      const delay = 30_000 + Math.floor(Math.random() * 60_000);
      
      glanceTimeoutRef.current = setTimeout(() => {
        if (glanceCancelledRef.current) return;
        if (!canTriggerGlance()) return;
        
        // Glance would trigger subtle animation here
        // For now, just mark as triggered (spends budget)
        markGlanceTriggered();
      }, delay);
    };
    
    scheduleGlance();
    
    return () => {
      glanceCancelledRef.current = true;
      if (glanceTimeoutRef.current) clearTimeout(glanceTimeoutRef.current);
    };
  }, []);

  // Cancel glance on any user interaction
  const handleUserInteraction = () => {
    markInteraction();
    glanceCancelledRef.current = true;
    if (glanceTimeoutRef.current) {
      clearTimeout(glanceTimeoutRef.current);
      glanceTimeoutRef.current = null;
    }
  };

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

  // Phase 3.19.7: Cinematic loading screen for initial hydration
  // Note: Root layout handles auth gating, so we just show loading if needed
  if (!hydrated || isLoading || !user) {
    return <CinematicLoading />;
  }

  // Phase 3.22.1: Quick Links data configuration
  const quickLinkRows: QuickLinkRow[] = [
    {
      key: 'row1',
      tiles: [
        {
          kind: 'standard',
          key: 'teams',
          onPress: () => router.push('/hero-manager'),
          gradient: [COLORS.gold.primary, COLORS.gold.dark] as const,
          icon: 'people',
          iconColor: COLORS.navy.darkest,
          label: 'Teams',
          labelStyle: { color: COLORS.navy.darkest },
        },
        {
          kind: 'standard',
          key: 'heroes',
          onPress: () => router.push('/heroes'),
          gradient: [COLORS.navy.medium, COLORS.navy.primary] as const,
          icon: 'star',
          iconColor: COLORS.gold.light,
          label: 'Heroes',
        },
        {
          kind: 'standard',
          key: 'rewards',
          onPress: () => router.push('/login-rewards'),
          gradient: [COLORS.navy.medium, COLORS.navy.primary] as const,
          icon: 'calendar',
          iconColor: COLORS.gold.light,
          label: 'Rewards',
        },
      ],
    },
    {
      key: 'row2',
      tiles: [
        {
          kind: 'standard',
          key: 'guild',
          onPress: () => router.push('/guild'),
          gradient: [COLORS.navy.medium, COLORS.navy.primary] as const,
          icon: 'shield',
          iconColor: COLORS.gold.light,
          label: 'Guild',
        },
        {
          kind: 'standard',
          key: 'gear',
          onPress: () => router.push('/equipment'),
          gradient: ['#8b5cf6', '#6d28d9'] as const,
          icon: 'hammer',
          iconColor: COLORS.cream.pure,
          label: 'Gear',
          labelStyle: { color: COLORS.cream.pure },
        },
        {
          kind: 'standard',
          key: 'store',
          onPress: () => goToStore('store'),
          gradient: [COLORS.navy.medium, COLORS.navy.primary] as const,
          icon: 'cart',
          iconColor: COLORS.gold.light,
          label: 'Store',
        },
      ],
    },
    {
      key: 'row3',
      tiles: [
        {
          kind: 'custom',
          key: 'selene-banner',
          flex: 2,
          onPress: () => router.push('/selene-banner'),
          gradient: ['#6366f1', '#4338ca', '#1e1b4b'] as const,
          gradientStyle: { paddingVertical: 20 },
          children: (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>⏳</Text>
              <View>
                <Text style={{ color: '#a5b4fc', fontSize: 14, fontWeight: 'bold' }}>
                  FATED CHRONOLOGY
                </Text>
                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>
                  7 DAYS ONLY!
                </Text>
              </View>
            </View>
          ),
        },
        {
          kind: 'standard',
          key: 'journey',
          onPress: () => router.push('/journey'),
          gradient: ['#f59e0b', '#d97706'] as const,
          icon: 'map',
          iconColor: COLORS.cream.pure,
          label: 'Journey',
          labelStyle: { color: COLORS.cream.pure },
        },
      ],
    },
    {
      key: 'row4',
      tiles: [
        {
          kind: 'standard',
          key: 'aethon',
          onPress: () => router.push('/launch-banner'),
          gradient: ['#7c3aed', '#5b21b6'] as const,
          emoji: '✨',
          label: 'Aethon 72H',
          labelStyle: { color: COLORS.gold.light, fontSize: 11 },
        },
        {
          kind: 'standard',
          key: 'dungeons',
          onPress: () => router.push('/dungeons'),
          gradient: ['#22c55e', '#16a34a'] as const,
          icon: 'flash',
          iconColor: COLORS.cream.pure,
          label: 'Dungeons',
          labelStyle: { color: COLORS.cream.pure },
        },
        {
          kind: 'standard',
          key: 'events',
          onPress: () => router.push('/events'),
          gradient: ['#f59e0b', '#d97706'] as const,
          icon: 'sparkles',
          iconColor: COLORS.cream.pure,
          label: 'Events',
          labelStyle: { color: COLORS.cream.pure },
        },
        {
          kind: 'standard',
          key: 'pass',
          onPress: () => router.push('/battle-pass'),
          gradient: ['#9b59b6', '#8e44ad'] as const,
          icon: 'trophy',
          iconColor: COLORS.cream.pure,
          label: 'Pass',
          labelStyle: { color: COLORS.cream.pure },
        },
      ],
    },
    {
      key: 'row5',
      tiles: [
        {
          kind: 'custom',
          key: 'campaign',
          flex: 2,
          onPress: () => router.push('/campaign'),
          gradient: ['#1e40af', '#1e3a8a', '#172554'] as const,
          gradientStyle: { paddingVertical: 18 },
          children: (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>📖</Text>
              <View>
                <Text style={{ color: '#93c5fd', fontSize: 14, fontWeight: 'bold' }}>
                  STORY CAMPAIGN
                </Text>
                <Text style={{ color: '#60a5fa', fontSize: 10 }}>
                  12 Chapters • Epic Adventure
                </Text>
              </View>
            </View>
          ),
        },
        {
          kind: 'standard',
          key: 'abyss',
          onPress: () => router.push('/abyss'),
          gradient: ['#1a202c', '#0d0d12'] as const,
          icon: 'chevron-down-circle',
          iconColor: '#48bb78',
          label: 'Abyss',
          labelStyle: { color: '#48bb78' },
        },
      ],
    },
    {
      key: 'row6',
      tiles: [
        {
          kind: 'standard',
          key: 'war',
          onPress: () => router.push('/guild-war'),
          gradient: ['#dc2626', '#7f1d1d'] as const,
          icon: 'flame',
          iconColor: COLORS.cream.pure,
          label: 'War',
          labelStyle: { color: COLORS.cream.pure },
        },
        {
          kind: 'standard',
          key: 'chat',
          onPress: () => router.push('/chat'),
          gradient: ['#0891b2', '#0e7490'] as const,
          icon: 'chatbubbles',
          iconColor: COLORS.cream.pure,
          label: 'Chat',
          labelStyle: { color: COLORS.cream.pure },
        },
        {
          kind: 'standard',
          key: 'ranks',
          onPress: () => router.push('/leaderboard'),
          gradient: [COLORS.navy.medium, COLORS.navy.primary] as const,
          icon: 'podium',
          iconColor: COLORS.gold.light,
          label: 'Ranks',
        },
        {
          kind: 'standard',
          key: 'more',
          onPress: () => setSidebarVisible(true),
          gradient: [COLORS.navy.medium, COLORS.navy.primary] as const,
          icon: 'menu',
          iconColor: COLORS.gold.light,
          label: 'More',
        },
      ],
    },
  ];

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
        {/* Phase 3.22.1: Extracted header component */}
        <HomeHeader username={user.username} cr={cr} />

        {/* Phase 3.22.1: Extracted currency bar component */}
        <CurrencyBar
          gems={user.gems || 0}
          gold={user.gold || 0}
          coins={user.coins || 0}
          divineEssence={user.divine_essence || 0}
        />

        <ScrollView 
          contentContainerStyle={styles.content} 
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            markScrollDetected();
            handleUserInteraction();
          }}
          scrollEventThrottle={16}
        >
          {/* Phase 3.22.1: Extracted idle rewards component */}
          <Pressable onPressIn={handleUserInteraction}>
            <IdleRewardsCard
              idleStatus={idleStatus}
              vipLevel={user?.vip_level || 0}
              instantCooldown={instantCooldown}
              isClaimingCollect={isClaimingCollect}
              isClaimingInstant={isClaimingInstant}
              formatIdleTime={formatIdleTime}
              formatCooldown={formatCooldown}
              onCollect={handleClaimIdle}
              onInstant={handleInstantCollect}
              onVipLockedPress={() => toast.info('VIP 1+ unlocks Instant Collect (2 hours of rewards instantly).')}
            />
          </Pressable>

          {/* Phase 3.22.1: Extracted quick links grid */}
          <QuickLinksGrid rows={quickLinkRows} />

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

        <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      </SafeAreaView>
      
      {/* Phase 3.19.9: Unified Reward Recap Modal */}
      <RewardRecapModal 
        visible={!!rewardRecap} 
        data={rewardRecap} 
        onClose={() => setRewardRecap(null)} 
      />
      
      {/* Phase 3.19.11: Confirm Modal via hook */}
      {confirmNode}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.gold.primary, marginTop: 12, fontSize: 16, fontWeight: '500' },
  
  // Phase 3.22.7: Restraint pass — intentional vertical rhythm
  content: { 
    paddingHorizontal: LAYOUT.SCREEN_PADDING,
    paddingTop: SECTION_GAP.breath,
    paddingBottom: LAYOUT.TAB_BAR_HEIGHT + LAYOUT.BOTTOM_GUTTER,
  },
  
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
  scrollPadding: { paddingTop: 16, paddingBottom: 100 },
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
  // Phase 3.22.1: quickLinks styles moved to QuickLinksGrid component
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
