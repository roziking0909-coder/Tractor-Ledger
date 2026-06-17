/**
 * AmountInput — Large numeric input with ₹ prefix
 *
 * Auto-formats input in Indian number format (1,23,456).
 * 28px monospace bold font for clear amount entry.
 * Red border in error state.
 */

import React, { useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout } from '@/constants/spacing';
import { formatIndianNumber } from '@/lib/format';

interface AmountInputProps {
  /** Current numeric value (raw number, not formatted) */
  value: string;
  /** Called with the raw numeric string (digits and at most one decimal point) */
  onChangeValue: (rawValue: string) => void;
  /** Placeholder text shown when empty */
  placeholder?: string;
  /** Shows red error border when true */
  error?: boolean;
  /** Optional label above the input */
  label?: string;
  /** Whether the input is editable */
  editable?: boolean;
}

/**
 * Strip non-numeric chars (except decimal point) from a string.
 * Ensures only one decimal point and at most 2 decimal places.
 */
function sanitizeNumericInput(text: string): string {
  // Remove everything except digits and dots
  let cleaned = text.replace(/[^0-9.]/g, '');

  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  // Limit decimal places to 2
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + '.' + parts[1].slice(0, 2);
  }

  return cleaned;
}

/**
 * Format a raw numeric string for display in Indian format (without ₹).
 */
function formatForDisplay(raw: string): string {
  if (!raw || raw === '') return '';

  // If the user is typing a decimal point or trailing zero after decimal,
  // preserve it as-is so they can keep typing
  if (raw.endsWith('.') || (raw.includes('.') && raw.endsWith('0'))) {
    const parts = raw.split('.');
    const num = parseFloat(parts[0] || '0');
    const intFormatted = formatIndianNumber(num);
    return `${intFormatted}.${parts[1]}`;
  }

  const num = parseFloat(raw);
  if (isNaN(num)) return '';
  return formatIndianNumber(num);
}

export default function AmountInput({
  value,
  onChangeValue,
  placeholder = '0',
  error = false,
  label,
  editable = true,
}: AmountInputProps) {
  const handleChangeText = useCallback(
    (text: string) => {
      // Strip formatting, keep raw digits + decimal
      const raw = sanitizeNumericInput(text);
      onChangeValue(raw);
    },
    [onChangeValue]
  );

  const displayValue = formatForDisplay(value);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.container,
          error && styles.containerError,
          !editable && styles.containerDisabled,
        ]}
      >
        <Text style={[styles.currencySymbol, error && styles.currencySymbolError]}>
          ₹
        </Text>
        <TextInput
          style={styles.input}
          value={displayValue}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          keyboardType="numeric"
          editable={editable}
          selectTextOnFocus
          maxLength={15}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.inputHeight,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Layout.inputBorderRadius,
    backgroundColor: Colors.surface,
    paddingHorizontal: Layout.inputPaddingHorizontal,
  },
  containerError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  containerDisabled: {
    backgroundColor: Colors.divider,
    opacity: 0.7,
  },
  currencySymbol: {
    fontFamily: Typography.amountLarge.fontFamily,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: Spacing.sm,
  },
  currencySymbolError: {
    color: Colors.danger,
  },
  input: {
    flex: 1,
    fontFamily: Typography.amountLarge.fontFamily,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: Platform.OS === 'android' ? Spacing.sm : Spacing.md,
    // Remove default underline on Android
    ...Platform.select({
      android: { textAlignVertical: 'center' },
    }),
  },
});
