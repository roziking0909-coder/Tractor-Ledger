/**
 * Tractor Ledger — Add Work Screen (Tab)
 * 
 * THE most important screen. Optimized for rural tractor owners.
 * Smart farmer search + inline add, farm chips + inline add,
 * big work type icons, confirmation summary, success screen.
 * User NEVER leaves this screen.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, generateUUID, getTodayISO } from '@/lib/format';
import { openWorkNotification } from '@/lib/whatsapp';
import { QUANTITY_UNITS } from '@/lib/database';
import type { Farmer, Farm } from '@/lib/database';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useWorkTypesStore, type WorkTypeRecord } from '@/store/useWorkTypesStore';

import { useAuthStore } from '@/store/useAuthStore';



export default function AddWorkScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { t } = useLanguageStore();
  const { workTypes, loadWorkTypes, addWorkType } = useWorkTypesStore();

  // ── Form State ──────────────────────────────────────────────
  const [date, setDate] = useState(getTodayISO());
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [farmerQuery, setFarmerQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Farm state
  const [farmsForFarmer, setFarmsForFarmer] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [farmQuery, setFarmQuery] = useState('');
  const [showFarmSuggestions, setShowFarmSuggestions] = useState(false);
  const [showInlineFarmForm, setShowInlineFarmForm] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmLocation, setNewFarmLocation] = useState('');
  const [newFarmArea, setNewFarmArea] = useState('');

  // Add Farmer Modal
  const [showAddFarmerModal, setShowAddFarmerModal] = useState(false);
  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerMobile, setNewFarmerMobile] = useState('');
  const [newFarmerVillage, setNewFarmerVillage] = useState('');

  // Work details
  const [workType, setWorkType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('acres');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation & Success modals
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingNotify, setPendingNotify] = useState(false);

  // Add Work Type modal
  const [showAddWorkTypeModal, setShowAddWorkTypeModal] = useState(false);
  const [newWorkTypeName, setNewWorkTypeName] = useState('');

  // ── Derived ─────────────────────────────────────────────────
  const filteredFarmers = farmers.filter(
    (f) =>
      f.name.toLowerCase().includes(farmerQuery.toLowerCase()) ||
      f.village?.toLowerCase().includes(farmerQuery.toLowerCase())
  );

  const total = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return q * r;
  }, [quantity, rate]);

  const workTypeTranslated = useMemo(() => {
    const wt = workTypes.find((w) => w.name === workType);
    if (!wt) return workType;
    const tKey = workType.toLowerCase() as keyof typeof t;
    const label = (t as any)[tKey] || wt.name_gu || wt.name;
    return `${wt.emoji} ${label}`;
  }, [workType, t, workTypes]);

  const farmNameToSave = useMemo(
    () => selectedFarm?.name || farmQuery.trim(),
    [selectedFarm, farmQuery],
  );

  // ── Data Loading ────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadFarmers();
      loadWorkTypes(db);
    }, [])
  );

  async function loadFarmers() {
    try {
      const result = await db.getAllAsync<Farmer>(
        'SELECT * FROM farmers WHERE user_id = ? AND is_deleted = 0 ORDER BY name',
        [USER_ID]
      );
      setFarmers(result || []);
    } catch (error) {
      console.error('Failed to load farmers:', error);
    }
  }

  async function loadFarmsForFarmer(farmerId: string) {
    try {
      const result = await db.getAllAsync<Farm>(
        'SELECT * FROM farms WHERE farmer_id = ? AND is_deleted = 0 ORDER BY name',
        [farmerId]
      );
      setFarmsForFarmer(result || []);
    } catch (error) {
      console.error('Failed to load farms:', error);
    }
  }

  useEffect(() => {
    if (selectedFarmer) {
      loadFarmsForFarmer(selectedFarmer.id);
    } else {
      setFarmsForFarmer([]);
      setSelectedFarm(null);
      setFarmQuery('');
      setShowFarmSuggestions(false);
      setShowInlineFarmForm(false);
    }
  }, [selectedFarmer]);

  // ── Farmer Selection ────────────────────────────────────────
  function selectFarmer(farmer: Farmer) {
    setSelectedFarmer(farmer);
    setFarmerQuery('');
    setShowSuggestions(false);
    setSelectedFarm(null);
    setFarmQuery('');
    setShowInlineFarmForm(false);
    setShowFarmSuggestions(false);
  }

  function clearFarmer() {
    setSelectedFarmer(null);
    setFarmsForFarmer([]);
    setSelectedFarm(null);
    setFarmQuery('');
    setShowInlineFarmForm(false);
    setShowFarmSuggestions(false);
  }

  // ── Inline Add Farmer ───────────────────────────────────────
  async function handleSaveNewFarmer() {
    if (!newFarmerName.trim()) {
      Alert.alert(t.farmerName, 'Required');
      return;
    }
    if (!newFarmerMobile.trim()) {
      Alert.alert(t.mobileNumber, 'Required');
      return;
    }
    try {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO farmers (id, user_id, name, mobile, village, created_at, updated_at, is_deleted, sync_status)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0, 'pending')`,
        [id, USER_ID, newFarmerName.trim(), newFarmerMobile.trim(), newFarmerVillage.trim() || null]
      );
      const newFarmer: Farmer = {
        id,
        user_id: USER_ID,
        name: newFarmerName.trim(),
        mobile: newFarmerMobile.trim(),
        village: newFarmerVillage.trim() || null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: 0,
        sync_status: 'pending',
      };
      setShowAddFarmerModal(false);
      setNewFarmerName('');
      setNewFarmerMobile('');
      setNewFarmerVillage('');
      await loadFarmers();
      selectFarmer(newFarmer);
    } catch (error) {
      console.error('Failed to add farmer:', error);
      Alert.alert('Error', 'Failed to add farmer');
    }
  }

  async function handleSaveNewFarm() {
    if (!newFarmName.trim() || !selectedFarmer) return;
    try {
      const id = generateUUID();
      const areaAcres = parseFloat(newFarmArea) || null;
      await db.runAsync(
        `INSERT INTO farms (id, farmer_id, user_id, name, location, area_acres, created_at, is_deleted, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0, 'pending')`,
        [id, selectedFarmer.id, USER_ID, newFarmName.trim(), newFarmLocation.trim() || null, areaAcres]
      );
      const newFarm: Farm = {
        id,
        farmer_id: selectedFarmer.id,
        user_id: USER_ID,
        name: newFarmName.trim(),
        location: newFarmLocation.trim() || null,
        area_acres: areaAcres,
        notes: null,
        created_at: new Date().toISOString(),
        is_deleted: 0,
        sync_status: 'pending',
      };
      setSelectedFarm(newFarm);
      setShowInlineFarmForm(false);
      setNewFarmName('');
      setNewFarmLocation('');
      setNewFarmArea('');
      setFarmQuery('');
      setShowFarmSuggestions(false);
      await loadFarmsForFarmer(selectedFarmer.id);
    } catch (error) {
      console.error('Failed to add farm:', error);
      Alert.alert('Error', 'Failed to add farm');
    }
  }

  // ── Validation & Submit ─────────────────────────────────────
  function validate(): boolean {
    if (!selectedFarmer) {
      Alert.alert('⚠️', t.selectFarmer);
      return false;
    }
    if (!farmNameToSave) {
      Alert.alert('⚠️', t.farmName);
      return false;
    }
    if (!workType) {
      Alert.alert('⚠️', t.workType);
      return false;
    }
    if (!rate || parseFloat(rate) <= 0) {
      Alert.alert('⚠️', t.rate);
      return false;
    }
    if (total <= 0) {
      Alert.alert('⚠️', t.total);
      return false;
    }
    return true;
  }

  function handlePreSubmit(notify: boolean) {
    if (!validate()) return;
    setPendingNotify(notify);
    setShowConfirmation(true);
  }

  async function handleSubmit() {
    setShowConfirmation(false);
    setIsSubmitting(true);
    try {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO work_entries (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at, is_deleted, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), 0, 'pending')`,
        [
          id, USER_ID, selectedFarmer!.id, farmNameToSave,
          date, workType, parseFloat(quantity) || 0, quantityUnit,
          parseFloat(rate), total, notes || null,
        ]
      );

      if (pendingNotify && selectedFarmer) {
        const dueResult = await db.getFirstAsync<{ due: number }>(
          `SELECT 
            COALESCE(SUM(CASE WHEN w.id IS NOT NULL THEN w.total_amount ELSE 0 END), 0) -
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.farmer_id = ? AND p.is_deleted = 0), 0) as due
           FROM work_entries w WHERE w.farmer_id = ? AND w.is_deleted = 0`,
          [selectedFarmer.id, selectedFarmer.id]
        );
        await openWorkNotification(
          selectedFarmer.mobile,
          selectedFarmer.name,
          farmNameToSave,
          workType,
          total,
          dueResult?.due ?? total
        );
      }

      // Show success screen
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
      }, 2000);
    } catch (error) {
      console.error('Failed to add work entry:', error);
      Alert.alert('Error', 'Failed to add work entry');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedFarmer(null);
    setSelectedFarm(null);
    setFarmQuery('');
    setFarmsForFarmer([]);
    setFarmerQuery('');
    setShowSuggestions(false);
    setShowInlineFarmForm(false);
    setShowFarmSuggestions(false);
    setNewFarmName('');
    setNewFarmLocation('');
    setNewFarmArea('');
    setWorkType('');
    setQuantity('');
    setRate('');
    setNotes('');
    setDate(getTodayISO());
  }

  // ── RENDER ──────────────────────────────────────────────────
  return (
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
        overScrollMode="never"
      >
        {/* ── Date ────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.date}</Text>
          <TouchableOpacity style={styles.dateInput}>
            <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
            <Text style={styles.dateText}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Farmer Search ────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.selectFarmer} *</Text>

          {selectedFarmer ? (
            <View style={styles.selectedChip}>
              <Text style={styles.chipText}>
                👨‍🌾 {selectedFarmer.name} • {selectedFarmer.village || ''}
              </Text>
              <TouchableOpacity onPress={clearFarmer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.chipClear}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.searchInput}
                placeholder={t.searchFarmer}
                placeholderTextColor={Colors.textTertiary}
                value={farmerQuery}
                onChangeText={(text) => {
                  setFarmerQuery(text);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />

              {showSuggestions && farmerQuery.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredFarmers.map((farmer) => (
                      <TouchableOpacity
                        key={farmer.id}
                        style={styles.suggestionItem}
                        onPress={() => selectFarmer(farmer)}
                      >
                        <Text style={styles.suggestionName}>{farmer.name}</Text>
                        <Text style={styles.suggestionVillage}>{farmer.village || ''}</Text>
                      </TouchableOpacity>
                    ))}
                    {filteredFarmers.length === 0 && (
                      <Text style={styles.noResults}>{t.noFarmerFound}</Text>
                    )}
                  </ScrollView>

                  {/* Add New Farmer button */}
                  <TouchableOpacity
                    style={styles.addNewFarmerBtn}
                    onPress={() => {
                      setNewFarmerName(farmerQuery);
                      setShowAddFarmerModal(true);
                      setShowSuggestions(false);
                    }}
                  >
                    <Ionicons name="add-circle" size={22} color={Colors.success} />
                    <Text style={styles.addNewFarmerText}>+ નવા ખેડૂત ઉમેરો</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Farm Search (after farmer selected) ──── */}
        {selectedFarmer && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.farmName} *</Text>

            <TextInput
              style={styles.searchInput}
              placeholder="ખેતર શોધો અથવા નામ લખો..."
              placeholderTextColor={Colors.textTertiary}
              value={farmQuery}
              onChangeText={(text) => {
                setFarmQuery(text);
                setSelectedFarm(null);
                setShowFarmSuggestions(true);
              }}
              onFocus={() => setShowFarmSuggestions(true)}
            />

            {showFarmSuggestions && !selectedFarm && (
              <View style={styles.suggestionsContainer}>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {farmsForFarmer
                    .filter((f) => f.name.toLowerCase().includes(farmQuery.toLowerCase()))
                    .map((farm) => (
                      <TouchableOpacity
                        key={farm.id}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setSelectedFarm(farm);
                          setFarmQuery('');
                          setShowFarmSuggestions(false);
                          setShowInlineFarmForm(false);
                        }}
                      >
                        <View>
                          <Text style={styles.suggestionName}>{farm.name}</Text>
                          <Text style={styles.suggestionSub}>
                            {[farm.location, farm.area_acres ? `${farm.area_acres} ${t.acres}` : null]
                              .filter(Boolean)
                              .join(' • ') || '—'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                  <TouchableOpacity
                    style={[styles.suggestionItem, styles.addNewItem]}
                    onPress={() => {
                      setShowInlineFarmForm(true);
                      setShowFarmSuggestions(false);
                      if (farmQuery.trim()) {
                        setNewFarmName(farmQuery.trim());
                      }
                    }}
                  >
                    <Text style={styles.addNewText}>+ નવું ખેતર ઉમેરો</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {selectedFarm && (
              <View style={styles.selectedChip}>
                <Text style={styles.chipText}>🌾 {selectedFarm.name}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedFarm(null);
                    setFarmQuery('');
                    setShowFarmSuggestions(true);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.chipClear}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {showInlineFarmForm && (
              <View style={styles.inlineFormCard}>
                <Text style={styles.inlineFormTitle}>નવું ખેતર ઉમેરો</Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="ખેતરનું નામ *"
                  placeholderTextColor={Colors.textTertiary}
                  value={newFarmName}
                  onChangeText={setNewFarmName}
                />

                <TextInput
                  style={styles.modalInput}
                  placeholder="સ્થળ / ગામ (વૈકલ્પિક)"
                  placeholderTextColor={Colors.textTertiary}
                  value={newFarmLocation}
                  onChangeText={setNewFarmLocation}
                />

                <TextInput
                  style={styles.modalInput}
                  placeholder="વિઘા (વૈકલ્પિક)"
                  placeholderTextColor={Colors.textTertiary}
                  value={newFarmArea}
                  onChangeText={setNewFarmArea}
                  keyboardType="numeric"
                />

                <View style={styles.inlineFormButtons}>
                  <TouchableOpacity
                    style={styles.inlineCancelBtn}
                    onPress={() => {
                      setShowInlineFarmForm(false);
                      setNewFarmName('');
                      setNewFarmLocation('');
                      setNewFarmArea('');
                    }}
                  >
                    <Text style={styles.inlineCancelText}>રદ કરો</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.inlineSaveBtn} onPress={handleSaveNewFarm}>
                    <Text style={styles.inlineSaveText}>ખેતર સાચવો ✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Work Type — Big Icon Buttons ─────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.workType} *</Text>
          <View style={styles.workTypeGrid}>
            {workTypes.map((wt) => (
              <TouchableOpacity
                key={wt.id}
                style={[
                  styles.workTypeBtn,
                  workType === wt.name && styles.workTypeBtnSelected,
                ]}
                onPress={() => setWorkType(wt.name)}
              >
                <Text style={styles.workTypeEmoji}>{wt.emoji}</Text>
                <Text
                  style={[
                    styles.workTypeLabel,
                    workType === wt.name && styles.workTypeLabelSelected,
                  ]}
                >
                  {wt.name_gu || wt.name}
                </Text>
              </TouchableOpacity>
            ))}
            {/* Add Custom Work Type */}
            <TouchableOpacity
              style={[styles.workTypeBtn, { borderStyle: 'dashed' }]}
              onPress={() => setShowAddWorkTypeModal(true)}
            >
              <Text style={styles.workTypeEmoji}>➕</Text>
              <Text style={styles.workTypeLabel}>{t.other}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Quantity & Unit ─────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.quantity}</Text>
          <View style={styles.quantityRow}>
            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
            <View style={styles.unitToggle}>
              {QUANTITY_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.unitBtn, quantityUnit === unit && styles.unitBtnSelected]}
                  onPress={() => setQuantityUnit(unit)}
                >
                  <Text
                    style={[styles.unitBtnText, quantityUnit === unit && styles.unitBtnTextSelected]}
                  >
                    {unit === 'acres' ? t.acres : t.hours}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Rate ────────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            {t.rate} (/{quantityUnit === 'acres' ? t.acres : t.hours}) *
          </Text>
          <View style={styles.rateInput}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.rateTextInput}
              value={rate}
              onChangeText={setRate}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* ── Total ───────────────────────────────── */}
        <View style={styles.totalContainer}>
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.total}</Text>
            <Text style={[styles.totalAmount, total > 0 && styles.totalAmountActive]}>
              {formatIndianCurrency(total)}
            </Text>
          </View>
        </View>

        {/* ── Notes ───────────────────────────────── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t.notes}</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.notes}
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* ── Action Buttons ──────────────────────── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.submitBtn, styles.submitBtnNotify]}
            onPress={() => handlePreSubmit(true)}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="logo-whatsapp" size={24} color={Colors.white} />
                <Text style={styles.submitBtnText}>{t.addWork} & WhatsApp</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, styles.submitBtnSave]}
            onPress={() => handlePreSubmit(false)}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Ionicons name="save-outline" size={22} color={Colors.primary} />
            <Text style={[styles.submitBtnText, styles.submitBtnTextSecondary]}>
              {t.save}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════
          CONFIRMATION MODAL
         ═══════════════════════════════════════════════ */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={styles.confirmModal}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>📋 કામ ચેક કરો</Text>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>ખેડૂત</Text>
              <Text style={styles.confirmValue}>{selectedFarmer?.name}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>ખેતર</Text>
              <Text style={styles.confirmValue}>{farmNameToSave || '—'}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>કામ</Text>
              <Text style={styles.confirmValue}>{workTypeTranslated}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>{quantityUnit === 'acres' ? t.acres : t.hours}</Text>
              <Text style={styles.confirmValue}>{quantity || '0'}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>{t.rate}</Text>
              <Text style={styles.confirmValue}>{formatIndianCurrency(parseFloat(rate) || 0)}</Text>
            </View>
            <View style={[styles.confirmRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.confirmLabel}>{t.total}</Text>
              <Text style={styles.confirmTotal}>{formatIndianCurrency(total)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, styles.confirmBtnSave]}
              onPress={handleSubmit}
            >
              <Text style={{ color: Colors.white, fontSize: 17, fontWeight: '700' }}>
                ✓ સાચું છે — સાચવો
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.confirmBtnChange]}
              onPress={() => setShowConfirmation(false)}
            >
              <Text style={{ color: Colors.danger, fontSize: 16, fontWeight: '600' }}>
                ✗ બદલો
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          SUCCESS SCREEN
         ═══════════════════════════════════════════════ */}
      <Modal visible={showSuccess} transparent={false} animationType="slide">
        <View style={styles.successModal}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successText}>કામ સફળતાથી ઉમેરાયું!</Text>
          <Text style={styles.successSub}>
            {selectedFarmer?.name} — {formatIndianCurrency(total)}
          </Text>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          ADD FARMER BOTTOM SHEET MODAL
         ═══════════════════════════════════════════════ */}
      <Modal visible={showAddFarmerModal} transparent animationType="slide">
        <View style={styles.addFarmerModal}>
          <View style={styles.addFarmerSheet}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
            </View>
            <Text style={styles.addFarmerTitle}>👨‍🌾 નવા ખેડૂત ઉમેરો</Text>

            <TextInput
              style={styles.modalInput}
              placeholder={t.farmerName + ' *'}
              placeholderTextColor={Colors.textTertiary}
              value={newFarmerName}
              onChangeText={setNewFarmerName}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t.mobileNumber + ' *'}
              placeholderTextColor={Colors.textTertiary}
              value={newFarmerMobile}
              onChangeText={setNewFarmerMobile}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t.village}
              placeholderTextColor={Colors.textTertiary}
              value={newFarmerVillage}
              onChangeText={setNewFarmerVillage}
            />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveNewFarmer}>
              <Text style={styles.modalSaveBtnText}>{t.save} ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: 8 }]}
              onPress={() => setShowAddFarmerModal(false)}
            >
              <Text style={[styles.modalSaveBtnText, { color: Colors.textSecondary }]}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add Work Type Modal ──────────────────── */}
      <Modal
        visible={showAddWorkTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddWorkTypeModal(false)}
      >
        <View style={styles.addFarmerModal}>
          <View style={styles.addFarmerSheet}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
            </View>
            <Text style={styles.addFarmerTitle}>➕ નવો કામનો પ્રકાર</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="કામનો પ્રકાર (e.g. Rotary, Spray)"
              placeholderTextColor={Colors.textTertiary}
              value={newWorkTypeName}
              onChangeText={setNewWorkTypeName}
            />

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={async () => {
                if (!newWorkTypeName.trim()) {
                  Alert.alert('', 'કૃપા કરીને કામનો પ્રકાર લખો');
                  return;
                }
                try {
                  const wt = await addWorkType(db, newWorkTypeName.trim());
                  setWorkType(wt.name);
                  setNewWorkTypeName('');
                  setShowAddWorkTypeModal(false);
                } catch (error) {
                  Alert.alert('Error', 'Failed to add work type');
                }
              }}
            >
              <Text style={styles.modalSaveBtnText}>✅ સાચવો</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: 8 }]}
              onPress={() => {
                setNewWorkTypeName('');
                setShowAddWorkTypeModal(false);
              }}
            >
              <Text style={[styles.modalSaveBtnText, { color: Colors.textSecondary }]}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  content: { padding: Layout.screenPaddingHorizontal, paddingBottom: 120 },

  // Fields
  field: { marginBottom: Spacing.lg },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Date
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
  },
  dateText: { ...Typography.body, color: Colors.text, fontWeight: '500' },

  // Search Input
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
    ...Typography.body,
    color: Colors.text,
  },

  // Suggestions
  suggestionsContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 999,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
  },
  suggestionName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  suggestionSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  suggestionVillage: { fontSize: 13, color: Colors.textSecondary },
  noResults: {
    padding: 16,
    textAlign: 'center',
    color: Colors.textTertiary,
    fontSize: 14,
  },
  addNewFarmerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: Colors.success + '10',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    minHeight: 56,
  },
  addNewFarmerText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success,
  },

  // Selected Farmer Chip
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 56,
  },
  chipText: { color: Colors.primary, fontWeight: '600', fontSize: 15, flex: 1 },
  chipClear: { color: Colors.danger, fontSize: 20, paddingHorizontal: 8 },

  inlineFormCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1B6CA8',
  },
  inlineFormTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B6CA8',
    marginBottom: 12,
  },
  inlineFormButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  inlineCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  inlineCancelText: {
    color: '#616161',
    fontSize: 15,
    fontWeight: '600',
  },
  inlineSaveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1B6CA8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  addNewItem: {
    backgroundColor: '#F0FFF4',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  addNewText: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 15,
  },

  // Work Type Grid — Big Icon Buttons
  workTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  workTypeBtn: {
    width: '31%' as any,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  workTypeBtnSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  workTypeEmoji: { fontSize: 28 },
  workTypeLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  workTypeLabelSelected: { color: Colors.white },

  // Quantity
  quantityRow: { flexDirection: 'row', gap: Spacing.md },
  quantityInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    height: Layout.inputHeight,
    ...Typography.amount,
    color: Colors.text,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: Layout.inputBorderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitBtn: {
    paddingHorizontal: Spacing.lg,
    height: Layout.inputHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  unitBtnSelected: { backgroundColor: Colors.primary },
  unitBtnText: { ...Typography.label, color: Colors.textSecondary },
  unitBtnTextSelected: { color: Colors.white },

  // Rate
  rateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    height: Layout.inputHeight,
    paddingLeft: Layout.inputPaddingHorizontal,
  },
  currencySymbol: { ...Typography.amount, color: Colors.primary, marginRight: Spacing.sm },
  rateTextInput: {
    flex: 1,
    height: '100%' as any,
    ...Typography.amount,
    color: Colors.text,
    paddingRight: Layout.inputPaddingHorizontal,
  },

  // Total
  totalContainer: { marginBottom: Spacing.lg },
  totalDivider: { height: 2, backgroundColor: Colors.border, marginBottom: Spacing.lg },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardBorderRadius,
    padding: Layout.cardPadding + 4,
    ...Shadows.medium,
  },
  totalLabel: { ...Typography.h3, color: Colors.textSecondary },
  totalAmount: { ...Typography.amountLarge, color: Colors.textTertiary },
  totalAmountActive: { color: Colors.primary },

  // Notes
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Layout.inputPaddingHorizontal,
    minHeight: 80,
    ...Typography.body,
    color: Colors.text,
    textAlignVertical: 'top',
  },

  // Actions
  actions: { gap: Spacing.md, marginTop: Spacing.lg },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    height: Layout.buttonHeight,
    borderRadius: Layout.inputBorderRadius,
    ...Shadows.medium,
  },
  submitBtnNotify: { backgroundColor: '#25D366' },
  submitBtnSave: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  submitBtnText: { ...Typography.button, color: Colors.white, fontSize: 17 },
  submitBtnTextSecondary: { color: Colors.primary },

  // ── Confirmation Modal ──
  confirmModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  confirmLabel: { fontSize: 15, color: Colors.textSecondary },
  confirmValue: { fontSize: 15, fontWeight: '600', color: Colors.text },
  confirmTotal: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  confirmBtn: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  confirmBtnSave: { backgroundColor: Colors.success },
  confirmBtnChange: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },

  // ── Success Modal ──
  successModal: {
    flex: 1,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successEmoji: { fontSize: 80, marginBottom: 20 },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFFCC',
    textAlign: 'center',
  },

  // ── Add Farmer Modal ──
  addFarmerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  addFarmerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  addFarmerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    height: 56,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  modalSaveBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalSaveBtnText: { fontSize: 17, fontWeight: '700', color: Colors.white },
});
