/**
 * Root redirect — auth + subscription gate
 */

import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';

export default function IndexRedirect() {
  const { isAuthenticated, isDemoMode, accessToken, isLoading } = useAuthStore();
  const { loadStatus } = useSubscriptionStore();

  useEffect(() => {
    if (isLoading) return;

    async function navigate() {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
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
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/activation');
        }
      } catch {
        router.replace('/(auth)/activation');
      }
    }

    navigate();
  }, [isAuthenticated, isDemoMode, accessToken, isLoading]);

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
