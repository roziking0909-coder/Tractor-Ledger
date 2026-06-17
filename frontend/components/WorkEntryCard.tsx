/**
 * WorkEntryCard — Displays a single work entry with details
 *
 * Shows date, farm, work type (with emoji), quantity, total amount,
 * and optional notes. Blue left-border accent, pressable.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, formatDateShort, formatQuantity } from '@/lib/format';

/** Map of work types to emoji icons */
const WORK_TYPE_EMOJI: Record<string, string> = {
  ploughing: '🚜',
  sowing: '🌱',
  harvesting: '🌾',
  transport: '🚛',
  levelling: '⛰️',
  rotavator: '⚙️',
  threshing: '🌿',
  trolley: '🛒',
  other: '🔧',
};

function getWorkEmoji(workType: string): string {
  const key = workType.toLowerCase().trim();
  return WORK_TYPE_EMOJI[key] || '🚜';
}

interface WorkEntryCardProps {
  /** Date of the work (ISO string or Date) */
  date: string | Date;
  /** Name of the farm */
  farmName: string;
  /** Type of work performed */
  workType: string;
  /** Quantity of work */
  quantity: number;
  /** Unit for the quantity (e.g., 'acres', 'hours') */
  unit: string;
  /** Total amount charged */
  totalAmount: number;
  /** Optional notes */
  notes?: string | null;
  /** Called when the card is pressed */
  onPress?: () => void;
}

export default function WorkEntryCard({
  date,
  farmName,
  workType,
  quantity,
  unit,
  totalAmount,
  notes,
  onPress,
}: WorkEntryCardProps) {
  const emoji = getWorkEmoji(workType);
  const displayType = workType.charAt(0).toUpperCase() + workType.slice(1);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress && styles.cardPressed,
      ]}
      android_ripple={onPress ? { color: Colors.primaryBg } : undefined}
    >
      {/* Left accent border */}
      <View style={styles.accentBorder} />

      <View style={styles.content}>
        {/* Top row: work type + date + amount */}
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            <Text style={styles.workType} numberOfLines={1}>
              {emoji} {displayType}
            </Text>
            <Text style={styles.farmName} numberOfLines={1}>
              {farmName}
            </Text>
          </View>
          <View style={styles.rightSection}>
            <Text style={styles.amount} numberOfLines={1}>
              {formatIndianCurrency(totalAmount)}
            </Text>
          </View>
        </View>

        {/* Bottom row: date + quantity */}
        <View style={styles.bottomRow}>
          <Text style={styles.date}>
            📅 {formatDateShort(date)}
          </Text>
          <Text style={styles.quantity}>
            {formatQuantity(quantity, unit)}
          </Text>
        </View>

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
  rightSection: {
    alignItems: 'flex-end',
  },
  workType: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  farmName: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  amount: {
    ...Typography.amount,
    color: Colors.text,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  quantity: {
    ...Typography.label,
    color: Colors.primary,
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
