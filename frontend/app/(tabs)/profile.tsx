/**
 * Tractor Ledger — Profile Screen
 * Subscription status, referral code, wallet balance, logout.
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { getPendingSyncCount } from '@/lib/database';

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const { user, accessToken, isDemoMode, logout } = useAuthStore();
  const {
    status,
    referrals,
    walletTransactions,
    totalReferrals,
    loadStatus,
    loadReferrals,
  } = useSubscriptionStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const referralCode = status?.referral_code || '—';
  const walletBalance = status?.wallet_balance ?? 0;
  const isActive = status?.is_active ?? isDemoMode;
  const daysRemaining = status?.days_remaining ?? 0;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [accessToken, isDemoMode]),
  );

  async function loadData() {
    if (isDemoMode || !accessToken) {
      setLoading(false);
      return;
    }
    try {
      await Promise.all([loadStatus(accessToken), loadReferrals(accessToken)]);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadData();
  }

  async function handleLogout() {
    // Check for unsynced data before logout
    let pendingCount = 0;
    try {
      pendingCount = await getPendingSyncCount(db);
    } catch {
      // If check fails, proceed with normal logout
    }

    if (pendingCount > 0) {
      // Warn user about unsynced data — important for offline tractor owners
      Alert.alert(
        '⚠️ સિંક બાકી છે',
        `તમારી પાસે ${pendingCount} એન્ટ્રી હજુ સિંક થઈ નથી.\n\n` +
        `ઇન્ટરનેટ વગર લોગઆઉટ કરવાથી આ ડેટા ખોવાઈ શકે છે.\n` +
        `શું તમે ચાલુ રાખવા માંગો છો?`,
        [
          { text: 'રદ કરો', style: 'cancel' },
          {
            text: 'લોગઆઉટ કરો',
            style: 'destructive',
            onPress: async () => {
              await logout(db);
              router.replace('/(auth)/login');
            },
          },
        ],
      );
    } else {
      // No unsynced data — simple confirmation
      Alert.alert('લૉગ આઉટ', 'શું તમે લૉગ આઉટ કરવા માંગો છો?', [
        { text: 'રદ કરો', style: 'cancel' },
        {
          text: 'લૉગ આઉટ',
          style: 'destructive',
          onPress: async () => {
            await logout(db);
            router.replace('/(auth)/login');
          },
        },
      ]);
    }
  }

  function shareReferral() {
    if (!referralCode || referralCode === '—') return;
    const msg =
      `નમસ્તે! 🚜\n\n` +
      `હું ટ્રેક્ટર સારથી વાપરું છું.\n` +
      `ટ્રૅક્ટર કામ, ખેડૂત, ચૂકવણી બધું ટ્રૅક થાય.\n` +
      `ઇન્ટરનેટ વગર કામ કરે!\n\n` +
      `₹2,000/વર્ષ\n\n` +
      `મારો રેફરલ કોડ: *${referralCode}*\n` +
      `(એક્ટિવ કરતી વખતે આ કોડ નાખો)`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
  }

  if (loading && !isDemoMode) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
      }
    >
      {/* User header */}
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name || user?.phone || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Tractor Owner'}</Text>
        <Text style={styles.userPhone}>+91 {user?.phone}</Text>
        {isDemoMode && (
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>Demo Mode</Text>
          </View>
        )}
      </View>

      {/* Subscription status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 સબ્સ્ક્રિપ્શન</Text>
        {isDemoMode ? (
          <Text style={styles.demoNote}>Demo mode — subscription not required</Text>
        ) : isActive ? (
          <>
            <Text style={styles.activeStatus}>✅ સક્રિય</Text>
            <Text style={styles.statusSub}>
              {daysRemaining} દિવસ બાકી
              {status?.end_date ? ` (${status.end_date})` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.expiredStatus}>⚠️ સક્રિય નથી</Text>
            <TouchableOpacity
              style={styles.renewBtn}
              onPress={() => router.push('/(auth)/activation')}
            >
              <Text style={styles.renewBtnText}>એક્ટિવ કરો</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {!isDemoMode && (
        <>
          {/* Referral code */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎁 તમારો રેફરલ કોડ</Text>
            <Text style={styles.cardHint}>
              મિત્રને શેર કરો — તે એક્ટિવ કરે તો તમને ₹100 બૅલેન્સ મળશે
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{referralCode}</Text>
            </View>
            <TouchableOpacity style={styles.whatsappBtn} onPress={shareReferral}>
              <Text style={styles.whatsappEmoji}>💬</Text>
              <Text style={styles.whatsappText}>WhatsApp પર શેર કરો</Text>
            </TouchableOpacity>
          </View>

          {/* Wallet */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💰 બૅલેન્સ</Text>
            <Text style={styles.walletAmount}>₹{walletBalance}</Text>
            <Text style={styles.cardHint}>
              {walletBalance > 0
                ? `નવીનીકરણ વખતે ₹${walletBalance} ઓછા ચૂકવવા પડશે`
                : 'સફળ રેફરલ પર ₹100 ઉમેરાશે'}
            </Text>
            {walletTransactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <Text
                  style={[
                    styles.txAmount,
                    { color: tx.type === 'credit' ? Colors.success : Colors.danger },
                  ]}
                >
                  {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                </Text>
                <Text style={styles.txDesc} numberOfLines={2}>
                  {tx.description}
                </Text>
              </View>
            ))}
          </View>

          {/* Referrals list */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👥 રેફર કરેલ લોકો ({totalReferrals})</Text>
            {referrals.length === 0 ? (
              <Text style={styles.cardHint}>હજુ કોઈ રેફરલ નથી</Text>
            ) : (
              referrals.map((r) => (
                <View key={r.id} style={styles.referralRow}>
                  <Text style={styles.referralName}>
                    {r.referee?.name || r.referee?.phone || '—'}
                  </Text>
                  <Text style={styles.referralReward}>+₹100 ✓</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
        <Text style={styles.logoutText}>લૉગ આઉટ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Layout.screenPaddingHorizontal, paddingBottom: 100 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userHeader: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarText: { ...Typography.h1, color: Colors.primary, fontSize: 28 },
  userName: { ...Typography.h2, color: Colors.text },
  userPhone: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  demoBadge: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.warningBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  demoBadgeText: { color: Colors.warning, fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  cardTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.sm },
  cardHint: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.md },
  activeStatus: { fontSize: 20, fontWeight: '700', color: Colors.success },
  expiredStatus: { fontSize: 18, fontWeight: '700', color: Colors.warning },
  statusSub: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  demoNote: { ...Typography.body, color: Colors.textSecondary },
  renewBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renewBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  codeBox: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  codeText: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: Colors.primary,
  },
  whatsappBtn: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  whatsappEmoji: { fontSize: 20 },
  whatsappText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  walletAmount: { fontSize: 32, fontWeight: 'bold', color: Colors.success },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  txAmount: { fontWeight: '700', fontSize: 15, minWidth: 70 },
  txDesc: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  referralRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  referralName: { ...Typography.body, fontWeight: '600', color: Colors.text },
  referralReward: { color: Colors.success, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  logoutText: { ...Typography.button, color: Colors.danger },
});
