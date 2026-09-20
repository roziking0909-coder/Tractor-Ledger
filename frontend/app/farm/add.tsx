/**
 * Tractor Ledger — Add Farm Screen
 *
 * Receives farmerId from route params.
 * Fields: Farm Name (required), Location, Area in Acres, Notes.
 * All 56px height inputs.
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
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { generateUUID } from '@/lib/format';

const USER_ID = 'demo-user';

export default function AddFarmScreen() {
  const db = useSQLiteContext();
  const { farmerId } = useLocalSearchParams<{ farmerId: string }>();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [areaAcres, setAreaAcres] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState(false);

  function validate(): boolean {
    if (!name.trim()) {
      setNameError(true);
      Alert.alert('Required', 'Please enter a farm name.');
      return false;
    }
    setNameError(false);
    return true;
  }

  async function handleSave() {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const id = generateUUID();
      const area = areaAcres ? parseFloat(areaAcres) : null;

      await db.runAsync(
        `INSERT INTO farms (id, farmer_id, user_id, name, location, area_acres, notes, created_at, is_deleted, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 0, 'pending')`,
        [id, farmerId, USER_ID, name.trim(), location.trim() || null, area, notes.trim() || null]
      );

      Alert.alert('✅ Farm Added', `${name.trim()} has been added.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to add farm:', error);
      Alert.alert('Error', 'Failed to add farm. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Add Farm' }} />
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
            <Text style={styles.headerEmoji}>🌱</Text>
            <Text style={styles.headerTitle}>New Farm</Text>
            <Text style={styles.headerSubtitle}>Add a farm for this farmer</Text>
          </View>

          {/* Farm Name */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Farm Name *</Text>
            <TextInput
              style={[styles.input, nameError && styles.inputError]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(false);
              }}
              placeholder="e.g. North Field, River Plot"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              autoFocus
            />
            {nameError && <Text style={styles.errorText}>Farm name is required</Text>}
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Near highway, Behind temple"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="sentences"
            />
          </View>

          {/* Area in Acres */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Area (Acres)</Text>
            <View style={styles.areaRow}>
              <TextInput
                style={styles.areaInput}
                value={areaAcres}
                onChangeText={setAreaAcres}
                placeholder="0.0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <View style={styles.areaSuffix}>
                <Text style={styles.areaSuffixText}>acres</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any details about this farm..."
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
              <Text style={styles.saveBtnText}>✅ Save Farm</Text>
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

  // Area
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: Layout.inputHeight,
    overflow: 'hidden',
  },
  areaInput: {
    flex: 1,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    height: '100%',
    ...Typography.amount,
    color: Colors.text,
  },
  areaSuffix: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  areaSuffixText: {
    ...Typography.label,
    color: Colors.success,
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
