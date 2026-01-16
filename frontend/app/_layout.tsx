import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform, View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../stores/gameStore';
import { useFeatureStore } from '../stores/featureStore';
import { useEntitlementStore } from '../stores/entitlementStore';
import { useNetworkStore } from '../stores/networkStore';
import { isFeatureEnabled } from '../lib/features';
import { OfflineBanner } from '../components/OfflineBanner';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { initSentry, sentrySetUser } from '../lib/telemetry/sentry';
import { track, Events } from '../lib/telemetry/events';
import { validateConfig } from '../lib/config/validate';
// Phase 3.14: App resume reconciliation
import { useAppResumeReconcile } from '../hooks/useAppResumeReconcile';
// Phase 3.18: Toast provider for success/error notifications
import { ToastProvider } from '../components/ui/ToastProvider';

// REVENUECAT DISABLED - Re-enable when finalizing project
// import { useRevenueCatStore } from '../stores/revenueCatStore';

// Regal Color Palette
const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b' },
  gold: { primary: '#c9a227', light: '#e6c666' },
  cream: { soft: '#f8f6f0' },
};

// Maintenance Mode Screen
function MaintenanceScreen() {
  return (
    <View style={styles.maintenanceContainer}>
      <Ionicons name="construct" size={64} color={COLORS.gold.primary} />
      <Text style={styles.maintenanceTitle}>Under Maintenance</Text>
      <Text style={styles.maintenanceText}>
        We're performing scheduled maintenance.{'\n'}
        Please check back soon!
      </Text>
    </View>
  );
}

// Session Provider Component - ensures session is restored before rendering
function SessionProvider({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useGameStore(s => s.hydrateAuth);
  const registerForceLogout = useGameStore(s => s.registerForceLogout);
  const user = useGameStore(s => s.user);
  const fetchUser = useGameStore(s => s.fetchUser);
  const hydrateRemoteFeatures = useFeatureStore(s => s.hydrateRemoteFeatures);
  const hydrateEntitlements = useEntitlementStore(s => s.hydrateEntitlements);
  const ensureFreshEntitlements = useEntitlementStore(s => s.ensureFreshEntitlements);
  const initNetworkListener = useNetworkStore(s => s.initNetworkListener);
  const [isRestoring, setIsRestoring] = useState(true);
  
  // Phase 3.14: App resume reconciliation (entitlements freshness on foreground)
  useAppResumeReconcile();

  useEffect(() => {
    // Validate config and init telemetry (runs once on app start, not at module-load)
    validateConfig();
    initSentry();
    
    // Track app start
    track(Events.APP_START);
    
    const restore = async () => {
      // Register force logout callback with API layer FIRST
      // This ensures 401 responses trigger proper logout
      registerForceLogout();
      
      // Hydrate feature flags (fast - uses cache first, non-blocking)
      hydrateRemoteFeatures().catch(() => {});
      
      // Hydrate auth from storage - ALWAYS runs, no conditional
      await hydrateAuth().catch(() => {});
      
      // Hydrate paid entitlements from cache first (fast)
      await hydrateEntitlements().catch(() => {});
      
      setIsRestoring(false);
    };
    restore();
  }, [hydrateRemoteFeatures, hydrateAuth, hydrateEntitlements, registerForceLogout]);

  // After restore complete + user is logged in: refresh entitlements from server
  // This is a separate effect so it runs AFTER hydrateAuth completes
  // Phase 3.14: Use ensureFreshEntitlements for consistent discipline
  useEffect(() => {
    if (!isRestoring && user) {
      // User is logged in - ensure entitlements are fresh (uses TTL discipline)
      // Non-blocking: fire and forget
      ensureFreshEntitlements('startup').catch(() => {});
    }
  }, [isRestoring, user, ensureFreshEntitlements]);

  // Initialize network listener (returns cleanup function)
  useEffect(() => {
    const unsubscribe = initNetworkListener();
    return unsubscribe;
  }, [initNetworkListener]);

  // Update Sentry user context when user changes
  useEffect(() => {
    sentrySetUser(user ? { username: user.username } : undefined);
  }, [user?.username]);

  // Show loading while restoring session
  if (isRestoring) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Maintenance mode gate - emergency kill switch
  if (isFeatureEnabled('MAINTENANCE_MODE')) {
    return <MaintenanceScreen />;
  }

  return (
    <>
      <OfflineBanner onRetry={() => fetchUser().catch(() => {})} />
      {children}
    </>
  );
}

export default function Layout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <SessionProvider>
          <TabsWithSafeArea />
        </SessionProvider>
        {/* Phase 3.18: Global toast notifications */}
        <ToastProvider />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

// Separate component to use the safe area insets hook
function TabsWithSafeArea() {
  const insets = useSafeAreaInsets();
  // Phase 3.22.2: Hide tab bar when user is not logged in
  const user = useGameStore(s => s.user);
  
  // Visible tab bar style
  const visibleTabBarStyle = {
    ...styles.tabBar,
    paddingBottom: Math.max(insets.bottom, 8),
    height: 60 + Math.max(insets.bottom, 0),
  };
  
  // Hidden tab bar style - fully removes from layout on web and native
  // Must override the fixed positioning from styles.tabBar on web
  const hiddenTabBarStyle = Platform.select({
    web: {
      display: 'none' as const,
      position: 'absolute' as const,
      height: 0,
      width: 0,
      overflow: 'hidden' as const,
      visibility: 'hidden' as const,
    },
    default: {
      display: 'none' as const,
      height: 0,
    },
  });
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.gold.primary,
        tabBarInactiveTintColor: COLORS.cream.soft + '60',
        tabBarStyle: user ? visibleTabBarStyle : hiddenTabBarStyle,
        headerShown: false,
        tabBarLabelStyle: user ? styles.tabLabel : { display: 'none' as const },
        tabBarIconStyle: user ? styles.tabIcon : { display: 'none' as const },
      }}
    >
      {/* ===== 6 MAIN VISIBLE TABS ===== */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="summon-hub"
        options={{
          title: 'Summon',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="heroes"
        options={{
          title: 'Heroes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="arena"
        options={{
          title: 'Arena',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="guild"
        options={{
          title: 'Guild',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* ===== HIDDEN SCREENS (accessible via router.push) ===== */}
      <Tabs.Screen name="story" options={{ href: null }} />
      <Tabs.Screen name="abyss" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
      <Tabs.Screen name="store" options={{ href: null }} />
      <Tabs.Screen name="gacha" options={{ href: null }} />
      <Tabs.Screen name="team" options={{ href: null }} />
      <Tabs.Screen name="login-rewards" options={{ href: null }} />
      <Tabs.Screen name="battle-pass" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="team-builder" options={{ href: null }} />
      <Tabs.Screen name="hero-upgrade" options={{ href: null }} />
      <Tabs.Screen name="hero-progression" options={{ href: null }} />
      <Tabs.Screen name="combat" options={{ href: null }} />
      <Tabs.Screen name="hero-detail" options={{ href: null }} />
      <Tabs.Screen name="dungeons" options={{ href: null }} />
      <Tabs.Screen name="equipment" options={{ href: null }} />
      <Tabs.Screen name="guild-war" options={{ href: null }} />
      <Tabs.Screen name="hero-manager" options={{ href: null }} />
      <Tabs.Screen name="journey" options={{ href: null }} />
      <Tabs.Screen name="launch-banner" options={{ href: null }} />
      <Tabs.Screen name="selene-banner" options={{ href: null }} />
      <Tabs.Screen name="resource-bag" options={{ href: null }} />
      <Tabs.Screen name="campaign" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="paid-features" options={{ href: null }} />
      <Tabs.Screen name="awakening-preview" options={{ href: null }} />
      </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.navy.darkest,
  },
  loadingText: {
    color: COLORS.gold.primary,
    marginTop: 12,
    fontSize: 16,
  },
  maintenanceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.navy.darkest,
    padding: 24,
  },
  maintenanceTitle: {
    color: COLORS.gold.primary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  maintenanceText: {
    color: COLORS.cream.soft,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },
  tabBar: {
    backgroundColor: COLORS.navy.darkest,
    borderTopColor: COLORS.gold.primary + '30',
    borderTopWidth: 1,
    height: Platform.OS === 'web' ? 60 : 65,
    paddingBottom: Platform.OS === 'web' ? 8 : 10,
    paddingTop: 8,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        bottom: 0,
        left: 0,
        right: 0,
      },
    }),
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabIcon: {
    marginBottom: -2,
  },
});
