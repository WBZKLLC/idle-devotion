import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform, View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useRevenueCatStore } from '../stores/revenueCatStore';

// Regal Color Palette
const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b' },
  gold: { primary: '#c9a227', light: '#e6c666' },
  cream: { soft: '#f8f6f0' },
};

// Session Provider Component - ensures session is restored before rendering
function SessionProvider({ children }: { children: React.ReactNode }) {
  const { isHydrated, restoreSession, user } = useGameStore();
  const { initialize: initRevenueCat, setUserId } = useRevenueCatStore();
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const restore = async () => {
      if (!isHydrated) {
        await restoreSession();
      }
      // Initialize RevenueCat (wrapped in try-catch for Expo Go compatibility)
      try {
        await initRevenueCat();
      } catch (error) {
        console.log('[App] RevenueCat init skipped (may not be available in Expo Go):', error);
      }
      setIsRestoring(false);
    };
    restore();
  }, []);

  // Link RevenueCat user when app user logs in
  useEffect(() => {
    if (user?.username) {
      try {
        setUserId(user.username);
      } catch (error) {
        console.log('[App] RevenueCat setUserId skipped:', error);
      }
    }
  }, [user?.username]);

  // Show loading while restoring session
  if (isRestoring && !isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function Layout() {
  return (
    <SessionProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: COLORS.gold.primary,
          tabBarInactiveTintColor: COLORS.cream.soft + '60',
          tabBarStyle: styles.tabBar,
          headerShown: false,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIconStyle: styles.tabIcon,
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
      </Tabs>
    </SessionProvider>
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
