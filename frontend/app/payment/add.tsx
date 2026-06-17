/**
 * Tractor Ledger — Record Payment Screen
 *
 * Receives optional farmerId from route params.
 * If no farmerId, shows farmer selector dropdown.
 * Amount input, payment date, notes.
 * Two buttons: "Record & Notify" (WhatsApp) and "Record Only".
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, generateUUID, getTodayISO } from '@/lib/format';
import { openPaymentNotification } from '@/lib/whatsapp';
import { useLanguageStore } from '@/store/useLanguageStore';
import AmountInput from '@/components/AmountInput';
import type { Farmer } from '@/lib/database';

const USER_ID = 'demo-user';

export default function RecordPaymentScreen() {
  const db = useSQLiteContext();
  const { farmerId } = useLocalSearchParams<{ farmerId: string }>();
  const { t } = useLanguageStore();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFarmerPicker, setShowFarmerPicker] = useState(false);
  const [amountError, setAmountError] = useState(false);

  // Load farmers
  useFocusEffect(
    useCallback(() => {
      loadFarmers();
    }, [])
  );

  // Pre-select farmer if farmerId is provided
  useEffect(() => {
    if (farmerId && farmers.length > 0) {
      const farmer = farmers.find((f) => f.id === farmerId);
      if (farmer) {
        setSelectedFarmer(farmer);
      }
    }
  }, [farmerId, farmers]);

  async function loadFarmers() {
    try {
      const result = await db.getAllAsync<Farmer>(
        'SELECT * FROM farmers WHERE user_id = ? AND is_deleted = 0 ORDER BY name',
        [USER_ID]
      );
      setFarmers(result);
    } catch (error) {
      console.error('Failed to load farmers:', error);
    }
  }

  function validate(): boolean {
    let valid = true;

    if (!selectedFarmer) {
      Alert.alert('Required', 'Please select a farmer.');
      return false;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError(true);
      Alert.alert('Required', 'Please enter a valid payment amount.');
      valid = false;
    } else {
      setAmountError(false);
    }

    return valid;
  }

  async function handleSubmit(notify: boolean) {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const id = generateUUID();
      const parsedAmount = parseFloat(amount);

      await db.runAsync(
        `INSERT INTO payments (id, user_id, farmer_id, amount, payment_date, notes, whatsapp_sent, created_at, is_deleted, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), 0, 'pending')`,
        [id, USER_ID, selectedFarmer!.id, parsedAmount, paymentDate, notes.trim() || null]
      );

      // Calculate remaining due for WhatsApp
      if (notify && selectedFarmer) {
        const dueResult = await db.getFirstAsync<{ remaining: number }>(
          `SELECT
            COALESCE((SELECT SUM(total_amount) FROM work_entries WHERE farmer_id = ? AND is_deleted = 0), 0) -
            COALESCE((SELECT SUM(amount) FROM payments WHERE farmer_id = ? AND is_deleted = 0), 0) as remaining`,
          [selectedFarmer.id, selectedFarmer.id]
        );

        await openPaymentNotification(
          selectedFarmer.mobile,
          selectedFarmer.name,
          parsedAmount,
          dueResult?.remaining ?? 0
        );
      }

      Alert.alert(
        '✅ Payment Recorded',
        `${formatIndianCurrency(parsedAmount)} payment from ${selectedFarmer!.name} recorded.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to record payment:', error);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const parsedAmount = parseFloat(amount) || 0;

  return (
    <>
      <Stack.Screen options={{ title: t.recordPayment }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>💰</Text>
            <Text style={styles.headerTitle}>{t.recordPayment}</Text>
            <Text style={styles.headerSubtitle}>{t.recordPaymentSub}</Text>
          </View>

          {/* Farmer Selector */}
          {!farmerId && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.selectFarmer} *</Text>
              <TouchableOpacity
                style={[styles.selector, !selectedFarmer && styles.selectorPlaceholder]}
                onPress={() => setShowFarmerPicker(!showFarmerPicker)}
              >
                <Ionicons
                  name="person"
                  size={22}
                  color={selectedFarmer ? Colors.primary : Colors.textTertiary}
                />
                <Text
                  style={[
                    styles.selectorText,
                    !selectedFarmer && styles.selectorPlaceholderText,
                  ]}
                >
                  {selectedFarmer
                    ? `${selectedFarmer.name} — ${selectedFarmer.village || ''}`
                    : t.selectFarmer}
                </Text>
                <Ionicons
                  name={showFarmerPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
              {showFarmerPicker && (
                <View style={styles.pickerDropdown}>
                  {farmers.length === 0 ? (
                    <Text style={styles.pickerEmpty}>{t.noFarmersFound}</Text>
                  ) : (
                    farmers.map((farmer) => (
                      <TouchableOpacity
                        key={farmer.id}
                        style={[
                          styles.pickerItem,
                          selectedFarmer?.id === farmer.id && styles.pickerItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedFarmer(farmer);
                          setShowFarmerPicker(false);
                        }}
                      >
                        <Text style={styles.pickerItemText}>{farmer.name}</Text>
                        <Text style={styles.pickerItemSub}>{farmer.village}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          )}

          {/* Show selected farmer badge if farmerId was provided */}
          {farmerId && selectedFarmer && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.farmers}</Text>
              <View style={styles.farmerBadge}>
                <Ionicons name="person" size={22} color={Colors.primary} />
                <Text style={styles.farmerBadgeText}>{selectedFarmer.name}</Text>
                {selectedFarmer.village ? (
                  <Text style={styles.farmerBadgeSub}>— {selectedFarmer.village}</Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Amount */}
          <View style={styles.field}>
            <AmountInput
              label={`${t.paymentAmount} *`}
              value={amount}
              onChangeValue={(val) => {
                setAmount(val);
                if (amountError) setAmountError(false);
              }}
              placeholder={t.amount}
              error={amountError}
            />
          </View>

          {/* Payment Date */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.paymentDate}</Text>
            <TouchableOpacity style={styles.dateInput}>
              <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
              <Text style={styles.dateText}>
                {new Date(paymentDate + 'T00:00:00').toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.notes}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t.notes}
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Amount Preview */}
          {parsedAmount > 0 && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>{t.recordPayment}</Text>
              <Text style={styles.previewAmount}>{formatIndianCurrency(parsedAmount)}</Text>
              {selectedFarmer && (
                <Text style={styles.previewFarmer}>{selectedFarmer.name}</Text>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.submitBtn, styles.submitBtnNotify]}
              onPress={() => handleSubmit(true)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={24} color={Colors.white} />
                  <Text style={styles.submitBtnText}>{t.recordAndNotify}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, styles.submitBtnSave]}
              onPress={() => handleSubmit(false)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Ionicons name="save-outline" size={22} color={Colors.success} />
              <Text style={[styles.submitBtnText, styles.submitBtnTextSecondary]}>
                {t.recordOnly}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Layout.screenPaddingHorizontal,
    paddingBottom: 120,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    paddingTop: Spacing.lg,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Fields
  field: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Selector
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
  },
  selectorPlaceholder: {
    borderStyle: 'dashed' as any,
  },
  selectorText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    fontWeight: '500',
  },
  selectorPlaceholderText: {
    color: Colors.textTertiary,
    fontWeight: '400',
  },

  // Picker Dropdown
  pickerDropdown: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
    maxHeight: 200,
    ...Shadows.medium,
  },
  pickerItem: {
    padding: Layout.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerItemSelected: {
    backgroundColor: Colors.primaryBg,
  },
  pickerItemText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  pickerItemSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pickerEmpty: {
    ...Typography.body,
    color: Colors.textTertiary,
    padding: Layout.cardPadding,
    textAlign: 'center',
  },

  // Farmer badge (when pre-selected)
  farmerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryBg,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
  },
  farmerBadgeText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.primary,
  },
  farmerBadgeSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  // Date
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
  },
  dateText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '500',
  },

  // Notes
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    paddingTop: Spacing.md,
    minHeight: 80,
    ...Typography.body,
    color: Colors.text,
    textAlignVertical: 'top',
  },

  // Preview card
  previewCard: {
    backgroundColor: Colors.successBg,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding + 4,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  previewLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  previewAmount: {
    ...Typography.amountLarge,
    color: Colors.success,
    fontSize: 32,
  },
  previewFarmer: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Actions
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    height: Layout.buttonHeight,
    borderRadius: Layout.inputBorderRadius,
    ...Shadows.medium,
  },
  submitBtnNotify: {
    backgroundColor: '#25D366', // WhatsApp green
  },
  submitBtnSave: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
  submitBtnText: {
    ...Typography.button,
    color: Colors.white,
    fontSize: 17,
  },
  submitBtnTextSecondary: {
    color: Colors.success,
  },
});
