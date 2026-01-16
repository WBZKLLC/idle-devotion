import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Phase 3.22.10: Global interaction signal
import { emitInteraction } from '../../lib/ui/interactionSession';

// Phase 3.22.6.C: Tab bar is "the floor" — darker, anchoring, never competing
const COLORS = {
  navy: { darkest: '#060d17', dark: '#0a1321', primary: '#1b263b' }, // deeper darkest
  gold: { primary: '#c9a227', warm: '#d4a84a' }, // warm active state
  cream: { muted: '#f8f6f0' },
};

/**
 * Tabs Layout - Only mounted for authenticated users
 * Contains the 6 main tab destinations
 * 
 * Phase 3.22.6.C: "The Floor"
 * - Darker than content
 * - Active icon slightly warmer, not brighter
 * - No animation, no glow
 * - Anchors the indulgence
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        // Active: warm gold (not bright)
        tabBarActiveTintColor: COLORS.gold.warm,
        // Inactive: very muted (not competing)
        tabBarInactiveTintColor: COLORS.cream.muted + '40',
        tabBarStyle: {
          // Darker than content — the ground you stand on
          backgroundColor: COLORS.navy.darkest,
          borderTopColor: COLORS.gold.primary + '15', // barely visible border
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 56 : 60,
          paddingBottom: Platform.OS === 'web' ? 6 : Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        headerShown: false,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
      }}
      // Phase 3.22.10: Emit interaction on any tab press (cancels desire accents)
      screenListeners={{
        tabPress: () => emitInteraction(),
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 9,
    fontWeight: '500', // lighter
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tabIcon: {
    marginBottom: -2,
  },
});
