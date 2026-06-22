/**
 * Reports Screen
 *
 * Farmer selector dropdown → shows full ledger with work entries, payments,
 * and a financial summary. Supports PDF export via expo-print + expo-sharing.
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, formatDate, formatPhone, generateUUID, getTodayISO } from '@/lib/format';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useFarmersStore } from '@/store/useFarmersStore';
import { useWorkStore } from '@/store/useWorkStore';
import { usePaymentsStore } from '@/store/usePaymentsStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import WorkEntryCard from '@/components/WorkEntryCard';
import PaymentCard from '@/components/PaymentCard';
import EmptyState from '@/components/EmptyState';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

import { useAuthStore } from '@/store/useAuthStore';


export default function ReportsScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { farmers, loadFarmers } = useFarmersStore();
  const { workEntries, isLoading: workLoading, loadWorkEntries } = useWorkStore();
  const { payments, isLoading: paymentsLoading, loadPayments } = usePaymentsStore();
  const { t } = useLanguageStore();

  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const selectedFarmer = useMemo(
    () => farmers.find((f) => f.id === selectedFarmerId) ?? null,
    [farmers, selectedFarmerId]
  );

  // Load farmers on focus
  useFocusEffect(
    useCallback(() => {
      loadFarmers(db, USER_ID);
    }, [db])
  );

  // Load work entries and payments when farmer is selected
  const handleSelectFarmer = useCallback(
    async (farmerId: string) => {
      setSelectedFarmerId(farmerId);
      setShowDropdown(false);
      await Promise.all([
        loadWorkEntries(db, USER_ID, { farmerId }),
        loadPayments(db, USER_ID, farmerId),
      ]);
    },
    [db]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedFarmerId(null);
  }, []);

  // Compute summary
  const summary = useMemo(() => {
    const totalWork = workEntries.reduce((sum, w) => sum + w.total_amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      totalWork,
      totalPaid,
      remainingDue: totalWork - totalPaid,
    };
  }, [workEntries, payments]);

  const isLoading = workLoading || paymentsLoading;

  // Generate PDF HTML
  const generatePdfHtml = useCallback((): string => {
    if (!selectedFarmer) return '';

    const workRows = workEntries
      .map(
        (w) => `
      <tr>
        <td>${formatDate(w.date)}</td>
        <td>${w.farm_name || '—'}</td>
        <td>${w.work_type}</td>
        <td style="text-align:center">${w.quantity || '—'} ${w.quantity_unit || ''}</td>
        <td style="text-align:right">₹${w.rate.toLocaleString('en-IN')}</td>
        <td style="text-align:right; font-weight:600">${formatIndianCurrency(w.total_amount)}</td>
      </tr>`
      )
      .join('');

    const paymentRows = payments
      .map(
        (p) => `
      <tr>
        <td>${formatDate(p.payment_date)}</td>
        <td style="text-align:right; font-weight:600; color:#2E7D32">${formatIndianCurrency(p.amount)}</td>
        <td>${p.notes || '—'}</td>
      </tr>`
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans Gujarati', -apple-system, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1A1A1A;
      padding: 24px;
      background: #fff;
    }

    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #1B6CA8;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 22px;
      color: #1B6CA8;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #616161;
    }

    .farmer-info {
      background: #F5F5F0;
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .farmer-info .label { font-size: 11px; color: #616161; text-transform: uppercase; letter-spacing: 0.5px; }
    .farmer-info .value { font-size: 15px; font-weight: 600; margin-top: 2px; }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #1B6CA8;
      border-bottom: 2px solid #E8F2F9;
      padding-bottom: 6px;
      margin-bottom: 12px;
      margin-top: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    th {
      background: #1B6CA8;
      color: white;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #E0E0E0;
    }
    tr:nth-child(even) { background: #FAFAFA; }
    tr:hover { background: #F0F6FB; }

    .summary-box {
      background: linear-gradient(135deg, #E8F2F9, #F5F5F0);
      border: 2px solid #1B6CA8;
      border-radius: 10px;
      padding: 20px;
      margin-top: 24px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0,0,0,0.06);
      font-size: 14px;
    }
    .summary-row:last-child {
      border-bottom: none;
      font-size: 18px;
      font-weight: 700;
      padding-top: 12px;
      margin-top: 4px;
      border-top: 2px solid #1B6CA8;
      color: ${summary.remainingDue > 0 ? '#C62828' : '#2E7D32'};
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #E0E0E0;
      font-size: 11px;
      color: #9E9E9E;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚜 Tractor Ledger</h1>
    <div class="subtitle">ખેડૂત ખાતાવહી — ${formatDate(new Date())}</div>
  </div>

  <div class="farmer-info">
    <div>
      <div class="label">ખેડૂતનું નામ</div>
      <div class="value">${selectedFarmer.name}</div>
    </div>
    <div>
      <div class="label">ગામ</div>
      <div class="value">${selectedFarmer.village || '—'}</div>
    </div>
    <div>
      <div class="label">ફોન</div>
      <div class="value">${formatPhone(selectedFarmer.mobile)}</div>
    </div>
  </div>

  <div class="section-title">📋 કામની નોંધ (${workEntries.length})</div>
  ${
    workEntries.length > 0
      ? `<table>
    <thead>
      <tr>
        <th>તારીખ</th>
        <th>ખેતર</th>
        <th>કામનો પ્રકાર</th>
        <th style="text-align:center">જથ્થો</th>
        <th style="text-align:right">ભાવ</th>
        <th style="text-align:right">રકમ</th>
      </tr>
    </thead>
    <tbody>${workRows}</tbody>
  </table>`
      : '<p style="color:#616161; padding:12px 0;">કોઈ કામની નોંધ નથી.</p>'
  }

  <div class="section-title">💰 ચૂકવણી (${payments.length})</div>
  ${
    payments.length > 0
      ? `<table>
    <thead>
      <tr>
        <th>તારીખ</th>
        <th style="text-align:right">રકમ</th>
        <th>નોંધ</th>
      </tr>
    </thead>
    <tbody>${paymentRows}</tbody>
  </table>`
      : '<p style="color:#616161; padding:12px 0;">કોઈ ચૂકવણી નોંધાયેલ નથી.</p>'
  }

  <div class="summary-box">
    <div class="summary-row">
      <span>કુલ કામ</span>
      <span>${formatIndianCurrency(summary.totalWork)}</span>
    </div>
    <div class="summary-row">
      <span>કુલ ચૂકવ્યું</span>
      <span style="color:#2E7D32">${formatIndianCurrency(summary.totalPaid)}</span>
    </div>
    <div class="summary-row">
      <span>બાકી</span>
      <span>${formatIndianCurrency(summary.remainingDue)}</span>
    </div>
  </div>

  <div class="footer">
    Generated by Tractor Ledger App • ${formatDate(new Date())}
  </div>
</body>
</html>`;
  }, [selectedFarmer, workEntries, payments, summary]);

  // Export PDF
  const handleExportPdf = useCallback(async () => {
    if (!selectedFarmer) return;
    setIsPdfLoading(true);
    try {
      const html = generatePdfHtml();
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      await shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Ledger — ${selectedFarmer.name}`,
      });
    } catch (error) {
      console.error('PDF export error:', error);
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    } finally {
      setIsPdfLoading(false);
    }
  }, [selectedFarmer, generatePdfHtml]);

  return (
    <View style={styles.container}>
      {/* Farmer Selector Dropdown */}
      <View style={styles.selectorContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.selectorButton,
            pressed && styles.selectorButtonPressed,
          ]}
          onPress={() => setShowDropdown(true)}
          android_ripple={{ color: Colors.primaryBg }}
        >
          <Ionicons name="person" size={22} color={Colors.primary} />
          <Text
            style={[
              styles.selectorText,
              !selectedFarmer && styles.selectorPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedFarmer ? selectedFarmer.name : `${t.selectFarmer}...`}
          </Text>
          <Ionicons name="chevron-down" size={22} color={Colors.textSecondary} />
        </Pressable>

        {selectedFarmer && (
          <View style={styles.selectedActions}>
            <Pressable
              onPress={handleClearSelection}
              style={styles.clearSelectionButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
              <Text style={styles.clearSelectionText}>{t.clearSearch}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Main Content */}
      {!selectedFarmer ? (
        <EmptyState
          icon="📊"
          title={t.selectAFarmer}
          subtitle={t.selectFarmerSub}
        />
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t.loadingLedger}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Farmer Info Card */}
          <View style={styles.farmerInfoCard}>
            <View style={styles.farmerInfoRow}>
              <Text style={styles.farmerInfoName}>{selectedFarmer.name}</Text>
              <Text style={styles.farmerInfoVillage}>
                📍 {selectedFarmer.village || t.noVillage}
              </Text>
            </View>
            <Text style={styles.farmerInfoPhone}>
              📞 {formatPhone(selectedFarmer.mobile)}
            </Text>
          </View>

          {/* Summary Card */}
          <View style={styles.ledgerSummary}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>{t.totalWork}</Text>
                <Text style={styles.summaryAmountBlue}>
                  {formatIndianCurrency(summary.totalWork)}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>{t.totalPaid}</Text>
                <Text style={styles.summaryAmountGreen}>
                  {formatIndianCurrency(summary.totalPaid)}
                </Text>
              </View>
            </View>
            <View style={styles.dueBox}>
              <Text style={styles.dueLabel}>{t.remainingDue}</Text>
              <Text
                style={[
                  styles.dueValue,
                  { color: summary.remainingDue > 0 ? Colors.danger : Colors.success },
                ]}
              >
                {formatIndianCurrency(summary.remainingDue)}
              </Text>
            </View>
          </View>

          {/* Work Entries Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 {t.workEntriesLabel}</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{workEntries.length}</Text>
            </View>
          </View>

          {workEntries.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t.noWorkEntries}</Text>
            </View>
          ) : (
            workEntries.map((entry) => (
              <View key={entry.id} style={styles.cardWrapper}>
                <WorkEntryCard
                  date={entry.date}
                  farmName={entry.farm_name || 'Unknown Farm'}
                  workType={entry.work_type}
                  quantity={entry.quantity || 0}
                  unit={entry.quantity_unit || 'acres'}
                  totalAmount={entry.total_amount}
                  notes={entry.notes}
                />
              </View>
            ))
          )}

          {/* Payments Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💰 {t.paymentsLabel}</Text>
            <View style={[styles.sectionBadge, { backgroundColor: Colors.successBg }]}>
              <Text style={[styles.sectionBadgeText, { color: Colors.success }]}>
                {payments.length}
              </Text>
            </View>
          </View>

          {payments.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t.noPayments}</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment.id} style={styles.cardWrapper}>
                <PaymentCard
                  date={payment.payment_date}
                  amount={payment.amount}
                  notes={payment.notes}
                />
              </View>
            ))
          )}

          {/* Export PDF Button */}
          <Pressable
            style={({ pressed }) => [
              styles.exportButton,
              pressed && styles.exportButtonPressed,
              isPdfLoading && styles.exportButtonDisabled,
            ]}
            onPress={handleExportPdf}
            disabled={isPdfLoading}
            android_ripple={{ color: Colors.primaryLight }}
          >
            {isPdfLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="download" size={22} color={Colors.white} />
            )}
            <Text style={styles.exportButtonText}>
              {isPdfLoading ? t.generatingPdf : t.exportPdfShare}
            </Text>
          </Pressable>

          {/* Bottom spacer */}
          <View style={{ height: Spacing['3xl'] }} />
        </ScrollView>
      )}

      {/* Farmer Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.selectFarmer}</Text>
              <Pressable
                onPress={() => setShowDropdown(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {farmers.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>{t.noFarmersFound}</Text>
              </View>
            ) : (
              <FlatList
                data={farmers}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={10}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      pressed && styles.dropdownItemPressed,
                      item.id === selectedFarmerId && styles.dropdownItemSelected,
                    ]}
                    onPress={() => handleSelectFarmer(item.id)}
                    android_ripple={{ color: Colors.primaryBg }}
                  >
                    <View style={styles.dropdownItemInfo}>
                      <Text style={styles.dropdownItemName}>{item.name}</Text>
                      <Text style={styles.dropdownItemVillage}>
                        📍 {item.village || t.noVillage} • 📞 {formatPhone(item.mobile)}
                      </Text>
                    </View>
                    {item.remaining_due > 0 && (
                      <Text style={styles.dropdownItemDue}>
                        {formatIndianCurrency(item.remaining_due)}
                      </Text>
                    )}
                    {item.id === selectedFarmerId && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={Colors.primary}
                        style={{ marginLeft: Spacing.sm }}
                      />
                    )}
                  </Pressable>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Selector
  selectorContainer: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    height: Layout.inputHeight,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.small,
  },
  selectorButtonPressed: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  selectorText: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
  },
  selectorPlaceholder: {
    color: Colors.textTertiary,
  },
  selectedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xs,
  },
  clearSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  clearSelectionText: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },

  // Farmer Info Card
  farmerInfoCard: {
    backgroundColor: Colors.primaryBg,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  farmerInfoRow: {
    marginBottom: Spacing.xs,
  },
  farmerInfoName: {
    ...Typography.h3,
    color: Colors.text,
  },
  farmerInfoVillage: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  farmerInfoPhone: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  // Summary
  ledgerSummary: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.md,
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: Spacing.xs,
  },
  summaryAmountBlue: {
    ...Typography.amount,
    color: Colors.primary,
  },
  summaryAmountGreen: {
    ...Typography.amount,
    color: Colors.success,
  },
  dueBox: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  dueLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: Spacing.xs,
  },
  dueValue: {
    ...Typography.amountLarge,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: Layout.badgePaddingHorizontal,
    paddingVertical: Layout.badgePaddingVertical,
    borderRadius: Layout.badgeBorderRadius,
  },
  sectionBadgeText: {
    ...Typography.labelSmall,
    color: Colors.primary,
  },
  cardWrapper: {
    marginBottom: Layout.cardGap,
  },
  emptySection: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
  },
  emptySectionText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },

  // Export Button
  exportButton: {
    backgroundColor: Colors.primary,
    height: Layout.buttonHeight,
    borderRadius: Layout.inputBorderRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    ...Shadows.medium,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
  },
  exportButtonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  exportButtonDisabled: {
    opacity: 0.7,
  },
  exportButtonText: {
    ...Typography.button,
    color: Colors.white,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    maxHeight: '70%',
    overflow: 'hidden',
    ...Shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Layout.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalEmpty: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  modalEmptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Spacing.md,
    minHeight: Layout.minTouchTarget,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dropdownItemPressed: {
    backgroundColor: Colors.primaryBg,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.primaryBg,
  },
  dropdownItemInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  dropdownItemName: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  dropdownItemVillage: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  dropdownItemDue: {
    ...Typography.amountSmall,
    color: Colors.danger,
  },
});
