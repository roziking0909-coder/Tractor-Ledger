/**
 * Tractor Ledger — Add Farmer Screen
 *
 * ScrollView form with KeyboardAvoidingView wrapper.
 * Fields: Name, Mobile (+91 prefix), Village, Notes.
 * All inputs 56px height. Save inserts into farmers table.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { router, Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { generateUUID } from '@/lib/format';
import { useLanguageStore } from '@/store/useLanguageStore';

const USER_ID = 'demo-user';

export default function AddFarmerScreen() {
  const db = useSQLiteContext();
  const { t } = useLanguageStore();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation
  const [nameError, setNameError] = useState(false);
  const [mobileError, setMobileError] = useState(false);

  function validate(): boolean {
    let valid = true;

    if (!name.trim()) {
      setNameError(true);
      valid = false;
    } else {
      setNameError(false);
    }

    const digits = mobile.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      setMobileError(true);
      valid = false;
    } else {
      setMobileError(false);
    }

    if (!valid) {
      Alert.alert('Required Fields', 'Please enter farmer name and a valid 10-digit mobile number.');
    }

    return valid;
  }

  async function handleSave() {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const id = generateUUID();
      const digits = mobile.replace(/\D/g, '').slice(-10);

      await db.runAsync(
        `INSERT INTO farmers (id, user_id, name, mobile, village, notes, created_at, updated_at, is_deleted, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0, 'pending')`,
        [id, USER_ID, name.trim(), digits, village.trim() || null, notes.trim() || null]
      );

      Alert.alert('✅ Farmer Added', `${name.trim()} has been added successfully.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to add farmer:', error);
      Alert.alert('Error', 'Failed to add farmer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t.addFarmer }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>👨‍🌾</Text>
            <Text style={styles.headerTitle}>{t.newFarmer}</Text>
            <Text style={styles.headerSubtitle}>{t.newFarmerSub}</Text>
          </View>

          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.farmerName} *</Text>
            <TextInput
              style={[styles.input, nameError && styles.inputError]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(false);
              }}
              placeholder={t.farmerName}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              autoFocus
            />
            {nameError && <Text style={styles.errorText}>{t.farmerName}</Text>}
          </View>

          {/* Mobile Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.mobileNumber} *</Text>
            <View style={[styles.phoneRow, mobileError && styles.inputError]}>
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={mobile}
                onChangeText={(text) => {
                  setMobile(text);
                  if (mobileError) setMobileError(false);
                }}
                placeholder="98765 43210"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="phone-pad"
                maxLength={12}
              />
            </View>
            {mobileError && <Text style={styles.errorText}>{t.mobileNumber}</Text>}
          </View>

          {/* Village Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.village}</Text>
            <TextInput
              style={styles.input}
              value={village}
              onChangeText={setVillage}
              placeholder={t.village}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
            />
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.notes}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t.notes}
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>✅ {t.saveFarmer}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Layout.screenPaddingHorizontal,
    paddingBottom: 120,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    paddingTop: Spacing.lg,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Fields
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
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
    ...Typography.bodyLarge,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },

  // Phone
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: Layout.inputHeight,
    overflow: 'hidden',
  },
  phonePrefix: {
    backgroundColor: Colors.primaryBg,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  phonePrefixText: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.primary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    height: '100%',
    ...Typography.bodyLarge,
    color: Colors.text,
    letterSpacing: 1,
  },

  // Notes
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    paddingTop: Spacing.md,
    minHeight: 100,
    ...Typography.body,
    color: Colors.text,
    textAlignVertical: 'top',
  },

  // Save Button
  saveBtn: {
    backgroundColor: Colors.primary,
    height: Layout.buttonHeight,
    borderRadius: Layout.inputBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    ...Shadows.medium,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...Typography.button,
    color: Colors.white,
    fontSize: 18,
  },
});
