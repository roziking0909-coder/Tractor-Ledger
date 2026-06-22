/**
 * Tractor Ledger — Dashboard Screen
 * 
 * The home screen showing:
 * - Total farmers & farms count
 * - Total outstanding dues (big red number)
 * - Profit summary card (income - expenses = net profit)
 * - Today's work entries
 * - Quick action buttons
 * - Language toggle (EN/ગુ)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, formatDateShort } from '@/lib/format';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useExpensesStore } from '@/store/useExpensesStore';

import { useAuthStore } from '@/store/useAuthStore';

export default function DashboardScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { stats, isLoading, loadDashboard } = useDashboardStore();
  const { language, t, toggleLanguage } = useLanguageStore();
  const { totalThisMonth, loadExpenses } = useExpensesStore();
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const refreshDashboard = useCallback(() => {
    loadDashboard(db, USER_ID);
    loadExpenses(db, USER_ID);
    loadMonthlyIncome();
  }, [db]);

  async function loadMonthlyIncome() {
    try {
      const result = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM work_entries WHERE user_id = ? AND is_deleted = 0 AND date LIKE ?`,
        [USER_ID, currentMonth + '%']
      );
      setMonthlyIncome(result?.total ?? 0);
    } catch (error) {
      console.error('Failed to load monthly income:', error);
    }
  }

  useFocusEffect(
    useCallback(() => {
      refreshDashboard();
    }, [refreshDashboard])
  );

  const netProfit = monthlyIncome - totalThisMonth;

  if (isLoading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refreshDashboard}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Language Toggle */}
      <View style={styles.langToggleRow}>
        <TouchableOpacity
          style={styles.langToggle}
          onPress={toggleLanguage}
          activeOpacity={0.7}
        >
          <Text style={styles.langToggleText}>
            {language === 'gu' ? 'EN' : 'ગુ'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards Row */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.statCard, styles.statCardPrimary]}
          onPress={() => router.push('/farmers')}
          activeOpacity={0.8}
        >
          <View style={styles.statIconContainer}>
            <Ionicons name="people" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.statNumber}>{stats?.totalFarmers ?? 0}</Text>
          <Text style={styles.statLabel}>{t.totalFarmers}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, styles.statCardSuccess]}
          onPress={() => router.push('/farmers')}
          activeOpacity={0.8}
        >
          <View style={[styles.statIconContainer, { backgroundColor: Colors.successBg }]}>
            <Ionicons name="leaf" size={24} color={Colors.success} />
          </View>
          <Text style={styles.statNumber}>{stats?.totalFarms ?? 0}</Text>
          <Text style={styles.statLabel}>{t.totalFarms}</Text>
        </TouchableOpacity>
      </View>

      {/* Total Due Card */}
      <TouchableOpacity
        style={styles.dueCard}
        onPress={() => router.push('/dues')}
        activeOpacity={0.8}
      >
        <View style={styles.dueCardHeader}>
          <Ionicons name="warning" size={22} color={Colors.danger} />
          <Text style={styles.dueCardTitle}>{t.totalOutstanding}</Text>
        </View>
        <Text style={styles.dueAmount}>
          {formatIndianCurrency(stats?.totalDue ?? 0)}
        </Text>
        <Text style={styles.dueSubtext}>
          {stats?.farmersWithDues ?? 0} {t.farmers} {t.pendingDues}
        </Text>
      </TouchableOpacity>

      {/* Profit Summary Card */}
      <View style={styles.profitCard}>
        <Text style={styles.profitTitle}>{t.thisMonth}</Text>
        <View style={styles.profitRow}>
          <View style={styles.profitItem}>
            <Text style={styles.profitLabel}>{t.income}</Text>
            <Text style={[styles.profitAmount, { color: Colors.success }]}>
              {formatIndianCurrency(monthlyIncome)}
            </Text>
          </View>
          <Text style={styles.profitMinus}>−</Text>
          <View style={styles.profitItem}>
            <Text style={styles.profitLabel}>{t.totalExpenses}</Text>
            <Text style={[styles.profitAmount, { color: Colors.danger }]}>
              {formatIndianCurrency(totalThisMonth)}
            </Text>
          </View>
          <Text style={styles.profitEquals}>=</Text>
          <View style={styles.profitItem}>
            <Text style={styles.profitLabel}>{t.netProfit}</Text>
            <Text style={[styles.profitAmount, { color: netProfit >= 0 ? Colors.success : Colors.danger }]}>
              {formatIndianCurrency(Math.abs(netProfit))}
            </Text>
            {netProfit < 0 && (
              <Text style={[styles.profitLabel, { color: Colors.danger }]}>({t.loss})</Text>
            )}
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => router.push('/work')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: Colors.primaryBg }]}>
            <Ionicons name="add-circle" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.quickActionLabel}>{t.addWork}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => router.push('/payment/add')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: Colors.successBg }]}>
            <Ionicons name="cash" size={28} color={Colors.success} />
          </View>
          <Text style={styles.quickActionLabel}>{t.recordPayment}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => router.push('/farmer/add')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="person-add" size={28} color="#7B1FA2" />
          </View>
          <Text style={styles.quickActionLabel}>{t.addFarmer}</Text>
        </TouchableOpacity>
      </View>

      {/* Today's Work */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.todayWork}</Text>
          {(stats?.todayTotal ?? 0) > 0 && (
            <Text style={styles.sectionBadge}>
              {formatIndianCurrency(stats!.todayTotal)}
            </Text>
          )}
        </View>

        {!stats?.todayWorkEntries?.length ? (
          <View style={styles.emptyToday}>
            <Ionicons name="sunny-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTodayText}>{t.noWorkToday}</Text>
            <TouchableOpacity
              style={styles.emptyTodayBtn}
              onPress={() => router.push('/work')}
            >
              <Text style={styles.emptyTodayBtnText}>+ {t.addWork}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          stats.todayWorkEntries.map((entry) => (
            <View key={entry.id} style={styles.todayItem}>
              <View style={styles.todayItemLeft}>
                <Text style={styles.todayItemFarmer}>
                  {entry.farmer_name || 'Unknown'}
                </Text>
                <Text style={styles.todayItemWork}>
                  {entry.work_type} • {entry.farm_name || ''}
                </Text>
              </View>
              <Text style={styles.todayItemAmount}>
                {formatIndianCurrency(entry.total_amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Layout.screenPaddingHorizontal,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // Language Toggle
  langToggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  langToggle: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langToggleText: {
    ...Typography.button,
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: Layout.cardGap,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    alignItems: 'center',
    ...Shadows.medium,
  },
  statCardPrimary: {
    borderTopWidth: 3,
    borderTopColor: Colors.primary,
  },
  statCardSuccess: {
    borderTopWidth: 3,
    borderTopColor: Colors.success,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statNumber: {
    ...Typography.displayLarge,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  statLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },

  // Due Card
  dueCard: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding + 4,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    ...Shadows.medium,
  },
  dueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dueCardTitle: {
    ...Typography.label,
    color: Colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dueAmount: {
    ...Typography.amountLarge,
    color: Colors.danger,
    marginBottom: Spacing.xs,
    fontSize: 36,
  },
  dueSubtext: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  // Profit Card
  profitCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding + 4,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    ...Shadows.medium,
  },
  profitTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profitItem: {
    flex: 1,
    alignItems: 'center',
  },
  profitLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxs,
  },
  profitAmount: {
    ...Typography.amountSmall,
    fontWeight: '700',
  },
  profitMinus: {
    ...Typography.h2,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.xs,
  },
  profitEquals: {
    ...Typography.h2,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.xs,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing['2xl'],
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    ...Shadows.small,
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },

  // Section
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  sectionBadge: {
    ...Typography.amountSmall,
    color: Colors.primary,
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Today's Work
  emptyToday: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Spacing['3xl'],
    alignItems: 'center',
    ...Shadows.small,
  },
  emptyTodayText: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  emptyTodayBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Layout.inputBorderRadius,
  },
  emptyTodayBtnText: {
    ...Typography.button,
    color: Colors.white,
  },
  todayItem: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    ...Shadows.small,
  },
  todayItemLeft: {
    flex: 1,
  },
  todayItemFarmer: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  todayItemWork: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  todayItemAmount: {
    ...Typography.amount,
    color: Colors.primary,
  },
});
