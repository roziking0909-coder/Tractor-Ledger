/**
 * Farmers List Screen
 *
 * Scrollable list of farmer cards with search bar, pull-to-refresh,
 * FAB for adding new farmers, and a friendly empty state.
 * Each card navigates to farmer detail on press.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing, Layout, Shadows } from '@/constants/spacing';
import { formatIndianCurrency, formatDate, formatPhone, generateUUID, getTodayISO } from '@/lib/format';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useFarmersStore } from '@/store/useFarmersStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import FarmerCard from '@/components/FarmerCard';
import EmptyState from '@/components/EmptyState';

import { useAuthStore } from '@/store/useAuthStore';

export default function FarmersScreen() {
  const { user, isDemoMode } = useAuthStore();
  const USER_ID = isDemoMode ? 'demo-user' : user?.id || 'demo-user';
  const db = useSQLiteContext();
  const { farmers, isLoading, loadFarmers, searchFarmers, getFilteredFarmers } = useFarmersStore();
  const { t } = useLanguageStore();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Reload farmers whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadFarmers(db, USER_ID);
    }, [db])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFarmers(db, USER_ID);
    setRefreshing(false);
  }, [db]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    searchFarmers(text);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchText('');
    searchFarmers('');
  }, []);

  const filteredFarmers = getFilteredFarmers();

  const hasSearchResults = searchText.trim().length > 0;
  const showEmptyState = !isLoading && filteredFarmers.length === 0;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={22}
            color={Colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t.searchFarmer}
            placeholderTextColor={Colors.textTertiary}
            value={searchText}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <Pressable
              onPress={handleClearSearch}
              style={styles.clearButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Farmer Count Badge */}
      {filteredFarmers.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {hasSearchResults
              ? `${filteredFarmers.length} ${t.farmers}`
              : `${filteredFarmers.length} ${t.farmers}`}
          </Text>
        </View>
      )}

      {/* Loading State */}
      {isLoading && farmers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t.loadingFarmers}</Text>
        </View>
      ) : showEmptyState ? (
        /* Empty State */
        hasSearchResults ? (
          <EmptyState
            icon="🔍"
            title={t.noFarmersFound}
            subtitle={`"${searchText}"`}
            actionLabel={t.clearSearch}
            onAction={handleClearSearch}
          />
        ) : (
          <EmptyState
            icon="👨‍🌾"
            title={t.noFarmersYet}
            subtitle={t.noFarmersYetSub}
            actionLabel={`+ ${t.addFarmer}`}
            onAction={() => router.push('/farmer/add')}
          />
        )
      ) : (
        /* Farmer Cards List */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {filteredFarmers.map((farmer) => (
            <View key={farmer.id} style={styles.cardWrapper}>
              <FarmerCard
                name={farmer.name}
                village={farmer.village || t.noVillage}
                phone={farmer.mobile}
                dueAmount={farmer.remaining_due}
                farmCount={farmer.farm_count}
                onPress={() => router.push(`/farmer/${farmer.id}`)}
              />
            </View>
          ))}

          {/* Bottom spacer for FAB */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
        ]}
        onPress={() => router.push('/farmer/add')}
        android_ripple={{ color: Colors.primaryLight, borderless: true }}
      >
        <Ionicons name="add" size={30} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputBorderRadius,
    height: Layout.inputHeight,
    paddingHorizontal: Layout.inputPaddingHorizontal,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    height: '100%',
    padding: 0,
  },
  clearButton: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  countContainer: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingBottom: Spacing.sm,
  },
  countText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  cardWrapper: {
    marginBottom: Layout.cardGap,
  },
  bottomSpacer: {
    height: Layout.fabSize + Spacing['3xl'],
  },
  fab: {
    position: 'absolute',
    bottom: Spacing['2xl'],
    right: Layout.screenPaddingHorizontal,
    width: Layout.fabSize,
    height: Layout.fabSize,
    borderRadius: Layout.fabBorderRadius,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.large,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    elevation: 8,
  },
  fabPressed: {
    backgroundColor: Colors.primaryDark,
    transform: [{ scale: 0.95 }],
  },
});
