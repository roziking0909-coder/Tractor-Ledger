/**
 * Tractor Ledger — Add Work Screen (Standalone)
 *
 * Full work entry form that accepts optional farmerId and farmId
 * from route params to pre-select farmer and farm.
 * Same functionality as the tab work screen but navigable from farmer detail.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import { openWorkNotification } from '@/lib/whatsapp';
import { WORK_TYPES, QUANTITY_UNITS } from '@/lib/database';
import type { Farmer, Farm } from '@/lib/database';

import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';


function getWorkTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    Ploughing: '🚜',
    Rotavator: '⚙️',
    Seeding: '🌱',
    Cultivation: '🌾',
    Harvesting: '🌻',
    Other: '📋',
  };
  return emojis[type] || '📋';
}

export default function AddWorkScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { farmerId, farmId } = useLocalSearchParams<{ farmerId?: string; farmId?: string }>();
  const { t } = useLanguageStore();

  // Form state
  const [date, setDate] = useState(getTodayISO());
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [workType, setWorkType] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<string>('acres');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFarmerPicker, setShowFarmerPicker] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');

  // Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setDate(`${y}-${m}-${d}`);
    }
  };

  // Auto-calculate total
  const total = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    if (quantityUnit === 'minutes') {
      return (q / 60) * r;
    }
    return q * r;
  }, [quantity, rate, quantityUnit]);

  // Load farmers on focus
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

  // Load farms when farmer changes
  useEffect(() => {
    if (selectedFarmer) {
      loadFarms(selectedFarmer.id);
    } else {
      setFarms([]);
      setSelectedFarm(null);
    }
  }, [selectedFarmer]);

  // Pre-select farm if farmId is provided
  useEffect(() => {
    if (farmId && farms.length > 0) {
      const farm = farms.find((f) => f.id === farmId);
      if (farm) {
        setSelectedFarm(farm);
      }
    }
  }, [farmId, farms]);

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

  async function loadFarms(fId: string) {
    try {
      const result = await db.getAllAsync<Farm>(
        'SELECT * FROM farms WHERE farmer_id = ? AND is_deleted = 0 ORDER BY name',
        [fId]
      );
      setFarms(result);
      // Auto-select if only one farm
      if (result.length === 1) {
        setSelectedFarm(result[0]);
      }
    } catch (error) {
      console.error('Failed to load farms:', error);
    }
  }

  function validate(): boolean {
    if (!selectedFarmer) {
      Alert.alert('⚠️', t.selectFarmer);
      return false;
    }
    if (!workType) {
      Alert.alert('⚠️', t.workType);
      return false;
    }
    if (!rate || parseFloat(rate) <= 0) {
      Alert.alert('⚠️', t.rate);
      return false;
    }
    if (total <= 0) {
      Alert.alert('⚠️', t.total);
      return false;
    }
    return true;
  }

  async function handleSubmit(notify: boolean) {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const id = generateUUID();
      const farmNameToSave = selectedFarm?.name || '';
      // When minutes is selected, store quantity as hours for consistent calculations
      const storedQuantity = quantityUnit === 'minutes'
        ? (parseFloat(quantity) || 0) / 60
        : parseFloat(quantity) || 0;
      const discountVal = parseFloat(discountAmount || '0');
      await db.runAsync(
        `INSERT INTO work_entries (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, discount_amount, notes, whatsapp_sent, created_at, is_deleted, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), 0, 'pending')`,
        [
          id, USER_ID, selectedFarmer!.id, farmNameToSave || null,
          date, workType, storedQuantity, quantityUnit,
          parseFloat(rate), total, discountVal, notes || null,
        ]
      );

      // Calculate current due for WhatsApp message (subtract all discounts)
      if (notify && selectedFarmer) {
        const dueResult = await db.getFirstAsync<{ due: number }>(
          `SELECT
            COALESCE(SUM(CASE WHEN w.id IS NOT NULL THEN w.total_amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN w.id IS NOT NULL THEN w.discount_amount ELSE 0 END), 0) -
            COALESCE((SELECT SUM(p.amount) + SUM(COALESCE(p.discount_amount, 0)) FROM payments p WHERE p.farmer_id = ? AND p.is_deleted = 0), 0) as due
           FROM work_entries w WHERE w.farmer_id = ? AND w.is_deleted = 0`,
          [selectedFarmer.id, selectedFarmer.id]
        );

        await openWorkNotification(
          selectedFarmer.mobile,
          selectedFarmer.name,
          selectedFarm?.name || '',
          workType,
          total,
          dueResult?.due ?? total,
          discountVal
        );
        await db.runAsync('UPDATE work_entries SET whatsapp_sent = 1 WHERE id = ?', [id]);
      }

      Alert.alert(
        '✅ Work Added',
        `${workType} — ${formatIndianCurrency(total)} added for ${selectedFarmer!.name}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to add work entry:', error);
      Alert.alert('Error', 'Failed to add work entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t.addWork }} />
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
          {/* Date */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.date}</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
              <Text style={styles.dateText}>
                {new Date(date + 'T00:00:00').toLocaleDateString('gu-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(date + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Farmer Selector */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.farmerName} *</Text>
            {farmerId && selectedFarmer ? (
              <View style={styles.farmerBadge}>
                <Ionicons name="person" size={22} color={Colors.primary} />
                <Text style={styles.farmerBadgeText}>{selectedFarmer.name}</Text>
                {selectedFarmer.village ? (
                  <Text style={styles.farmerBadgeSub}>— {selectedFarmer.village}</Text>
                ) : null}
              </View>
            ) : (
              <>
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
                      <Text style={styles.pickerEmpty}>{t.noFarmerFound}</Text>
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
                            setSelectedFarm(null);
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
              </>
            )}
          </View>

          {/* Farm Selector */}
          {selectedFarmer && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.farmName}</Text>
              <TouchableOpacity
                style={[styles.selector, !selectedFarm && styles.selectorPlaceholder]}
                onPress={() => setShowFarmPicker(!showFarmPicker)}
              >
                <Ionicons
                  name="leaf"
                  size={22}
                  color={selectedFarm ? Colors.success : Colors.textTertiary}
                />
                <Text
                  style={[
                    styles.selectorText,
                    !selectedFarm && styles.selectorPlaceholderText,
                  ]}
                >
                  {selectedFarm
                    ? `${selectedFarm.name} — ${selectedFarm.area_acres || ''} acres`
                    : t.farmName}
                </Text>
                <Ionicons
                  name={showFarmPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
              {showFarmPicker && (
                <View style={styles.pickerDropdown}>
                  {farms.length === 0 ? (
                    <Text style={styles.pickerEmpty}>{t.noFarmsYet}</Text>
                  ) : (
                    farms.map((farm) => (
                      <TouchableOpacity
                        key={farm.id}
                        style={[
                          styles.pickerItem,
                          selectedFarm?.id === farm.id && styles.pickerItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedFarm(farm);
                          setShowFarmPicker(false);
                        }}
                      >
                        <Text style={styles.pickerItemText}>{farm.name}</Text>
                        <Text style={styles.pickerItemSub}>
                          {farm.area_acres ? `${farm.area_acres} acres` : farm.location}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          )}

          {/* Work Type */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.workType} *</Text>
            <View style={styles.workTypeGrid}>
              {WORK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.workTypeChip,
                    workType === type && styles.workTypeChipSelected,
                  ]}
                  onPress={() => setWorkType(type)}
                >
                  <Text
                    style={[
                      styles.workTypeText,
                      workType === type && styles.workTypeTextSelected,
                    ]}
                  >
                    {getWorkTypeEmoji(type)} {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quantity & Unit */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.quantity}</Text>
            <View style={styles.quantityRow}>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0.0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <View style={styles.unitToggle}>
                {QUANTITY_UNITS.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.unitBtn,
                      quantityUnit === unit && styles.unitBtnSelected,
                    ]}
                    onPress={() => setQuantityUnit(unit)}
                  >
                    <Text
                      style={[
                        styles.unitBtnText,
                        quantityUnit === unit && styles.unitBtnTextSelected,
                      ]}
                    >
                      {unit === 'acres' ? t.acres : unit === 'minutes' ? t.minutes : t.hours}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {quantityUnit === 'minutes' && quantity ? (
              <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 4, marginLeft: 4 }}>
                = {(parseFloat(quantity) / 60).toFixed(2)} {t.hours}
              </Text>
            ) : null}
          </View>

          {/* Rate */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.rate} (/{quantityUnit === 'acres' ? t.acres : t.hours}) *</Text>
            <View style={styles.rateInput}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.rateTextInput}
                value={rate}
                onChangeText={setRate}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Total Display */}
          <View style={styles.totalContainer}>
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.total}</Text>
              <Text style={[styles.totalAmount, total > 0 && styles.totalAmountActive]}>
                {formatIndianCurrency(total)}
              </Text>
            </View>
          </View>

          {/* Discount Section — optional, collapsed by default */}
          <TouchableOpacity
            onPress={() => setShowDiscount(!showDiscount)}
            style={styles.discountToggle}
          >
            <Ionicons
              name={showDiscount ? 'remove-circle-outline' : 'add-circle-outline'}
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.discountToggleText}>
              {showDiscount ? 'ડિસ્કાઉન્ટ દૂર કરો' : '+ ડિસ્કાઉન્ટ આપો (વૈકલ્પિક)'}
            </Text>
          </TouchableOpacity>

          {showDiscount && (
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>ડિસ્કાઉન્ટ ₹</Text>
              <TextInput
                style={styles.discountInput}
                value={discountAmount}
                onChangeText={(t) => setDiscountAmount(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                maxLength={6}
              />
            </View>
          )}

          {/* Net total — only show when discount > 0 */}
          {showDiscount && parseFloat(discountAmount || '0') > 0 && (
            <View style={styles.netTotalRow}>
              <Text style={styles.netTotalLabel}>અંતિમ રકમ</Text>
              <Text style={styles.netTotalAmount}>
                {formatIndianCurrency(total - parseFloat(discountAmount || '0'))}
              </Text>
            </View>
          )}

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.notes}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={2}
            />
          </View>

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
                  <Text style={styles.submitBtnText}>{t.addWork} & WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, styles.submitBtnSave]}
              onPress={() => handleSubmit(false)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Ionicons name="save-outline" size={22} color={Colors.primary} />
              <Text style={[styles.submitBtnText, styles.submitBtnTextSecondary]}>
                {t.addWork}
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

  // Date
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
  },
  dateText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '500',
  },

  // Farmer badge (pre-selected)
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

  // Work Type Grid
  workTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  workTypeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 25,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  workTypeChipSelected: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  workTypeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  workTypeTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Quantity
  quantityRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
    ...Typography.amount,
    color: Colors.text,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: Layout.inputBorderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitBtn: {
    paddingHorizontal: Spacing.lg,
    height: Layout.inputHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  unitBtnSelected: {
    backgroundColor: Colors.primary,
  },
  unitBtnText: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  unitBtnTextSelected: {
    color: Colors.white,
  },

  // Rate
  rateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    height: Layout.inputHeight,
    paddingLeft: Layout.inputPaddingHorizontal,
  },
  currencySymbol: {
    ...Typography.amount,
    color: Colors.primary,
    marginRight: Spacing.sm,
  },
  rateTextInput: {
    flex: 1,
    height: '100%',
    ...Typography.amount,
    color: Colors.text,
    paddingRight: Layout.inputPaddingHorizontal,
  },

  // Total
  totalContainer: {
    marginBottom: Spacing.lg,
  },
  totalDivider: {
    height: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding + 4,
    ...Shadows.medium,
  },
  totalLabel: {
    ...Typography.h3,
    color: Colors.textSecondary,
  },
  totalAmount: {
    ...Typography.amountLarge,
    color: Colors.textTertiary,
  },
  totalAmountActive: {
    color: Colors.primary,
  },

  // Notes
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    minHeight: 80,
    ...Typography.body,
    color: Colors.text,
    textAlignVertical: 'top',
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
    borderColor: Colors.primary,
  },
  submitBtnText: {
    ...Typography.button,
    color: Colors.white,
    fontSize: 17,
  },
  submitBtnTextSecondary: {
    color: Colors.primary,
  },

  // Discount
  discountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  discountToggleText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '500',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.warningBg,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Layout.inputPaddingHorizontal,
    marginBottom: Spacing.sm,
  },
  discountLabel: {
    ...Typography.body,
    color: Colors.warning,
    fontWeight: '600',
  },
  discountInput: {
    flex: 1,
    ...Typography.amount,
    color: Colors.warning,
    height: 44,
    paddingHorizontal: Spacing.sm,
  },
  netTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.successBg,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  netTotalLabel: {
    ...Typography.body,
    color: Colors.success,
    fontWeight: '600',
  },
  netTotalAmount: {
    ...Typography.amountLarge,
    color: Colors.success,
  },
});
