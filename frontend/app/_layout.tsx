import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF1493',
        tabBarInactiveTintColor: '#A0A0A0',
        tabBarStyle: styles.tabBar,
        headerShown: false,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
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
        name="story"
        options={{
          title: 'Story',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
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
        name="abyss"
        options={{
          title: 'Abyss',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" size={size} color={color} />
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
        name="heroes"
        options={{
          title: 'Heroes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
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
      <Tabs.Screen
        name="gacha"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="gem-summon"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="coin-summon"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#FF1493',
    borderTopWidth: 2,
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
    shadowColor: '#FF1493',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
