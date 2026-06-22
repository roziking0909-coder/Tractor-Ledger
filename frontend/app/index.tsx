/**
 * Root redirect — auth + phone collection + subscription gate
 */

import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { useSQLiteContext } from 'expo-sqlite';
import { pullFromSupabase } from '@/lib/sync';

export default function IndexRedirect() {
  const { user, isAuthenticated, isDemoMode, accessToken, isLoading, needsPhoneNumber } = useAuthStore();
  const { loadStatus } = useSubscriptionStore();
  const db = useSQLiteContext();

  useEffect(() => {
    if (isLoading) return;

    async function navigate() {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }

      // After Google Sign-In, collect phone number if not set
      if (needsPhoneNumber) {
        router.replace('/(auth)/collect-phone' as any);
        return;
      }

      if (isDemoMode) {
        router.replace('/(tabs)');
        return;
      }

      if (!accessToken) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        const status = await loadStatus(accessToken);
        if (status.is_active) {
          if (user?.id) {
            // Only pull if we have no local data for this user to avoid unnecessary network calls on every app start
            const existingFarmers = await db.getFirstAsync<{count: number}>(
              'SELECT COUNT(*) as count FROM farmers WHERE user_id = ? AND is_deleted = 0',
              [user.id]
            );
            if (!existingFarmers || existingFarmers.count === 0) {
              await pullFromSupabase(db, user.id);
            }
          }
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/activation');
        }
      } catch {
        router.replace('/(auth)/activation');
      }
    }

    navigate();
  }, [isAuthenticated, isDemoMode, accessToken, isLoading, needsPhoneNumber]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
