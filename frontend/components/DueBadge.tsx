/**
 * DueBadge — Color-coded badge showing outstanding amount
 *
 * Red = amount due, Green = fully paid, Orange = partial payment.
 * Uses monospace bold font for crisp numeric readability.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Layout } from '@/constants/spacing';
import { formatIndianCurrency } from '@/lib/format';

type DueBadgeVariant = 'small' | 'default' | 'large';

interface DueBadgeProps {
  /** The amount to display. Positive = due, zero/negative = paid */
  amount: number;
  /** Optional variant to control the badge size */
  variant?: DueBadgeVariant;
  /** Optional: force a specific color scheme — 'danger' | 'success' | 'warning' */
  colorOverride?: 'danger' | 'success' | 'warning';
}

function getColorScheme(amount: number, colorOverride?: string) {
  if (colorOverride === 'danger') {
    return { bg: Colors.dangerBg, text: Colors.danger };
  }
  if (colorOverride === 'success') {
    return { bg: Colors.successBg, text: Colors.success };
  }
  if (colorOverride === 'warning') {
    return { bg: Colors.warningBg, text: Colors.warning };
  }

  if (amount <= 0) {
    return { bg: Colors.successBg, text: Colors.success };
  }
  return { bg: Colors.dangerBg, text: Colors.danger };
}

const variantStyles = {
  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  default: {
    paddingHorizontal: Layout.badgePaddingHorizontal,
    paddingVertical: Layout.badgePaddingVertical,
    fontSize: 14,
    lineHeight: 20,
  },
  large: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 18,
    lineHeight: 26,
  },
};

export default function DueBadge({ amount, variant = 'default', colorOverride }: DueBadgeProps) {
  const colors = getColorScheme(amount, colorOverride);
  const sizeStyle = variantStyles[variant];

  const label = amount <= 0 ? '✅ Paid' : formatIndianCurrency(amount);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: sizeStyle.fontSize,
            lineHeight: sizeStyle.lineHeight,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Layout.badgeBorderRadius,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: Typography.amountSmall.fontFamily,
    fontWeight: '700',
  },
});
