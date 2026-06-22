/**
 * Tractor Ledger — Collect Phone Number Screen
 *
 * Shown after first Google Sign-In when user has no phone number on file.
 * Phone is needed for WhatsApp notifications to farmers.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { useAuthStore } from '@/store/useAuthStore';

export default function CollectPhoneScreen() {
  const db = useSQLiteContext();
  const { user, setPhoneNumber } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSave() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('', 'કૃપા કરીને 10-અંકનો મોબાઇલ નંબર દાખલ કરો');
      return;
    }

    setIsLoading(true);
    try {
      await setPhoneNumber(digits.slice(-10), db);
      // Navigate to activation check
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to save phone number');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.title}>તમારો મોબાઇલ નંબર</Text>
          <Text style={styles.subtitle}>
            WhatsApp નોટિફિકેશન માટે તમારો ફોન નંબર જરૂરી છે
          </Text>
        </View>

        {/* Welcome message */}
        {user?.name && (
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeText}>
              🎉 સ્વાગત, {user.name}!
            </Text>
            <Text style={styles.welcomeSub}>
              {user.email}
            </Text>
          </View>
        )}

        {/* Phone Input */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>મોબાઇલ નંબર *</Text>
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
              maxLength={12}
              autoFocus={false}
            />
          </View>
        </View>

        <Text style={styles.hint}>
          ખેડૂતોને WhatsApp સંદેશ મોકલવા માટે આ નંબર વપરાશે
        </Text>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, phone.replace(/\D/g, '').length < 10 && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isLoading || phone.replace(/\D/g, '').length < 10}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>ચાલુ રાખો →</Text>
          )}
        </TouchableOpacity>
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
    marginBottom: Spacing['2xl'],
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Welcome
  welcomeBanner: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: Spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  welcomeText: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.primary,
  },
  welcomeSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Field
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
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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

  hint: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },

  // Save
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.inputBorderRadius,
    height: Layout.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    ...Typography.button,
    color: Colors.white,
    fontSize: 18,
  },
});
