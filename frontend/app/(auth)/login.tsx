/**
 * Tractor Ledger — Login Screen
 * 
 * Phone number + OTP login for tractor owners.
 * For MVP: demo mode with instant access (no actual OTP).
 * Later: Supabase Auth phone OTP integration.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { isApiConfigured } from '@/lib/api';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export default function LoginScreen() {
  const db = useSQLiteContext();
  const { loginWithOtp, enterDemoMode } = useAuthStore();
  const { loadStatus } = useSubscriptionStore();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSendOTP() {
    if (phone.length < 10) return;
    if (!isSupabaseConfigured()) {
      Alert.alert('Setup Required', 'Configure EXPO_PUBLIC_SUPABASE_URL and ANON_KEY in .env');
      return;
    }
    setIsLoading(true);
    try {
      const normalizedPhone = `+91${phone.replace(/\D/g, '')}`;
      const { error } = await getSupabase().auth.signInWithOtp({ phone: normalizedPhone });
      if (error) throw error;
      setStep('otp');
    } catch (error) {
      Alert.alert('OTP Error', error instanceof Error ? error.message : 'Could not send OTP');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (otp.length < 4) return;
    if (!isApiConfigured()) {
      Alert.alert(
        'API Not Configured',
        'Set EXPO_PUBLIC_API_URL to your backend (e.g. http://192.168.x.x:8000)',
      );
      return;
    }
    setIsLoading(true);
    try {
      await loginWithOtp(phone, otp);
      const token = useAuthStore.getState().accessToken;
      if (token) {
        const status = await loadStatus(token);
        if (status.is_active) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/activation');
        }
      }
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'OTP verification failed',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDemoLogin() {
    setIsLoading(true);
    try {
      await enterDemoMode(db);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Could not start demo mode');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.tractor}>🚜</Text>
          <Text style={styles.title}>Tractor Ledger</Text>
          <Text style={styles.subtitle}>
            Digital record-keeping for{'\n'}tractor service providers
          </Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          {step === 'phone' ? (
            <>
              <Text style={styles.fieldLabel}>Your Mobile Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98765 43210"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, phone.length < 10 && styles.primaryBtnDisabled]}
                onPress={handleSendOTP}
                disabled={phone.length < 10 || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Enter OTP sent to +91 {phone}</Text>
              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={setOtp}
                placeholder="• • • • • •"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                textAlign="center"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, otp.length < 4 && styles.primaryBtnDisabled]}
                onPress={handleVerifyOTP}
                disabled={otp.length < 4 || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify & Login</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                }}
              >
                <Ionicons name="arrow-back" size={18} color={Colors.primary} />
                <Text style={styles.backBtnText}>Change Number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Demo Mode */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.demoBtn}
          onPress={handleDemoLogin}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <Ionicons name="flash" size={22} color={Colors.primary} />
          <Text style={styles.demoBtnText}>Try Demo Mode</Text>
        </TouchableOpacity>

        <Text style={styles.demoNote}>
          Explore with sample data — no login required
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: Spacing['5xl'],
  },
  tractor: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.primary,
    marginBottom: Spacing.sm,
    fontSize: 32,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Form
  form: {
    marginBottom: Spacing['2xl'],
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing['2xl'],
  },
  countryCode: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    height: Layout.inputHeight,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  countryCodeText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    height: Layout.inputHeight,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 1,
  },
  otpInput: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    height: 64,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    ...Typography.h2,
    color: Colors.text,
    letterSpacing: 8,
    marginBottom: Spacing['2xl'],
  },

  // Buttons
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.inputBorderRadius,
    height: Layout.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    ...Typography.button,
    color: Colors.white,
    fontSize: 18,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
  backBtnText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing['2xl'],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginHorizontal: Spacing.lg,
  },

  // Demo
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryBg,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    height: Layout.buttonHeight,
    ...Shadows.small,
  },
  demoBtnText: {
    ...Typography.button,
    color: Colors.primary,
    fontSize: 17,
  },
  demoNote: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
