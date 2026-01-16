import { Stack, Redirect, useSegments } from 'expo-router';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { Ionicons } from '@expo/vector-icons';
// Phase 3.14: App resume reconciliation
import { useAppResumeReconcile } from '../hooks/useAppResumeReconcile';
// Phase 3.18: Toast provider for success/error notifications
import { ToastProvider } from '../components/ui/ToastProvider';

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
  useEffect(() => {
    if (!isRestoring && user) {
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

// Auth Navigator - redirects based on auth state
function AuthNavigator() {
  const user = useGameStore(s => s.user);
  const segments = useSegments();
  
  // Determine if we're currently in the auth or tabs group
  const inAuthGroup = segments[0] === '(auth)';
  const inTabsGroup = segments[0] === '(tabs)';
  
  // Not logged in and NOT in auth group -> redirect to login
  if (!user && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }
  
  // Logged in but still in auth group -> redirect to tabs
  if (user && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }
  
  // Otherwise, render the appropriate Stack
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      {/* Non-tab screens that should NOT show tab bar */}
      <Stack.Screen name="chat" />
      <Stack.Screen name="story" />
      <Stack.Screen name="abyss" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="store" />
      <Stack.Screen name="gacha" />
      <Stack.Screen name="team" />
      <Stack.Screen name="login-rewards" />
      <Stack.Screen name="battle-pass" />
      <Stack.Screen name="events" />
      <Stack.Screen name="team-builder" />
      <Stack.Screen name="hero-upgrade" />
      <Stack.Screen name="hero-progression" />
      <Stack.Screen name="combat" />
      <Stack.Screen name="hero-detail" />
      <Stack.Screen name="dungeons" />
      <Stack.Screen name="equipment" />
      <Stack.Screen name="guild-war" />
      <Stack.Screen name="hero-manager" />
      <Stack.Screen name="journey" />
      <Stack.Screen name="launch-banner" />
      <Stack.Screen name="selene-banner" />
      <Stack.Screen name="resource-bag" />
      <Stack.Screen name="campaign" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="paid-features" />
      <Stack.Screen name="awakening-preview" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <SessionProvider>
          <AuthNavigator />
        </SessionProvider>
        {/* Phase 3.18: Global toast notifications */}
        <ToastProvider />
      </SafeAreaProvider>
    </AppErrorBoundary>
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
});
