/**
 * PaymentCard — Displays a single payment entry
 *
 * Shows payment date, amount in green bold, optional farmer name,
 * and optional notes. Green left-border accent, ✅ prefix.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, formatDate } from '@/lib/format';

interface PaymentCardProps {
  /** Date of payment (ISO string or Date) */
  date: string | Date;
  /** Payment amount */
  amount: number;
  /** Optional farmer name to display */
  farmerName?: string | null;
  /** Optional notes about the payment */
  notes?: string | null;
  /** Called when the card is pressed */
  onPress?: () => void;
}

export default function PaymentCard({
  date,
  amount,
  farmerName,
  notes,
  onPress,
}: PaymentCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress && styles.cardPressed,
      ]}
      android_ripple={onPress ? { color: Colors.successBg } : undefined}
    >
      {/* Left accent border — green for payments */}
      <View style={styles.accentBorder} />

      <View style={styles.content}>
        {/* Top row: ✅ label + amount */}
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            <Text style={styles.label}>
              ✅ Payment Received
            </Text>
            {farmerName ? (
              <Text style={styles.farmerName} numberOfLines={1}>
                From: {farmerName}
              </Text>
            ) : null}
          </View>
          <Text style={styles.amount} numberOfLines={1}>
            {formatIndianCurrency(amount)}
          </Text>
        </View>

        {/* Date */}
        <Text style={styles.date}>
          📅 {formatDate(date)}
        </Text>

        {/* Notes (if any) */}
        {notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {notes}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadows.medium,
  },
  cardPressed: {
    backgroundColor: Colors.successBg,
    opacity: 0.95,
  },
  accentBorder: {
    width: 4,
    backgroundColor: Colors.success,
    borderTopLeftRadius: Layout.cardBorderRadius,
    borderBottomLeftRadius: Layout.cardBorderRadius,
  },
  content: {
    flex: 1,
    padding: Layout.cardPadding,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  leftSection: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  label: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  farmerName: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  amount: {
    ...Typography.amount,
    color: Colors.success,
  },
  date: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  notes: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
