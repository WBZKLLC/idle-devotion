import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Phase 3.22.10: Global interaction signal
import { emitInteraction } from '../../lib/ui/interactionSession';

// Phase 3.22.6.C: Tab bar is "the floor" — darker, anchoring, never competing
// Phase 3.22.11: Elegance refinements — tighter, quieter
const COLORS = {
  navy: { darkest: '#050a12', dark: '#0a1321', primary: '#1b263b' }, // even deeper
  gold: { primary: '#c9a227', warm: '#d4a84a' },
  cream: { muted: '#f8f6f0' },
};

/**
 * Tabs Layout - Only mounted for authenticated users
 * Contains the 6 main tab destinations
 * 
 * Phase 3.22.6.C: "The Floor"
 * Phase 3.22.11: Elegance Pass
 * - Darker than content (the ground you stand on)
 * - Active icon warm, not bright
 * - Reduced label contrast
 * - Tighter icon/label spacing
 * - Never competes with Chapter 2 (ritual)
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        // Active: warm gold (not bright)
        tabBarActiveTintColor: COLORS.gold.warm,
        // Phase 3.22.11: Even more muted inactive (30% instead of 40%)
        tabBarInactiveTintColor: COLORS.cream.muted + '30',
        tabBarStyle: {
          // Darker than content — the ground you stand on
          backgroundColor: COLORS.navy.darkest,
          // Phase 3.22.11: Even more subtle border (10% alpha)
          borderTopColor: COLORS.gold.primary + '10',
          borderTopWidth: 0.5,
          // Phase 3.22.11: Slightly shorter
          height: Platform.OS === 'web' ? 52 : 56,
          paddingBottom: Platform.OS === 'web' ? 4 : Math.max(insets.bottom, 6),
          paddingTop: 4,
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
            <Ionicons name="home" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="summon-hub"
        options={{
          title: 'Summon',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="heroes"
        options={{
          title: 'Heroes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="arena"
        options={{
          title: 'Arena',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="guild"
        options={{
          title: 'Guild',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    // Phase 3.22.11: Smaller, more elegant
    fontSize: 8,
    fontWeight: '400', // even lighter
    marginTop: 1, // tighter icon/label spacing
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tabIcon: {
    marginBottom: 0, // Phase 3.22.11: Tighter
  },
});
