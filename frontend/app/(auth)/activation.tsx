/**
 * Tractor Ledger — Activation Screen
 * Enter activation code after payment. Optional referral code.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Layout, Spacing } from '@/constants/spacing';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { getDeviceId } from '@/lib/deviceId';

const PLAN_FEATURES = [
  '👨‍🌾 અમર્યાદિત ખેડૂત',
  '📋 કામ અને ચૂકવણી ટ્રૅક',
  '📵 ઇન્ટરનેટ વગર કામ કરે',
  '💬 WhatsApp નોટિફિકેશન',
  '📄 PDF રિપોર્ટ',
  '⛽ ખર્ચ અને નફો ટ્રૅક',
];

export default function ActivationScreen() {
  const { accessToken } = useAuthStore();
  const {
    status,
    loadStatus,
    activate,
    validateActivationCode,
    validateReferralCode,
  } = useSubscriptionStore();

  const [activationCode, setActivationCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [referrerName, setReferrerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const walletBalance = status?.wallet_balance ?? 0;
  const amountToPay = status?.amount_to_pay ?? 2000;

  useEffect(() => {
    if (!accessToken) {
      router.replace('/(auth)/login');
      return;
    }
    loadStatus(accessToken)
      .then((data) => {
        if (data.is_active) {
          router.replace('/(tabs)');
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [accessToken]);

  const checkActivationCode = useCallback(
    async (code: string) => {
      if (!accessToken || code.length < 10) {
        setCodeValid(null);
        return;
      }
      try {
        const data = await validateActivationCode(accessToken, code);
        setCodeValid(data.valid);
      } catch {
        setCodeValid(null);
      }
    },
    [accessToken, validateActivationCode],
  );

  const checkReferralCode = useCallback(
    async (code: string) => {
      if (!accessToken || code.length < 6) {
        setReferrerName('');
        return;
      }
      try {
        const data = await validateReferralCode(accessToken, code);
        if (data.valid && data.referrer_name) {
          setReferrerName(data.referrer_name);
        } else {
          setReferrerName('');
        }
      } catch {
        setReferrerName('');
      }
    },
    [accessToken, validateReferralCode],
  );

  async function handleActivate() {
    if (!accessToken) return;
    if (!activationCode.trim()) {
      Alert.alert('', 'કૃપા કરીને એક્ટિવેશન કોડ દાખલ કરો');
      return;
    }

    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const data = await activate(accessToken, activationCode, referralCode || undefined, deviceId);
      if (data.success) {
        await loadStatus(accessToken);
        const walletMsg =
          data.wallet_used && data.wallet_used > 0
            ? `\n₹${data.wallet_used} બૅલેન્સ વપરાયો`
            : '';
        Alert.alert('🎉 સ્વાગત છે!', `Tractor Ledger 1 વર્ષ માટે સક્રિય!${walletMsg}`, [
          { text: 'શરૂ કરો', onPress: () => router.replace('/(tabs)') },
        ]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'એક્ટિવેશન નિષ્ફળ';
      Alert.alert('', message);
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🚜</Text>
        <Text style={styles.title}>Tractor Ledger</Text>
        <Text style={styles.subtitle}>ડિજિટલ ખાતાવહી</Text>
      </View>

      {walletBalance > 0 && (
        <View style={styles.walletBanner}>
          <Text style={styles.walletTitle}>💰 તમારી પાસે ₹{walletBalance} બૅલેન્સ છે</Text>
          <Text style={styles.walletSub}>
            {amountToPay > 0
              ? `તમારે ₹${amountToPay} ચૂકવવા પડશે (₹2000 - ₹${walletBalance})`
              : 'તમારો નવીનીકરણ મફત છે!'}
          </Text>
        </View>
      )}

      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>વાર્ષિક પ્લાન</Text>
          <View>
            <Text style={styles.planPrice}>₹2,000</Text>
            <Text style={styles.planPeriod}>પ્રતિ વર્ષ</Text>
          </View>
        </View>

        {PLAN_FEATURES.map((feature, i) => (
          <Text key={i} style={styles.feature}>
            {feature}
          </Text>
        ))}

        <View style={styles.payNotice}>
          <Text style={styles.payNoticeTitle}>
            📞 ₹{amountToPay > 0 ? amountToPay : 2000} ચૂકવ્યા પછી WhatsApp કરો
          </Text>
          <Text style={styles.payNoticeSub}>તમને એક્ટિવેશન કોડ મોકલવામાં આવશે</Text>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>એક્ટિવેશન કોડ *</Text>
        <TextInput
          style={[
            styles.codeInput,
            codeValid === true && styles.codeInputValid,
            codeValid === false && styles.codeInputInvalid,
          ]}
          placeholder="TL-2026-XXXXXX"
          placeholderTextColor={Colors.textTertiary}
          value={activationCode}
          onChangeText={(text) => {
            // Strip everything except letters, digits, and hyphens, then uppercase
            const raw = text.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
            // Auto-format: TL-2026-XXXXXX
            let formatted = raw;
            // If user types without hyphens, auto-insert them
            const digits = raw.replace(/-/g, '');
            if (digits.length >= 3 && !raw.includes('-')) {
              // Auto-format: TL + 2026 + rest
              formatted = digits.slice(0, 2) + '-' + digits.slice(2, 6) + (digits.length > 6 ? '-' + digits.slice(6) : '');
            }
            setActivationCode(formatted);
            checkActivationCode(formatted);
          }}
          autoCapitalize="characters"
          maxLength={16}
        />
        {codeValid === true && (
          <Text style={styles.validText}>✓ કોડ સાચો છે</Text>
        )}
        {codeValid === false && (
          <Text style={styles.invalidText}>✗ અમાન્ય અથવા વપરાઈ ગયેલ કોડ</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>રેફરલ કોડ (વૈકલ્પિક)</Text>
        <TextInput
          style={[styles.referralInput, referrerName ? styles.codeInputValid : null]}
          placeholder="VIJAY284"
          placeholderTextColor={Colors.textTertiary}
          value={referralCode}
          onChangeText={(text) => {
            const upper = text.toUpperCase();
            setReferralCode(upper);
            checkReferralCode(upper);
          }}
          autoCapitalize="characters"
          maxLength={10}
        />
        {referrerName ? (
          <Text style={styles.validText}>✓ {referrerName} ના કોડ દ્વારા</Text>
        ) : null}
        <Text style={styles.hint}>
          કોઈએ તમને Tractor Ledger વિશે જણાવ્યું? તેમનો રેફરલ કોડ નાખો
        </Text>
      </View>

      <TouchableOpacity
        style={styles.activateBtn}
        onPress={handleActivate}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} size="large" />
        ) : (
          <Text style={styles.activateBtnText}>એક્ટિવ કરો →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: { alignItems: 'center', paddingTop: 56, paddingBottom: 24 },
  emoji: { fontSize: 48 },
  title: { fontSize: 26, fontWeight: 'bold', color: Colors.primary, marginTop: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 15, marginTop: 4 },
  walletBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.successBg,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  walletTitle: { color: Colors.success, fontWeight: '700', fontSize: 15 },
  walletSub: { color: Colors.success, fontSize: 13, marginTop: 4 },
  planCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  planPrice: { fontSize: 26, fontWeight: 'bold', color: Colors.primary, textAlign: 'right' },
  planPeriod: { fontSize: 12, color: Colors.textSecondary, textAlign: 'right' },
  feature: { fontSize: 14, color: Colors.text, marginBottom: 6 },
  payNotice: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.warningBg,
    borderRadius: 8,
  },
  payNoticeTitle: { color: Colors.warning, fontWeight: '600', fontSize: 14 },
  payNoticeSub: { color: Colors.warning, fontSize: 13, marginTop: 2 },
  field: { marginHorizontal: 16, marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  codeInput: {
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 18,
    letterSpacing: 3,
    fontWeight: '700',
    backgroundColor: Colors.surface,
    color: Colors.text,
  },
  referralInput: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '600',
    backgroundColor: Colors.surface,
    color: Colors.text,
  },
  codeInputValid: { borderColor: Colors.success },
  codeInputInvalid: { borderColor: Colors.danger },
  validText: { color: Colors.success, marginTop: 6, fontWeight: '600' },
  invalidText: { color: Colors.danger, marginTop: 6 },
  hint: { color: Colors.textSecondary, fontSize: 12, marginTop: 6 },
  activateBtn: {
    marginHorizontal: 16,
    height: 60,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    marginBottom: 32,
    marginTop: 8,
  },
  activateBtnText: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
});
