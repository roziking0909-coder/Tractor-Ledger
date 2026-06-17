/**
 * FarmerCard — Pressable card displaying farmer info with due amount badge
 *
 * Shows farmer name, village, phone, farm count with tractor emoji,
 * and a DueBadge on the right side. Blue accent left border.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatPhone } from '@/lib/format';
import DueBadge from './DueBadge';

interface FarmerCardProps {
  /** Farmer's full name */
  name: string;
  /** Village name */
  village: string;
  /** Phone number (will be formatted for display) */
  phone: string;
  /** Outstanding due amount */
  dueAmount: number;
  /** Number of farms this farmer has */
  farmCount: number;
  /** Called when the card is pressed */
  onPress: () => void;
}

export default function FarmerCard({
  name,
  village,
  phone,
  dueAmount,
  farmCount,
  onPress,
}: FarmerCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      android_ripple={{ color: Colors.primaryBg }}
    >
      {/* Left accent border */}
      <View style={styles.accentBorder} />

      <View style={styles.content}>
        {/* Top row: Name + Due badge */}
        <View style={styles.topRow}>
          <View style={styles.nameSection}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.village} numberOfLines={1}>
              📍 {village}
            </Text>
          </View>
          <DueBadge amount={dueAmount} />
        </View>

        {/* Bottom row: Phone + Farm count */}
        <View style={styles.bottomRow}>
          <Text style={styles.phone} numberOfLines={1}>
            📞 {formatPhone(phone)}
          </Text>
          <Text style={styles.farmCount}>
            🚜 {farmCount} {farmCount === 1 ? 'farm' : 'farms'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    minHeight: 80,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadows.medium,
  },
  cardPressed: {
    backgroundColor: Colors.primaryBg,
    opacity: 0.95,
  },
  accentBorder: {
    width: 4,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: Layout.cardBorderRadius,
    borderBottomLeftRadius: Layout.cardBorderRadius,
  },
  content: {
    flex: 1,
    padding: Layout.cardPadding,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  nameSection: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  name: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.text,
  },
  village: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phone: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  farmCount: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
});
