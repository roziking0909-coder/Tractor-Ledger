/**
 * SyncIndicator — Small status indicator for header area
 *
 * Green dot = Synced, Yellow spinning dot = Syncing, Red dot = Offline.
 * Compact design that sits unobtrusively in the header.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

type SyncStatus = 'synced' | 'syncing' | 'offline';

interface SyncIndicatorProps {
  /** Current sync status */
  status: SyncStatus;
}

const STATUS_CONFIG: Record<SyncStatus, { color: string; label: string }> = {
  synced: { color: Colors.synced, label: 'Synced' },
  syncing: { color: Colors.syncing, label: 'Syncing...' },
  offline: { color: Colors.offline, label: 'Offline' },
};

export default function SyncIndicator({ status }: SyncIndicatorProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'syncing') {
      const animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [status, spinAnim]);

  const config = STATUS_CONFIG[status];

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: config.color },
          status === 'syncing' && { transform: [{ rotate: spin }] },
        ]}
      >
        {status === 'syncing' && (
          <View style={styles.spinnerCutout} />
        )}
      </Animated.View>
      <Text style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

const DOT_SIZE = 10;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    overflow: 'hidden',
  },
  spinnerCutout: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: DOT_SIZE / 2,
    height: DOT_SIZE / 2,
    backgroundColor: Colors.background,
    borderBottomLeftRadius: DOT_SIZE / 2,
  },
  label: {
    ...Typography.labelSmall,
  },
});
