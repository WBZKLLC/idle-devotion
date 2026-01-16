// /app/frontend/components/ui/Skeleton.tsx
// Phase 3.19.1: Lightweight shimmer/pulse skeleton component

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  variant?: 'rect' | 'circle' | 'text';
}

/**
 * Skeleton placeholder component with subtle pulse animation.
 * Composable: <Skeleton w={120} h={16} r={8} />
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
  variant = 'rect',
}: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const computedRadius = variant === 'circle' ? (typeof height === 'number' ? height / 2 : 50) : radius;
  const computedWidth = variant === 'circle' ? height : width;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: computedWidth as number | `${number}%`,
          height,
          borderRadius: computedRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

// =============================================================================
// PREBUILT SKELETON COMPOSITIONS
// =============================================================================

/** Hero card skeleton for grid views */
export function HeroCardSkeleton() {
  return (
    <View style={skeletonStyles.heroCard}>
      <Skeleton width="100%" height={80} radius={10} />
      <View style={skeletonStyles.heroCardInfo}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="50%" height={10} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** Hero detail header skeleton */
export function HeroDetailHeaderSkeleton() {
  return (
    <View style={skeletonStyles.heroDetailHeader}>
      <Skeleton width={180} height={250} radius={16} />
      <View style={skeletonStyles.heroDetailStars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width={14} height={14} variant="circle" style={{ marginHorizontal: 2 }} />
        ))}
      </View>
    </View>
  );
}

/** Banner skeleton for summon screens */
export function BannerSkeleton() {
  return (
    <View style={skeletonStyles.banner}>
      <Skeleton width="100%" height={160} radius={16} />
      <View style={skeletonStyles.bannerInfo}>
        <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
        <Skeleton width="80%" height={14} />
      </View>
    </View>
  );
}

/** Stage/chapter card skeleton */
export function StageCardSkeleton() {
  return (
    <View style={skeletonStyles.stageCard}>
      <Skeleton width={56} height={56} variant="circle" />
      <View style={skeletonStyles.stageInfo}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="70%" height={16} style={{ marginTop: 4 }} />
        <Skeleton width="50%" height={10} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

/** Guild list item skeleton */
export function GuildItemSkeleton() {
  return (
    <View style={skeletonStyles.guildItem}>
      <Skeleton width={40} height={40} variant="circle" />
      <View style={skeletonStyles.guildInfo}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={10} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

/** Grid skeleton - renders multiple hero card skeletons */
export function HeroGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={skeletonStyles.heroGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={skeletonStyles.heroGridItem}>
          <HeroCardSkeleton />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

const skeletonStyles = StyleSheet.create({
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 8,
    width: '100%',
  },
  heroCardInfo: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  heroDetailHeader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  heroDetailStars: {
    flexDirection: 'row',
    marginTop: 12,
  },
  banner: {
    marginBottom: 16,
  },
  bannerInfo: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  stageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  stageInfo: {
    flex: 1,
    marginLeft: 16,
  },
  guildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  guildInfo: {
    flex: 1,
    marginLeft: 12,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  heroGridItem: {
    width: '31%',
    marginBottom: 12,
  },
});

export default Skeleton;
