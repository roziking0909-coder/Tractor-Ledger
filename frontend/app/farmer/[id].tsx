/**
 * Tractor Ledger — Farmer Detail Screen
 *
 * Shows farmer profile, dues summary, farms list, recent work & payments.
 * Action buttons for Add Work, Record Payment, WhatsApp, Edit.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, formatDate, formatPhone, formatQuantity } from '@/lib/format';
import { openWhatsApp, generateStatementMessage } from '@/lib/whatsapp';
import { useLanguageStore } from '@/store/useLanguageStore';
import WorkEntryCard from '@/components/WorkEntryCard';
import PaymentCard from '@/components/PaymentCard';
import type { Farmer, Farm, WorkEntry, Payment } from '@/lib/database';

import { useAuthStore } from '@/store/useAuthStore';


interface DueSummary {
  total_work: number;
  total_paid: number;
  remaining_due: number;
}

export default function FarmerDetailScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguageStore();

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [dues, setDues] = useState<DueSummary>({ total_work: 0, total_paid: 0, remaining_due: 0 });
  const [farms, setFarms] = useState<Farm[]>([]);
  const [recentWork, setRecentWork] = useState<WorkEntry[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [id])
  );

  async function loadAll() {
    if (!id) return;
    try {
      // Load farmer
      const f = await db.getFirstAsync<Farmer>(
        'SELECT * FROM farmers WHERE id = ? AND is_deleted = 0',
        [id]
      );
      if (!f) {
        Alert.alert('Not Found', 'Farmer not found.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setFarmer(f);

      // Load dues summary
      const dueResult = await db.getFirstAsync<DueSummary>(
        `SELECT
          COALESCE((SELECT SUM(total_amount) FROM work_entries WHERE farmer_id = ? AND is_deleted = 0), 0) as total_work,
          COALESCE((SELECT SUM(amount) FROM payments WHERE farmer_id = ? AND is_deleted = 0), 0) as total_paid,
          COALESCE((SELECT SUM(total_amount) FROM work_entries WHERE farmer_id = ? AND is_deleted = 0), 0) -
          COALESCE((SELECT SUM(amount) FROM payments WHERE farmer_id = ? AND is_deleted = 0), 0) as remaining_due`,
        [id, id, id, id]
      );
      setDues(dueResult || { total_work: 0, total_paid: 0, remaining_due: 0 });

      // Load farms
      const farmList = await db.getAllAsync<Farm>(
        'SELECT * FROM farms WHERE farmer_id = ? AND is_deleted = 0 ORDER BY name',
        [id]
      );
      setFarms(farmList);

      // Load recent work (last 10)
      const workList = await db.getAllAsync<WorkEntry>(
        `SELECT *
         FROM work_entries
         WHERE farmer_id = ? AND is_deleted = 0
         ORDER BY date DESC, created_at DESC
         LIMIT 10`,
        [id]
      );
      setRecentWork(workList);

      // Load recent payments (last 10)
      const paymentList = await db.getAllAsync<Payment>(
        `SELECT * FROM payments
         WHERE farmer_id = ? AND is_deleted = 0
         ORDER BY payment_date DESC, created_at DESC
         LIMIT 10`,
        [id]
      );
      setRecentPayments(paymentList);
    } catch (error) {
      console.error('Failed to load farmer details:', error);
      Alert.alert('Error', 'Failed to load farmer details.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function handleCall() {
    if (!farmer) return;
    const url = `tel:+91${farmer.mobile}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open phone dialer.');
    }
  }

  async function handleWhatsApp() {
    if (!farmer) return;
    const message = generateStatementMessage(
      farmer.name,
      new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      dues.total_work,
      dues.total_paid,
      dues.remaining_due
    );
    await openWhatsApp(farmer.mobile, message);
  }

  function handleRefresh() {
    setIsRefreshing(true);
    loadAll();
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t.farmerDetails }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  if (!farmer) return null;

  const dueColor = dues.remaining_due > 0 ? Colors.danger : Colors.success;

  return (
    <>
      <Stack.Screen
        options={{
          title: farmer.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleWhatsApp} style={styles.headerBtn}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/farmer/edit/${id}`)}
                style={styles.headerBtn}
              >
                <Ionicons name="create-outline" size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Farmer Info Header */}
        <View style={styles.farmerHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {farmer.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.farmerName}>{farmer.name}</Text>
          {farmer.village ? (
            <Text style={styles.farmerVillage}>📍 {farmer.village}</Text>
          ) : null}
          <TouchableOpacity onPress={handleCall} style={styles.phoneBtn}>
            <Ionicons name="call" size={18} color={Colors.primary} />
            <Text style={styles.phoneText}>+91 {formatPhone(farmer.mobile)}</Text>
          </TouchableOpacity>
        </View>

        {/* Due Summary Card */}
        <View style={[styles.dueCard, { borderLeftColor: dueColor }]}>
          <Text style={styles.dueCardTitle}>{t.accountSummary}</Text>
          <View style={styles.dueRow}>
            <View style={styles.dueItem}>
              <Text style={styles.dueItemLabel}>{t.totalWork}</Text>
              <Text style={[styles.dueItemAmount, { color: Colors.text }]}>
                {formatIndianCurrency(dues.total_work)}
              </Text>
            </View>
            <View style={styles.dueDivider} />
            <View style={styles.dueItem}>
              <Text style={styles.dueItemLabel}>{t.totalPaid}</Text>
              <Text style={[styles.dueItemAmount, { color: Colors.success }]}>
                {formatIndianCurrency(dues.total_paid)}
              </Text>
            </View>
          </View>
          <View style={styles.dueRemainingRow}>
            <Text style={styles.dueRemainingLabel}>
              {dues.remaining_due > 0 ? `⚠️ ${t.remainingDue}` : `✅ ${t.allSettled}`}
            </Text>
            <Text style={[styles.dueRemainingAmount, { color: dueColor }]}>
              {formatIndianCurrency(Math.abs(dues.remaining_due))}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnWork]}
            onPress={() => router.push(`/work/add?farmerId=${id}`)}
            activeOpacity={0.8}
          >
            <Ionicons name="hammer" size={22} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t.addWork}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPayment]}
            onPress={() => router.push(`/payment/add?farmerId=${id}`)}
            activeOpacity={0.8}
          >
            <Ionicons name="cash" size={22} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t.recordPayment}</Text>
          </TouchableOpacity>
        </View>

        {/* Farms Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🌾 {t.farmsLabel}</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push(`/farm/add?farmerId=${id}`)}
            >
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          {farms.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t.noFarmsYet}</Text>
              <TouchableOpacity
                style={styles.emptySectionBtn}
                onPress={() => router.push(`/farm/add?farmerId=${id}`)}
              >
                <Text style={styles.emptySectionBtnText}>+ {t.addFarm}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            farms.map((farm) => (
              <TouchableOpacity
                key={farm.id}
                style={styles.farmCard}
                onPress={() => router.push(`/farm/edit/${farm.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.farmCardLeft}>
                  <Text style={styles.farmCardName}>🌱 {farm.name}</Text>
                  {farm.location ? (
                    <Text style={styles.farmCardDetail}>📍 {farm.location}</Text>
                  ) : null}
                </View>
                {farm.area_acres ? (
                  <View style={styles.farmCardBadge}>
                    <Text style={styles.farmCardBadgeText}>
                      {farm.area_acres} {t.acres}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Work Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚜 {t.recentWork}</Text>
          </View>
          {recentWork.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t.noWorkEntries}</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {recentWork.map((entry) => (
                <WorkEntryCard
                  key={entry.id}
                  date={entry.date}
                  farmName={entry.farm_name || '—'}
                  workType={entry.work_type}
                  quantity={entry.quantity || 0}
                  unit={entry.quantity_unit || 'acres'}
                  totalAmount={entry.total_amount}
                  notes={entry.notes}
                />
              ))}
            </View>
          )}
        </View>

        {/* Recent Payments Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💰 {t.recentPayments}</Text>
          </View>
          {recentPayments.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t.noPayments}</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {recentPayments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  date={payment.payment_date}
                  amount={payment.amount}
                  notes={payment.notes}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
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

  // Header actions
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerBtn: {
    padding: Spacing.sm,
  },

  // Farmer header
  farmerHeader: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarText: {
    ...Typography.displayLarge,
    color: Colors.primary,
    fontSize: 36,
  },
  farmerName: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  farmerVillage: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
  },
  phoneText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Due card
  dueCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding + 4,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    ...Shadows.medium,
  },
  dueCardTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  dueRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  dueItem: {
    flex: 1,
    alignItems: 'center',
  },
  dueItemLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  dueItemAmount: {
    ...Typography.amount,
  },
  dueDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  dueRemainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  dueRemainingLabel: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  dueRemainingAmount: {
    ...Typography.amountLarge,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: Layout.buttonHeight,
    borderRadius: Layout.inputBorderRadius,
    ...Shadows.medium,
  },
  actionBtnWork: {
    backgroundColor: Colors.primary,
  },
  actionBtnPayment: {
    backgroundColor: Colors.success,
  },
  actionBtnText: {
    ...Typography.button,
    color: Colors.white,
  },

  // Sections
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
  addBtn: {
    padding: Spacing.xs,
  },

  // Empty section
  emptySection: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Spacing['2xl'],
    alignItems: 'center',
    ...Shadows.small,
  },
  emptySectionText: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  emptySectionBtn: {
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  emptySectionBtnText: {
    ...Typography.label,
    color: Colors.primary,
  },

  // Farm card
  farmCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  farmCardLeft: {
    flex: 1,
  },
  farmCardName: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  farmCardDetail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  farmCardBadge: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    marginRight: Spacing.sm,
  },
  farmCardBadgeText: {
    ...Typography.labelSmall,
    color: Colors.success,
  },

  // Card list
  cardList: {
    gap: Spacing.sm,
  },
});
