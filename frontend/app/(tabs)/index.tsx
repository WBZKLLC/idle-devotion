import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  AccessibilityInfo,
  Animated as RNAnimated,
  Easing as RNEasing,
  AppState,
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
// Phase 4.3: Focus-based refresh (no setInterval)
import { useFocusEffect } from '@react-navigation/native';
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
// Phase 3.50: Safe time formatting (NaN timer bugfix)
import { formatHMS } from '../../lib/utils/formatHMS';
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
// Phase 3.22.10: Global interaction event bus
import { subscribeInteraction } from '../../lib/ui/interactionSession';
// Phase 3.22.10.C: Seasonal temperature
import { getTemperatureBias, getSeason } from '../../lib/ui/season';
// Phase 3.22.12.R2: Badge selectors
import { useRailBadges } from '../../lib/ui/badges';
// Phase 3.23.8: Atmosphere stack for sanctuary depth
import { AtmosphereStack } from '../../components/home/AtmosphereStack';

// Centralized API wrappers (no raw fetch in screens)
import { fetchUser as apiFetchUser, getIdleStatus, instantCollectIdle } from '../../lib/api';

// Dashboard background (Sanctum environment art) - LOCAL ASSET
// Celestial sanctum/temple environment - instant render, no flicker
const SANCTUM_BG_IMAGE = require('../../assets/backgrounds/sanctum_environment_01.jpg');

// Phase 3.22.1: Use canonical theme colors (no local duplication)
import COLORS from '../../theme/colors';
// Phase 3.22.1: Extracted home screen components
// Phase 3.22.12: Sanctuary layout components
import { 
  HomeHeader, 
  CurrencyBar, 
  IdleRewardsCard, 
  QuickLinksGrid, 
  QuickLinkRow, 
  IdleRewardsCardRef,
  RitualDock,
  HomeSideRail,
  DoorsSheet,
} from '../../components/home';

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
  
  // Phase 3.22.12.R2: Real badge data
  const railBadges = useRailBadges();
  
  // Phase 3.22.12: Sanctuary layout state
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [ritualOpen, setRitualOpen] = useState(false);
  
  // Phase 3.19.9: In-app reward recap modal (unified component)
  const [rewardRecap, setRewardRecap] = useState<RewardRecapData | null>(null);
  
  // Phase 3.19.11: Confirm modal hook
  const { openConfirm, confirmNode } = useConfirmModal();

  // Phase 3.22.8: Desire accents - eye-shift trigger after first scroll + delay
  const eyeShiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Phase 3.22.10: Ref to IdleRewardsCard for cancelling signature revert on interaction
  const idleCardRef = useRef<IdleRewardsCardRef>(null);
  
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
    // Phase 3.22.10: Cancel signature moment revert (yields immediately to user)
    idleCardRef.current?.cancelSignatureRevert();
  };

  // Phase 3.22.10: Subscribe to global interaction bus (tab presses, etc.)
  useEffect(() => {
    const unsubscribe = subscribeInteraction(handleUserInteraction);
    return unsubscribe;
  }, []);

  // Phase 4.3: Focus-based refresh instead of setInterval
  // Refresh idle status and cooldown on screen focus (no 1s polling)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        handleLogin();
        loadCR();
        loadIdleStatus();
        loadInstantCooldown();
      }
      
      // Also refresh on app state change (foreground)
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active' && user) {
          loadIdleStatus();
          loadInstantCooldown();
        }
      });
      
      return () => subscription.remove();
    }, [user?.username])
  );

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

  // Phase 3.50: Use safe formatHMS to prevent NaN:NaN:NaN bug
  const formatIdleTime = (seconds: number | undefined | null, maxHours: number) => {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
      return formatHMS(null); // Returns '--:--:--'
    }
    const cappedSeconds = Math.min(seconds, maxHours * 3600);
    return formatHMS(cappedSeconds);
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

  // AUTHENTICATED DASHBOARD — Phase 3.22.12: Sanctuary Scene Layout
  // No more ScrollView stack. Home is now a scene with anchored overlays.
  return (
    <View style={styles.container}>
      {/* === BACKGROUND SCENE LAYERS === */}
      <CenteredBackground 
        source={SANCTUM_BG_IMAGE} 
        mode="contain" 
        zoom={1.04}
        opacity={1}
      />
      <SanctumAtmosphere />
      {/* Phase 3.23.8: Use dedicated AtmosphereStack component */}
      <AtmosphereStack />
      
      {/* === PERIMETER HUD (top overlay, quiet) === */}
      <SafeAreaView style={styles.hudContainer} edges={['top', 'left', 'right']} pointerEvents="box-none">
        <View style={styles.hudContent}>
          <HomeHeader username={user.username} cr={cr} />
          <CurrencyBar
            gems={user.gems || 0}
            gold={user.gold || 0}
            coins={user.coins || 0}
            divineEssence={user.divine_essence || 0}
          />
        </View>
      </SafeAreaView>

      {/* === RIGHT SIDE RAIL (peripheral hot actions) === */}
      <HomeSideRail 
        onAnyInteraction={handleUserInteraction}
        onPressDoors={() => setDoorsOpen(true)}
        onPressMail={() => router.push('/mail')}
        onPressFriends={() => router.push('/friends')}
        onPressQuest={() => router.push('/journey')}
        onPressEvents={() => router.push('/events')}
        onPressSummon={() => router.push('/summon-hub')}
        onPressShop={() => goToStore('store')}
        badges={railBadges}
      />

      {/* === RITUAL DOCK (bottom-center anchor, the ONE prominent element) === */}
      <RitualDock
        idleStatus={idleStatus}
        formatIdleTime={formatIdleTime}
        onPress={() => setRitualOpen(true)}
        onReceive={handleClaimIdle}
        onAnyInteraction={handleUserInteraction}
      />

      {/* === MODALS / SHEETS === */}
      
      {/* Doors Sheet (QuickLinks + Pity + dashboard stuff) */}
      <DoorsSheet
        visible={doorsOpen}
        onClose={() => setDoorsOpen(false)}
        quickLinkRows={quickLinkRows}
        pityData={{
          common: { current: user.pity_counter || 0, max: 50 },
          premium: { current: user.pity_counter_premium || 0, max: 50 },
          divine: { current: user.pity_counter_divine || 0, max: 40 },
        }}
        onAnyInteraction={handleUserInteraction}
      />
      
      {/* Ritual Sheet (expanded idle rewards) */}
      <Modal
        visible={ritualOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRitualOpen(false)}
      >
        <View style={styles.ritualOverlay}>
          <Pressable style={styles.ritualBackdrop} onPress={() => setRitualOpen(false)} />
          <View style={styles.ritualSheet}>
            <View style={styles.ritualHandle}><View style={styles.handleBar} /></View>
            <IdleRewardsCard
              ref={idleCardRef}
              idleStatus={idleStatus}
              vipLevel={user?.vip_level || 0}
              instantCooldown={instantCooldown}
              isClaimingCollect={isClaimingCollect}
              isClaimingInstant={isClaimingInstant}
              formatIdleTime={formatIdleTime}
              formatCooldown={formatCooldown}
              onCollect={() => { handleClaimIdle(); setRitualOpen(false); }}
              onInstant={() => { handleInstantCollect(); setRitualOpen(false); }}
              onVipLockedPress={() => toast.info('VIP 1+ unlocks Instant Collect (2 hours of rewards instantly).')}
              onAnyInteraction={handleUserInteraction}
            />
          </View>
        </View>
      </Modal>

      {/* Sidebar (legacy, accessed via HomeSideRail "More") */}
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      
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
  
  // Phase 3.22.12: Sanctuary scene layout
  hudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  hudContent: {
    // Quiet, peripheral — not competing with the scene
  },
  
  // Phase 3.22.12: Ritual sheet (expanded idle rewards)
  ritualOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  ritualBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  ritualSheet: {
    backgroundColor: COLORS.navy.dark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
      },
    }),
  },
  ritualHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cream.pure + '30',
  },
  
  // Legacy content styles (kept for reference, no longer used in main layout)
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
  // Phase 3.22.7: Pity section — quiet ledger, not another loud tile
  // Phase 3.22.11: Event banner — silk/glass material, not grid tile
  pitySection: { marginTop: SECTION_GAP.pause },
  sectionTitle: { 
    fontSize: FONT_SIZE.xs, 
    fontWeight: FONT_WEIGHT.medium, 
    color: COLORS.cream.soft, 
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: INVITATION.dormant * 0.9,
    marginBottom: 8,
  },
  pityCard: { 
    // Phase 3.22.11: Glass/silk material — transparent, subtle
    backgroundColor: COLORS.navy.darkest + '50',
    borderRadius: RADIUS.md, 
    paddingHorizontal: 12,
    paddingVertical: 10,
    // Phase 3.22.11: Very subtle highlight edge (glass effect)
    borderWidth: 0.5, 
    borderColor: COLORS.cream.pure + '06',
    // Lower overall presence
    opacity: INVITATION.secondary,
  },
  pityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pityInfo: { width: 70 },
  pityLabel: { 
    fontSize: 10, 
    color: COLORS.cream.dark, 
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pityValue: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: COLORS.cream.soft,
    opacity: 0.9,
  },
  pityBarOuter: { 
    flex: 1, 
    height: 6, 
    backgroundColor: COLORS.navy.darkest + '80', 
    borderRadius: 3, 
    overflow: 'hidden', 
    marginLeft: 10 
  },
  pityBarFill: { height: '100%', borderRadius: 3 },
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
 * DivineOverlays - Premium overlay effects for sanctuary depth
 * Phase 3.23.8: Enhanced with top haze, vignette corners, focal lift, and atmosphere
 */
function DivineOverlays(props: { 
  vignette?: boolean; 
  rays?: boolean; 
  grain?: boolean; 
  topHaze?: boolean; 
  focalLift?: boolean;
  bottomMist?: boolean;
  driftFog?: boolean;
}) {
  // Check for reduce motion
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  
  // Drifting fog animation
  const driftAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (props.driftFog !== false && !reduceMotion) {
      const loop = RNAnimated.loop(
        RNAnimated.timing(driftAnim, {
          toValue: 1,
          duration: 15000, // 15s loop
          easing: RNEasing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [driftAnim, reduceMotion, props.driftFog]);
  
  const driftStyle = {
    transform: [{
      translateX: driftAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-60, 60],
      }),
    }],
  };
  
  return (
    <>
      {/* Top Haze — HUD sits in atmospheric mist */}
      {props.topHaze !== false && (
        <LinearGradient
          colors={[
            'rgba(12,16,28,0.72)',
            'rgba(12,16,28,0.45)',
            'rgba(12,16,28,0.12)',
            'transparent',
          ]}
          locations={[0, 0.25, 0.55, 1]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 180,
            zIndex: 3,
          }}
          pointerEvents="none"
        />
      )}
      
      {/* Bottom Mist — fog shelf above tab bar */}
      {props.bottomMist !== false && (
        <LinearGradient
          colors={[
            'transparent',
            'rgba(12,16,28,0.08)',
            'rgba(12,16,28,0.25)',
            'rgba(12,16,28,0.55)',
          ]}
          locations={[0, 0.4, 0.7, 1]}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 140,
            zIndex: 2,
          }}
          pointerEvents="none"
        />
      )}
      
      {/* Drifting Fog Band — slow horizontal drift for "breath" */}
      {props.driftFog !== false && (
        <RNAnimated.View
          style={[
            {
              position: 'absolute',
              top: '35%',
              left: -80,
              right: -80,
              height: 100,
              zIndex: 1,
            },
            !reduceMotion && driftStyle,
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.025)',
              'rgba(255,255,255,0.04)',
              'rgba(255,255,255,0.025)',
              'transparent',
            ]}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </RNAnimated.View>
      )}
      
      {/* Vignette — darkens corners for depth */}
      {props.vignette && (
        <>
          <LinearGradient
            colors={['rgba(8,10,18,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50%',
              height: '40%',
            }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(8,10,18,0.55)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%',
              height: '40%',
            }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(8,10,18,0.45)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '50%',
              height: '35%',
            }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(8,10,18,0.45)', 'transparent']}
            start={{ x: 1, y: 1 }}
            end={{ x: 0.5, y: 0.5 }}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '50%',
              height: '35%',
            }}
            pointerEvents="none"
          />
        </>
      )}
      
      {/* Focal Lift — warm glow near dock area (candlelight) */}
      {props.focalLift !== false && (
        <LinearGradient
          colors={['transparent', 'transparent', `${COLORS.gold.primary}05`, `${COLORS.gold.primary}0C`, 'transparent']}
          locations={[0, 0.55, 0.72, 0.88, 1]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '42%',
            zIndex: 2,
          }}
          pointerEvents="none"
        />
      )}
      
      {props.rays && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -120,
            top: -120,
            right: -120,
            bottom: -120,
            transform: [{ rotate: "-12deg" }],
            backgroundColor: "rgba(255,255,255,0.03)",
          }}
        />
      )}

      {/* Grain — very subtle film texture */}
      {props.grain && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.012)",
            zIndex: 4,
          }}
        />
      )}
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
 * Phase 3.22.10.C: Now with seasonal temperature shift
 * - Cool violet wash for deeper feel (adjusted by season)
 * - Bottom fade for UI density/readability
 */
function SanctumAtmosphere() {
  // Phase 3.22.10.C: Seasonal temperature bias (cached per session)
  const bias = useMemo(() => getTemperatureBias(), []);
  const season = useMemo(() => getSeason(), []);
  
  // Apply seasonal shift to violet wash (5-8% max)
  // Winter: slightly more violet/cool
  // Summer: slightly warmer/less violet
  const violetWashOpacity = useMemo(() => {
    const base = 0.18;
    return base * bias.violetSaturation;
  }, [bias]);
  
  // Violet base: rgba(20, 18, 40, opacity)
  // Adjust based on season
  const violetColor = useMemo(() => {
    let r = 20;
    let b = 40;
    
    // Summer: warmer (less blue)
    if (season === 'summer') {
      r = 24;
      b = 36;
    }
    // Winter: cooler (more blue)
    else if (season === 'winter') {
      r = 16;
      b = 44;
    }
    // Fall: amber shift
    else if (season === 'fall') {
      r = 26;
      b = 34;
    }
    
    return `rgba(${r}, 18, ${b}, ${violetWashOpacity.toFixed(2)})`;
  }, [season, violetWashOpacity]);

  return (
    <>
      {/* Cool violet wash (seasonal) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: violetColor,
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
