/**
 * EmptyState — Friendly placeholder when a list is empty
 *
 * Large emoji icon, bold title, descriptive subtitle,
 * and optional action button with 56px touch target.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';

interface EmptyStateProps {
  /** Large emoji displayed at the top */
  icon: string;
  /** Bold title text */
  title: string;
  /** Descriptive subtitle text */
  subtitle: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Called when the action button is pressed */
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          android_ripple={{ color: Colors.primaryLight }}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['5xl'],
  },
  icon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  button: {
    backgroundColor: Colors.primary,
    height: Layout.buttonHeight,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: Layout.inputBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
    ...Shadows.small,
  },
  buttonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.white,
  },
});
