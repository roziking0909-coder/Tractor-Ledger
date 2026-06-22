/**
 * Outstanding Dues Screen
 *
 * Shows all farmers with outstanding dues, sorted by highest due first.
 * Each row has a progress bar, payment button, and WhatsApp notify button.
 * Summary card at top shows total outstanding amount.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, formatDate, formatPhone, generateUUID, getTodayISO } from '@/lib/format';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useFarmersStore } from '@/store/useFarmersStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { openWhatsApp } from '@/lib/whatsapp';
import EmptyState from '@/components/EmptyState';

import { useAuthStore } from '@/store/useAuthStore';

export default function DuesScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { farmers, isLoading, loadFarmers } = useFarmersStore();
  const { t } = useLanguageStore();
  const [refreshing, setRefreshing] = useState(false);

  // Reload on focus
  useFocusEffect(
    useCallback(() => {
      loadFarmers(db, USER_ID);
    }, [db])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFarmers(db, USER_ID);
    setRefreshing(false);
  }, [db]);

  // Sort farmers by highest remaining_due first, only include those with dues
  const farmersWithDues = [...farmers]
    .filter((f) => f.remaining_due > 0)
    .sort((a, b) => b.remaining_due - a.remaining_due);

  // Calculate totals
  const totalOutstanding = farmersWithDues.reduce((sum, f) => sum + f.remaining_due, 0);
  const totalWorkAmount = farmersWithDues.reduce((sum, f) => sum + f.total_work_amount, 0);
  const totalPaid = farmersWithDues.reduce((sum, f) => sum + f.total_paid, 0);

  /** Get color based on payment progress */
  const getDueColor = (paid: number, total: number): string => {
    if (total === 0) return Colors.success;
    const ratio = paid / total;
    if (ratio >= 1) return Colors.success;
    if (ratio > 0.5) return Colors.warning;
    return Colors.danger;
  };

  /** Get background tint based on payment progress */
  const getDueBgColor = (paid: number, total: number): string => {
    if (total === 0) return Colors.successBg;
    const ratio = paid / total;
    if (ratio >= 1) return Colors.successBg;
    if (ratio > 0.5) return Colors.warningBg;
    return Colors.dangerBg;
  };

  /** Handle WhatsApp notification for dues */
  const handleNotify = useCallback(async (farmer: typeof farmersWithDues[0]) => {
    const message = `Hello ${farmer.name},\n\nDues Reminder 📋\n\nTotal Work: ${formatIndianCurrency(farmer.total_work_amount)}\nTotal Paid: ${formatIndianCurrency(farmer.total_paid)}\nRemaining Due: ${formatIndianCurrency(farmer.remaining_due)}\n\nKindly clear your dues at your earliest convenience. 🙏`;

    await openWhatsApp(farmer.mobile, message);
  }, []);

  return (
    <View style={styles.container}>
      {isLoading && farmers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t.loadingDues}</Text>
        </View>
      ) : farmersWithDues.length === 0 ? (
        <EmptyState
          icon="🎉"
          title={t.allDuesCleared}
          subtitle={t.allDuesClearedSub}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="wallet" size={24} color={Colors.danger} />
              <Text style={styles.summaryTitle}>{t.totalOutstanding}</Text>
            </View>
            <Text style={styles.summaryAmount}>
              {formatIndianCurrency(totalOutstanding)}
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t.totalWork}</Text>
                <Text style={styles.summaryValue}>
                  {formatIndianCurrency(totalWorkAmount)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t.totalPaid}</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {formatIndianCurrency(totalPaid)}
                </Text>
              </View>
            </View>
            <Text style={styles.summaryCount}>
              {farmersWithDues.length} {t.farmers} {t.pendingDues}
            </Text>
          </View>

          {/* Farmer Dues List */}
          {farmersWithDues.map((farmer) => {
            const paidRatio = farmer.total_work_amount > 0
              ? farmer.total_paid / farmer.total_work_amount
              : 0;
            const progressPercent = Math.min(paidRatio * 100, 100);
            const dueColor = getDueColor(farmer.total_paid, farmer.total_work_amount);
            const dueBgColor = getDueBgColor(farmer.total_paid, farmer.total_work_amount);

            return (
              <View key={farmer.id} style={styles.dueCard}>
                {/* Farmer Header */}
                <Pressable
                  style={styles.farmerHeader}
                  onPress={() => router.push(`/farmer/${farmer.id}`)}
                  android_ripple={{ color: Colors.primaryBg }}
                >
                  <View style={styles.farmerInfo}>
                    <Text style={styles.farmerName} numberOfLines={1}>
                      {farmer.name}
                    </Text>
                    <Text style={styles.farmerVillage} numberOfLines={1}>
                      📍 {farmer.village || t.noVillage}
                    </Text>
                  </View>
                  <View style={[styles.dueBadge, { backgroundColor: dueBgColor }]}>
                    <Text style={[styles.dueAmount, { color: dueColor }]}>
                      {formatIndianCurrency(farmer.remaining_due)}
                    </Text>
                  </View>
                </Pressable>

                {/* Amount Details */}
                <View style={styles.amountDetails}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>{t.workDone}</Text>
                    <Text style={styles.amountValue}>
                      {formatIndianCurrency(farmer.total_work_amount)}
                    </Text>
                  </View>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>{t.paid}</Text>
                    <Text style={[styles.amountValue, { color: Colors.success }]}>
                      {formatIndianCurrency(farmer.total_paid)}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: dueColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: dueColor }]}>
                    {Math.round(progressPercent)}% {t.paid}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.paymentButton,
                      pressed && styles.paymentButtonPressed,
                    ]}
                    onPress={() => router.push(`/payment/add?farmerId=${farmer.id}`)}
                    android_ripple={{ color: Colors.successLight }}
                  >
                    <Ionicons name="cash" size={20} color={Colors.white} />
                    <Text style={styles.paymentButtonText}>{t.recordPayment}</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.notifyButton,
                      pressed && styles.notifyButtonPressed,
                    ]}
                    onPress={() => handleNotify(farmer)}
                    android_ripple={{ color: Colors.successBg }}
                  >
                    <Ionicons name="logo-whatsapp" size={22} color={Colors.success} />
                    <Text style={styles.notifyButtonText}>{t.notify}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {/* Bottom spacer */}
          <View style={{ height: Spacing['3xl'] }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: Layout.screenPaddingVertical,
    paddingBottom: Spacing.lg,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding + 4,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dangerBg,
    ...Shadows.medium,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryTitle: {
    ...Typography.label,
    color: Colors.danger,
    marginLeft: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    ...Typography.displayLarge,
    color: Colors.danger,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  summaryItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: {
    ...Typography.amountSmall,
    color: Colors.text,
  },
  summaryCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },

  // Due Card
  dueCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    overflow: 'hidden',
    marginBottom: Layout.cardGap,
    ...Shadows.medium,
  },
  farmerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Layout.cardPadding,
    minHeight: Layout.minTouchTarget,
  },
  farmerInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  farmerName: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.text,
  },
  farmerVillage: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  dueBadge: {
    paddingHorizontal: Layout.badgePaddingHorizontal + 2,
    paddingVertical: Layout.badgePaddingVertical + 2,
    borderRadius: Layout.badgeBorderRadius,
  },
  dueAmount: {
    ...Typography.amount,
    fontWeight: '700',
  },

  // Amount Details
  amountDetails: {
    paddingHorizontal: Layout.cardPadding,
    paddingBottom: Spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  amountLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  amountValue: {
    ...Typography.amountSmall,
    color: Colors.text,
  },

  // Progress Bar
  progressContainer: {
    paddingHorizontal: Layout.cardPadding,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    ...Typography.labelSmall,
    width: 65,
    textAlign: 'right',
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: Layout.minTouchTarget,
    backgroundColor: Colors.success,
    gap: Spacing.sm,
  },
  paymentButtonPressed: {
    backgroundColor: Colors.successLight,
  },
  paymentButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: Layout.minTouchTarget,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.successBg,
    gap: Spacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: Colors.divider,
  },
  notifyButtonPressed: {
    backgroundColor: Colors.borderLight,
  },
  notifyButtonText: {
    ...Typography.buttonSmall,
    color: Colors.success,
  },
});
