import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../stores/gameStore';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const { user, userHeroes } = useGameStore();
  const [slideAnim] = useState(new Animated.Value(width * 0.8));
  const [heroShards, setHeroShards] = useState<any[]>([]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      loadHeroShards();
    } else {
      Animated.timing(slideAnim, {
        toValue: width * 0.8,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadHeroShards = () => {
    // Calculate hero shards (duplicates)
    const shards = userHeroes
      .filter(h => h.duplicates > 0)
      .map(h => ({
        name: h.hero_data?.name,
        rarity: h.hero_data?.rarity,
        shards: h.duplicates,
      }));
    setHeroShards(shards);
  };

  if (!visible && slideAnim._value === width * 0.8) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.sidebar,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FF1493', '#9400D3', '#4B0082']}
            style={styles.sidebarContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Account Bag</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent}>
              {/* Resources Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💰 Resources</Text>
                
                <View style={styles.resourceItem}>
                  <Ionicons name="diamond" size={24} color="#FF69B4" />
                  <Text style={styles.resourceLabel}>Gems</Text>
                  <Text style={styles.resourceValue}>{user?.gems || 0}</Text>
                </View>

                <View style={styles.resourceItem}>
                  <Ionicons name="cash" size={24} color="#FFD700" />
                  <Text style={styles.resourceLabel}>Coins</Text>
                  <Text style={styles.resourceValue}>{user?.coins || 0}</Text>
                </View>

                <View style={styles.resourceItem}>
                  <Ionicons name="star" size={24} color="#FFA500" />
                  <Text style={styles.resourceLabel}>Gold</Text>
                  <Text style={styles.resourceValue}>{user?.gold || 0}</Text>
                </View>

                <View style={styles.resourceItem}>
                  <Ionicons name="heart" size={24} color="#FF1493" />
                  <Text style={styles.resourceLabel}>Friendship Points</Text>
                  <Text style={styles.resourceValue}>{user?.friendship_points || 0}</Text>
                </View>
              </View>

              {/* Hero Shards Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✨ Hero Shards</Text>
                
                {heroShards.length === 0 ? (
                  <Text style={styles.emptyText}>No hero shards yet</Text>
                ) : (
                  heroShards.map((shard, index) => (
                    <View key={index} style={styles.shardItem}>
                      <View style={styles.shardInfo}>
                        <Text style={styles.shardName}>{shard.name}</Text>
                        <Text style={[
                          styles.shardRarity,
                          { color: getRarityColor(shard.rarity) }
                        ]}>
                          {shard.rarity}
                        </Text>
                      </View>
                      <Text style={styles.shardCount}>x{shard.shards}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Stats Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 Stats</Text>
                
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Heroes</Text>
                  <Text style={styles.statValue}>{userHeroes.length}</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Pulls</Text>
                  <Text style={styles.statValue}>{user?.total_pulls || 0}</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Login Days</Text>
                  <Text style={styles.statValue}>{user?.login_days || 0}</Text>
                </View>
              </View>
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const getRarityColor = (rarity: string) => {
  const colors: { [key: string]: string } = {
    'SR': '#4CAF50',
    'SSR': '#9C27B0',
    'UR': '#FF9800',
    'UR+': '#F44336',
  };
  return colors[rarity] || '#FFF';
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: width * 0.8,
    maxWidth: 350,
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  sidebarContent: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  resourceLabel: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    marginLeft: 12,
    fontWeight: '600',
  },
  resourceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 20,
  },
  shardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  shardInfo: {
    flex: 1,
  },
  shardName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 2,
  },
  shardRarity: {
    fontSize: 12,
    fontWeight: '600',
  },
  shardCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
