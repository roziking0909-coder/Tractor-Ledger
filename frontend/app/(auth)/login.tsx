/**
 * Tractor Ledger — Login Screen
 *
 * Google Sign-In via Supabase Auth (replaces phone OTP).
 * Demo mode still available for testing without auth.
 *
 * IMPORTANT: Google Sign-In requires a development build (not Expo Go)
 * because of the custom URL scheme (tractorledger://).
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { useAuthStore } from '@/store/useAuthStore';
import { promptGoogleSignIn } from '@/lib/googleAuth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginScreen() {
  const db = useSQLiteContext();
  const { loginWithGoogle, enterDemoMode } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Setup Required',
        'Configure EXPO_PUBLIC_SUPABASE_URL and ANON_KEY in .env',
      );
      return;
    }

    setIsLoading(true);
    try {
      const result = await promptGoogleSignIn();
      if (!result) {
        // User cancelled
        setIsLoading(false);
        return;
      }

      // Session is now set in Supabase client by promptGoogleSignIn.
      // loginWithGoogle reads it and saves locally.
      await loginWithGoogle();

      // Check if phone number needs to be collected
      const { needsPhoneNumber } = useAuthStore.getState();
      if (needsPhoneNumber) {
        router.replace('/(auth)/collect-phone' as any);
      } else {
        // Check activation status
        router.replace('/');
      }
    } catch (error) {
      console.error('[Login] Google sign-in error:', error);
      Alert.alert(
        'Sign-In Failed',
        error instanceof Error ? error.message : 'Google sign-in failed. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDemoLogin() {
    setIsDemoLoading(true);
    try {
      await enterDemoMode(db);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Could not start demo mode');
    } finally {
      setIsDemoLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.tractor}>🚜</Text>
          <Text style={styles.title}>Tractor Ledger</Text>
          <Text style={styles.subtitle}>
            ડિજિટલ ખાતાવહી{'\n'}Digital record-keeping for{'\n'}tractor service providers
          </Text>
        </View>

        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleSignIn}
          disabled={isLoading || isDemoLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <>
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.googleNote}>
          📱 Google ખાતાથી લૉગિન કરો — SMS ખર્ચ નહીં
        </Text>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Demo Mode */}
        <TouchableOpacity
          style={styles.demoBtn}
          onPress={handleDemoLogin}
          disabled={isLoading || isDemoLoading}
          activeOpacity={0.7}
        >
          {isDemoLoading ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="flash" size={22} color={Colors.primary} />
              <Text style={styles.demoBtnText}>Try Demo Mode</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.demoNote}>
          Explore with sample data — no login required
        </Text>
      </View>
    </View>
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

  // Google Sign-In
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: Layout.buttonHeight,
    ...Shadows.medium,
  },
  googleIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  googleBtnText: {
    ...Typography.button,
    color: Colors.text,
    fontSize: 17,
  },
  googleNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
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
