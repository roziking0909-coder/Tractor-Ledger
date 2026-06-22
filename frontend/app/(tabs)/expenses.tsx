/**
 * Tractor Ledger — Expenses Screen (Tab)
 *
 * Track tractor expenses: diesel, engine oil, repairs, driver wages, other.
 * Top summary cards show monthly expenses, income, and net profit.
 * Filter chips for expense type. FAB to add new expenses.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency } from '@/lib/format';
import { useExpensesStore, type ExpenseType } from '@/store/useExpensesStore';
import { useLanguageStore } from '@/store/useLanguageStore';

import { useAuthStore } from '@/store/useAuthStore';


const EXPENSE_TYPES: { type: ExpenseType | 'all'; icon: string }[] = [
  { type: 'all', icon: '📋' },
  { type: 'diesel', icon: '⛽' },
  { type: 'engine_oil', icon: '🛢️' },
  { type: 'repair', icon: '🔧' },
  { type: 'driver_wages', icon: '👤' },
  { type: 'other', icon: '📝' },
];

function getExpenseIcon(type: ExpenseType): string {
  const icons: Record<ExpenseType, string> = {
    diesel: '⛽',
    engine_oil: '🛢️',
    repair: '🔧',
    driver_wages: '👤',
    other: '📝',
  };
  return icons[type] || '📝';
}

function getExpenseLabel(type: ExpenseType, t: ReturnType<typeof useLanguageStore.getState>['t']): string {
  const labels: Record<ExpenseType, string> = {
    diesel: t.diesel,
    engine_oil: t.engineOil,
    repair: t.repair,
    driver_wages: t.driverWages,
    other: t.other,
  };
  return labels[type] || type;
}

function getFilterLabel(type: ExpenseType | 'all', t: ReturnType<typeof useLanguageStore.getState>['t']): string {
  if (type === 'all') return t.allTypes;
  return getExpenseLabel(type, t);
}

export default function ExpensesScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { t } = useLanguageStore();
  const { expenses, totalThisMonth, isLoading, loadExpenses, addExpense, deleteExpense, getExpensesByType } = useExpensesStore();

  const [filterType, setFilterType] = useState<ExpenseType | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  // Add expense form state
  const [formType, setFormType] = useState<ExpenseType>('diesel');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState('');
  const [formLiters, setFormLiters] = useState('');
  const [formRatePerLiter, setFormRatePerLiter] = useState('');
  const [formCustomType, setFormCustomType] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadExpenses(db, USER_ID);
      loadIncome();
    }, [])
  );

  async function loadIncome() {
    try {
      const incomeResult = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM work_entries WHERE user_id = ? AND is_deleted = 0 AND date LIKE ?`,
        [USER_ID, currentMonth + '%']
      );
      setMonthlyIncome(incomeResult?.total ?? 0);
    } catch (error) {
      console.error('Failed to load income:', error);
    }
  }

  const filteredExpenses = getExpensesByType(filterType);
  const netProfit = monthlyIncome - totalThisMonth;

  // Auto-calculate diesel total
  useEffect(() => {
    if (formType === 'diesel') {
      const liters = parseFloat(formLiters) || 0;
      const rate = parseFloat(formRatePerLiter) || 0;
      setFormAmount((liters * rate).toString());
    }
  }, [formLiters, formRatePerLiter, formType]);

  function resetForm() {
    setFormType('diesel');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAmount('');
    setFormLiters('');
    setFormRatePerLiter('');
    setFormCustomType('');
    setFormNotes('');
  }

  async function handleSaveExpense() {
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Required', 'Please enter a valid amount');
      return;
    }

    await addExpense(db, {
      user_id: USER_ID,
      date: formDate,
      expense_type: formType,
      custom_type: formType === 'other' ? formCustomType : undefined,
      amount,
      quantity: formType === 'diesel' ? parseFloat(formLiters) || undefined : undefined,
      unit: formType === 'diesel' ? 'liters' : undefined,
      rate: formType === 'diesel' ? parseFloat(formRatePerLiter) || undefined : undefined,
      notes: formNotes || undefined,
    });

    setShowAddModal(false);
    resetForm();
    loadIncome();
  }

  function handleDeleteExpense(id: string) {
    Alert.alert(t.delete, t.confirm + '?', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => deleteExpense(db, id, USER_ID),
      },
    ]);
  }

  function formatExpenseDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  // Render expense card
  function renderExpenseItem({ item }: { item: typeof expenses[0] }) {
    return (
      <View style={styles.expenseCard}>
        <View style={styles.expenseCardHeader}>
          <View style={styles.expenseTypeRow}>
            <Text style={styles.expenseIcon}>{getExpenseIcon(item.expense_type)}</Text>
            <View>
              <Text style={styles.expenseTypeName}>
                {item.expense_type === 'other' && item.custom_type
                  ? item.custom_type
                  : getExpenseLabel(item.expense_type, t)}
              </Text>
              <Text style={styles.expenseDate}>{formatExpenseDate(item.date)}</Text>
            </View>
          </View>
          <View style={styles.expenseAmountRow}>
            <Text style={styles.expenseAmount}>{formatIndianCurrency(item.amount)}</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeleteExpense(item.id)}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
        {item.expense_type === 'diesel' && item.quantity && item.rate ? (
          <Text style={styles.expenseDetail}>
            {item.quantity} {t.liters} × {formatIndianCurrency(item.rate)} = {formatIndianCurrency(item.amount)}
          </Text>
        ) : null}
        {item.notes ? (
          <Text style={styles.expenseNotes}>{item.notes}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryExpense]}>
          <Text style={styles.summaryLabel}>{t.totalExpenses}</Text>
          <Text style={[styles.summaryAmount, { color: Colors.danger }]}>
            {formatIndianCurrency(totalThisMonth)}
          </Text>
          <Text style={styles.summaryPeriod}>{t.thisMonth}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryIncome]}>
          <Text style={styles.summaryLabel}>{t.income}</Text>
          <Text style={[styles.summaryAmount, { color: Colors.primary }]}>
            {formatIndianCurrency(monthlyIncome)}
          </Text>
          <Text style={styles.summaryPeriod}>{t.thisMonth}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryProfit]}>
          <Text style={styles.summaryLabel}>{t.netProfit}</Text>
          <Text style={[styles.summaryAmount, { color: netProfit >= 0 ? Colors.success : Colors.danger }]}>
            {formatIndianCurrency(netProfit)}
          </Text>
          <Text style={styles.summaryPeriod}>
            {netProfit >= 0 ? t.profit : t.loss}
          </Text>
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {EXPENSE_TYPES.map((et) => (
          <TouchableOpacity
            key={et.type}
            style={[
              styles.filterChip,
              filterType === et.type && styles.filterChipActive,
            ]}
            onPress={() => setFilterType(et.type)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterType === et.type && styles.filterChipTextActive,
              ]}
            >
              {et.icon} {getFilterLabel(et.type, t)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Expense List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>{t.noData}</Text>
          </View>
        }
      />

      {/* Add Expense FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Add Expense Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.addExpense}</Text>
                <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                  <Ionicons name="close" size={28} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Expense Type Selector */}
              <Text style={styles.modalLabel}>{t.expenseType} *</Text>
              <View style={styles.typeChipsRow}>
                {EXPENSE_TYPES.filter((et) => et.type !== 'all').map((et) => (
                  <TouchableOpacity
                    key={et.type}
                    style={[
                      styles.typeChip,
                      formType === et.type && styles.typeChipActive,
                    ]}
                    onPress={() => setFormType(et.type as ExpenseType)}
                  >
                    <Text style={styles.typeChipIcon}>{et.icon}</Text>
                    <Text
                      style={[
                        styles.typeChipText,
                        formType === et.type && styles.typeChipTextActive,
                      ]}
                    >
                      {getExpenseLabel(et.type as ExpenseType, t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom type input for 'other' */}
              {formType === 'other' && (
                <>
                  <Text style={styles.modalLabel}>{t.customType}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formCustomType}
                    onChangeText={setFormCustomType}
                    placeholder={t.customType}
                    placeholderTextColor={Colors.textTertiary}
                  />
                </>
              )}

              {/* Date */}
              <Text style={styles.modalLabel}>{t.date}</Text>
              <TextInput
                style={styles.modalInput}
                value={formDate}
                onChangeText={setFormDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />

              {/* Diesel-specific inputs */}
              {formType === 'diesel' ? (
                <>
                  <Text style={styles.modalLabel}>{t.liters}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formLiters}
                    onChangeText={setFormLiters}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.modalLabel}>{t.ratePerLiter}</Text>
                  <View style={styles.rateInputRow}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.rateTextInput}
                      value={formRatePerLiter}
                      onChangeText={setFormRatePerLiter}
                      placeholder="0"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.calculatedTotal}>
                    <Text style={styles.calculatedTotalLabel}>{t.total}</Text>
                    <Text style={styles.calculatedTotalAmount}>
                      {formatIndianCurrency(parseFloat(formAmount) || 0)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalLabel}>{t.amount} *</Text>
                  <View style={styles.rateInputRow}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.rateTextInput}
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="0"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="numeric"
                    />
                  </View>
                </>
              )}

              {/* Notes */}
              <Text style={styles.modalLabel}>{t.notes}</Text>
              <TextInput
                style={[styles.modalInput, styles.notesInput]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder={t.notes}
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={2}
              />

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveExpense}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                <Text style={styles.saveBtnText}>{t.save}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.small,
  },
  summaryExpense: {
    borderTopWidth: 3,
    borderTopColor: Colors.danger,
  },
  summaryIncome: {
    borderTopWidth: 3,
    borderTopColor: Colors.primary,
  },
  summaryProfit: {
    borderTopWidth: 3,
    borderTopColor: Colors.success,
  },
  summaryLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  summaryAmount: {
    ...Typography.amountSmall,
    textAlign: 'center',
  },
  summaryPeriod: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Filter Chips
  filterScroll: {
    maxHeight: 56,
  },
  filterContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 40,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  filterChipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Expense List
  listContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingBottom: 100,
    gap: Spacing.sm,
  },
  expenseCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    ...Shadows.small,
  },
  expenseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  expenseIcon: {
    fontSize: 24,
  },
  expenseTypeName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  expenseDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  expenseAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  expenseAmount: {
    ...Typography.amountSmall,
    color: Colors.danger,
  },
  deleteBtn: {
    padding: Spacing.sm,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseDetail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  expenseNotes: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: Layout.fabSize,
    height: Layout.fabSize,
    borderRadius: Layout.fabBorderRadius,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.large,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Layout.screenPaddingHorizontal,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['4xl'],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  modalLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
    ...Typography.body,
    color: Colors.text,
  },
  notesInput: {
    minHeight: 80,
    height: undefined,
    textAlignVertical: 'top',
  },

  // Type chips in modal
  typeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 25,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 48,
    gap: Spacing.sm,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  typeChipIcon: {
    fontSize: 16,
  },
  typeChipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Rate input in modal
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    height: Layout.inputHeight,
    paddingLeft: Layout.inputPaddingHorizontal,
  },
  currencyPrefix: {
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

  // Calculated total
  calculatedTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primaryBg,
    borderRadius: Layout.inputBorderRadius,
    padding: Layout.cardPadding,
    marginTop: Spacing.lg,
  },
  calculatedTotalLabel: {
    ...Typography.h3,
    color: Colors.textSecondary,
  },
  calculatedTotalAmount: {
    ...Typography.amountLarge,
    color: Colors.primary,
  },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    height: Layout.buttonHeight,
    borderRadius: Layout.inputBorderRadius,
    backgroundColor: Colors.primary,
    marginTop: Spacing['2xl'],
    ...Shadows.medium,
  },
  saveBtnText: {
    ...Typography.button,
    color: Colors.white,
    fontSize: 17,
  },
});
