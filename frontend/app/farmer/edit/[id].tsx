/**
 * Tractor Ledger — Edit Farmer Screen
 *
 * Same layout as add.tsx but pre-filled with existing data.
 * Loads farmer by id from route params.
 * Update + soft delete support.
 */

import { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { useLanguageStore } from '@/store/useLanguageStore';
import type { Farmer } from '@/lib/database';

const USER_ID = 'demo-user';

export default function EditFarmerScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguageStore();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Validation
  const [nameError, setNameError] = useState(false);
  const [mobileError, setMobileError] = useState(false);

  useEffect(() => {
    loadFarmer();
  }, [id]);

  async function loadFarmer() {
    if (!id) return;
    try {
      const farmer = await db.getFirstAsync<Farmer>(
        'SELECT * FROM farmers WHERE id = ? AND is_deleted = 0',
        [id]
      );
      if (farmer) {
        setName(farmer.name);
        setMobile(farmer.mobile);
        setVillage(farmer.village || '');
        setNotes(farmer.notes || '');
      } else {
        Alert.alert('Not Found', 'Farmer not found.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Failed to load farmer:', error);
      Alert.alert('Error', 'Failed to load farmer data.');
    } finally {
      setIsLoading(false);
    }
  }

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
      const digits = mobile.replace(/\D/g, '').slice(-10);

      await db.runAsync(
        `UPDATE farmers SET name = ?, mobile = ?, village = ?, notes = ?, updated_at = datetime('now'), sync_status = 'pending'
         WHERE id = ?`,
        [name.trim(), digits, village.trim() || null, notes.trim() || null, id]
      );

      Alert.alert('✅ Farmer Updated', `${name.trim()} has been updated.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to update farmer:', error);
      Alert.alert('Error', 'Failed to update farmer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      `⚠️ ${t.deleteFarmer}`,
      `Are you sure you want to delete ${name.trim()}? This will also hide all their work entries and payments.`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await db.runAsync(
                `UPDATE farmers SET is_deleted = 1, updated_at = datetime('now'), sync_status = 'pending' WHERE id = ?`,
                [id]
              );
              Alert.alert('Deleted', `${name.trim()} has been removed.`, [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Failed to delete farmer:', error);
              Alert.alert('Error', 'Failed to delete farmer.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t.editFarmer }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `${t.edit} ${name || t.farmers}` }} />
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
            <Text style={styles.headerEmoji}>✏️</Text>
            <Text style={styles.headerTitle}>{t.editFarmer}</Text>
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
            disabled={isSubmitting || isDeleting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>✅ {t.updateFarmer}</Text>
            )}
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && styles.saveBtnDisabled]}
            onPress={handleDelete}
            disabled={isSubmitting || isDeleting}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator color={Colors.danger} />
            ) : (
              <Text style={styles.deleteBtnText}>🗑️ {t.deleteFarmer}</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
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

  // Delete Button
  deleteBtn: {
    height: Layout.buttonHeight,
    borderRadius: Layout.inputBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.danger,
    backgroundColor: Colors.surface,
  },
  deleteBtnText: {
    ...Typography.button,
    color: Colors.danger,
    fontSize: 18,
  },
});
