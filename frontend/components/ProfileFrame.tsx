import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

// Frame definitions based on VIP levels and special unlocks
export const FRAME_DEFINITIONS: { [key: string]: {
  name: string;
  borderColors: string[];
  innerGlow?: string;
  icon?: string;
  requiredVIP?: number;
  special?: boolean;
}} = {
  default: {
    name: 'Basic Frame',
    borderColors: ['#4a5568', '#2d3748'],
  },
  bronze: {
    name: 'Bronze Frame',
    borderColors: ['#cd7f32', '#8b4513'],
    requiredVIP: 1,
  },
  silver: {
    name: 'Silver Frame',
    borderColors: ['#c0c0c0', '#a8a8a8', '#808080'],
    innerGlow: 'rgba(192, 192, 192, 0.3)',
    requiredVIP: 3,
  },
  gold: {
    name: 'Golden Frame',
    borderColors: [COLORS.gold.light, COLORS.gold.primary, COLORS.gold.dark],
    innerGlow: 'rgba(212, 175, 55, 0.3)',
    requiredVIP: 5,
  },
  platinum: {
    name: 'Platinum Frame',
    borderColors: ['#e5e4e2', '#c0c0c0', '#a9a9a9'],
    innerGlow: 'rgba(229, 228, 226, 0.4)',
    requiredVIP: 7,
  },
  diamond: {
    name: 'Diamond Frame',
    borderColors: ['#b9f2ff', '#00bfff', '#1e90ff'],
    innerGlow: 'rgba(0, 191, 255, 0.4)',
    requiredVIP: 9,
  },
  rainbow: {
    name: 'Rainbow Frame',
    borderColors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'],
    innerGlow: 'rgba(255, 255, 255, 0.3)',
    requiredVIP: 11,
  },
  legendary: {
    name: 'Legendary Frame',
    borderColors: ['#ff6b00', '#ff9500', '#ffcc00'],
    innerGlow: 'rgba(255, 107, 0, 0.5)',
    icon: '🔥',
    requiredVIP: 13,
  },
  divine: {
    name: 'Divine Frame',
    borderColors: ['#ffffff', '#ffd700', '#ffffff'],
    innerGlow: 'rgba(255, 255, 255, 0.6)',
    icon: '✨',
    requiredVIP: 15,
  },
  // Special frames from achievements/events
  champion: {
    name: 'Arena Champion',
    borderColors: ['#dc2626', '#b91c1c', '#7f1d1d'],
    innerGlow: 'rgba(220, 38, 38, 0.4)',
    icon: '🏆',
    special: true,
  },
  abyss_conqueror: {
    name: 'Abyss Conqueror',
    borderColors: ['#22c55e', '#16a34a', '#15803d'],
    innerGlow: 'rgba(34, 197, 94, 0.4)',
    icon: '🌀',
    special: true,
  },
  guild_master: {
    name: 'Guild Master',
    borderColors: ['#8b5cf6', '#7c3aed', '#6d28d9'],
    innerGlow: 'rgba(139, 92, 246, 0.4)',
    icon: '⚔️',
    special: true,
  },
  campaign_hero: {
    name: 'Campaign Hero',
    borderColors: ['#3b82f6', '#2563eb', '#1d4ed8'],
    innerGlow: 'rgba(59, 130, 246, 0.4)',
    icon: '📖',
    special: true,
  },
};

interface ProfileFrameProps {
  username: string;
  frameId?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showName?: boolean;
  vipLevel?: number;
  style?: ViewStyle;
}

export default function ProfileFrame({
  username,
  frameId = 'default',
  size = 'medium',
  showName = false,
  vipLevel = 0,
  style,
}: ProfileFrameProps) {
  const frame = FRAME_DEFINITIONS[frameId] || FRAME_DEFINITIONS.default;
  
  // Size configurations
  const sizes = {
    small: { container: 40, avatar: 32, text: 14, border: 3, icon: 10 },
    medium: { container: 56, avatar: 44, text: 18, border: 4, icon: 12 },
    large: { container: 80, avatar: 64, text: 24, border: 5, icon: 16 },
    xlarge: { container: 110, avatar: 90, text: 32, border: 6, icon: 20 },
  };
  
  const sizeConfig = sizes[size];

  return (
    <View style={[styles.wrapper, style]}>
      {/* Outer frame with gradient border */}
      <LinearGradient
        colors={frame.borderColors}
        style={[
          styles.frameOuter,
          {
            width: sizeConfig.container,
            height: sizeConfig.container,
            borderRadius: sizeConfig.container / 2,
            padding: sizeConfig.border,
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Inner glow layer */}
        <View
          style={[
            styles.innerGlow,
            {
              width: sizeConfig.avatar + (sizeConfig.border * 2),
              height: sizeConfig.avatar + (sizeConfig.border * 2),
              borderRadius: (sizeConfig.avatar + (sizeConfig.border * 2)) / 2,
              backgroundColor: frame.innerGlow || 'transparent',
            },
          ]}
        >
          {/* Avatar circle */}
          <LinearGradient
            colors={[COLORS.navy.primary, COLORS.navy.darkest]}
            style={[
              styles.avatarCircle,
              {
                width: sizeConfig.avatar,
                height: sizeConfig.avatar,
                borderRadius: sizeConfig.avatar / 2,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { fontSize: sizeConfig.text },
              ]}
            >
              {username.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>
        
        {/* Frame icon badge */}
        {frame.icon && (
          <View
            style={[
              styles.iconBadge,
              {
                width: sizeConfig.icon * 1.5,
                height: sizeConfig.icon * 1.5,
                borderRadius: sizeConfig.icon,
                bottom: 0,
                right: 0,
              },
            ]}
          >
            <Text style={{ fontSize: sizeConfig.icon }}>{frame.icon}</Text>
          </View>
        )}
      </LinearGradient>
      
      {/* VIP badge */}
      {vipLevel > 0 && size !== 'small' && (
        <View style={styles.vipBadge}>
          <Text style={styles.vipText}>VIP {vipLevel}</Text>
        </View>
      )}
      
      {/* Username below */}
      {showName && (
        <Text style={styles.usernameText} numberOfLines={1}>
          {username}
        </Text>
      )}
    </View>
  );
}

// Helper to get available frames for a VIP level
export function getAvailableFrames(vipLevel: number, unlockedSpecial: string[] = []): string[] {
  const frames: string[] = ['default'];
  
  Object.entries(FRAME_DEFINITIONS).forEach(([id, frame]) => {
    if (frame.special) {
      if (unlockedSpecial.includes(id)) {
        frames.push(id);
      }
    } else if (frame.requiredVIP && vipLevel >= frame.requiredVIP) {
      frames.push(id);
    }
  });
  
  return frames;
}

// Get frame by VIP level (auto-assign highest available)
export function getFrameByVIP(vipLevel: number): string {
  if (vipLevel >= 15) return 'divine';
  if (vipLevel >= 13) return 'legendary';
  if (vipLevel >= 11) return 'rainbow';
  if (vipLevel >= 9) return 'diamond';
  if (vipLevel >= 7) return 'platinum';
  if (vipLevel >= 5) return 'gold';
  if (vipLevel >= 3) return 'silver';
  if (vipLevel >= 1) return 'bronze';
  return 'default';
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  frameOuter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerGlow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.gold.primary,
    fontWeight: 'bold',
  },
  iconBadge: {
    position: 'absolute',
    backgroundColor: COLORS.navy.darkest,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold.primary,
  },
  vipBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.gold.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vipText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.navy.darkest,
  },
  usernameText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.cream.pure,
    maxWidth: 80,
    textAlign: 'center',
  },
});
