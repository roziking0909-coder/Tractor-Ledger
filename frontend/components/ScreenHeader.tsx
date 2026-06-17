/**
 * ScreenHeader — Reusable top header bar for screens
 *
 * Title + optional subtitle on the left, optional action on the right.
 * 56px height, warm background color.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout } from '@/constants/spacing';

interface ScreenHeaderProps {
  /** Primary title text */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Optional right-side action button label */
  rightLabel?: string;
  /** Optional right-side action button icon (emoji) */
  rightIcon?: string;
  /** Called when the right action button is pressed */
  onRightPress?: () => void;
}

export default function ScreenHeader({
  title,
  subtitle,
  rightLabel,
  rightIcon,
  onRightPress,
}: ScreenHeaderProps) {
  const hasRightAction = (rightLabel || rightIcon) && onRightPress;

  return (
    <View style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {hasRightAction ? (
        <Pressable
          onPress={onRightPress}
          style={({ pressed }) => [
            styles.rightButton,
            pressed && styles.rightButtonPressed,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {rightIcon ? (
            <Text style={styles.rightIcon}>{rightIcon}</Text>
          ) : null}
          {rightLabel ? (
            <Text style={styles.rightLabel}>{rightLabel}</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: Layout.headerHeight,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingHorizontal,
  },
  titleSection: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  rightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Spacing.sm,
    gap: Spacing.xs,
  },
  rightButtonPressed: {
    backgroundColor: Colors.primaryBg,
  },
  rightIcon: {
    fontSize: 20,
  },
  rightLabel: {
    ...Typography.label,
    color: Colors.primary,
  },
});
