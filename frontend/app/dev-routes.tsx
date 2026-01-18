// /app/frontend/app/dev-routes.tsx
// Phase 3.49: DEV-only Routes screen for navigation sanity
//
// Lists all routes for verification. No timers/polling.
// Purely for dev to ensure UI wiring doesn't silently drift.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import COLORS from '../theme/colors';

// Only show in dev mode
const IS_DEV = __DEV__;

interface RouteLink {
  path: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const DEV_ROUTES: RouteLink[] = [
  // Core navigation
  { path: '/', label: 'Home', icon: 'home', description: 'Main sanctuary screen' },
  { path: '/mail', label: 'Mail', icon: 'mail', description: 'Rewards, messages, gifts' },
  { path: '/friends', label: 'Friends', icon: 'people', description: 'Friend list and requests' },
  { path: '/events', label: 'Events', icon: 'calendar', description: 'Active events and quests' },
  { path: '/shop', label: 'Shop', icon: 'storefront', description: 'Store catalog' },
  { path: '/vip', label: 'VIP', icon: 'star', description: 'VIP tier comparison' },
  
  // Systems
  { path: '/daily', label: 'Daily Login', icon: 'today', description: 'Daily rewards calendar' },
  { path: '/idle', label: 'Idle Rewards', icon: 'time', description: 'Idle resource collection' },
  { path: '/gacha-history', label: 'Gacha History', icon: 'list', description: 'Summon history log' },
  
  // Heroes (sample ID)
  { path: '/hero/HERO_001', label: 'Hero Detail', icon: 'person', description: 'Sample hero screen' },
];

export default function DevRoutesScreen() {
  if (!IS_DEV) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.prodWarning}>This screen is only available in development mode.</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
        </Pressable>
        <Text style={styles.headerTitle}>DEV Routes</Text>
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>DEV</Text>
        </View>
      </View>
      
      {/* Info */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={COLORS.cream.dark} />
        <Text style={styles.infoText}>
          Tap any route to navigate. This screen verifies all routes are wired correctly.
        </Text>
      </View>
      
      {/* Routes List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {DEV_ROUTES.map((route) => (
          <Pressable
            key={route.path}
            style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}
            onPress={() => router.push(route.path as any)}
          >
            <View style={styles.routeIcon}>
              <Ionicons name={route.icon} size={22} color={COLORS.gold.primary} />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>{route.label}</Text>
              <Text style={styles.routePath}>{route.path}</Text>
              <Text style={styles.routeDesc}>{route.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.cream.dark} />
          </Pressable>
        ))}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  prodWarning: {
    color: COLORS.cream.soft,
    textAlign: 'center',
    marginTop: 100,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navy.light + '40',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.cream.pure,
  },
  devBadge: {
    backgroundColor: COLORS.violet.dark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.violet.light,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    padding: 12,
    backgroundColor: COLORS.navy.medium + '60',
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.cream.dark,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    backgroundColor: COLORS.navy.medium + '40',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.navy.light + '30',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  routeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.navy.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.cream.pure,
  },
  routePath: {
    fontSize: 12,
    color: COLORS.gold.primary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  routeDesc: {
    fontSize: 12,
    color: COLORS.cream.dark,
    marginTop: 2,
  },
});
