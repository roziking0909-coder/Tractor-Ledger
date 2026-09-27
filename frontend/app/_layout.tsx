/**
 * Tractor Ledger — Root Layout
 */

import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, StatusBar, Platform, AppState } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Suspense } from 'react';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { initializeDatabase } from '@/lib/database';
import { pushPendingToSupabase } from '@/lib/sync';

import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { ApiError } from '@/lib/api';

// Keep the native splash visible until fonts + session restore finish. This
// covers the entire startup window so the navigator can stay mounted the whole
// time (see AppContent) instead of flashing a blank loading view in and out.
SplashScreen.preventAutoHideAsync().catch(() => {});

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

function DatabaseErrorScreen() {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Database error</Text>
      <Text style={styles.errorBody}>
        The app's local database could not be opened.
        {'\n\n'}
        Please restart the app or contact support. Do NOT clear app data, as unsynced records may be lost.
      </Text>
    </View>
  );
}

function AppContent() {
  const db = useSQLiteContext();
  const { restoreSession, isLoading, user, isDemoMode } = useAuthStore();
  const { loadStatus } = useSubscriptionStore();
  const segments = useSegments();

  // Ensure the Ionicons font is loaded before rendering tab/icon UI.
  const [fontsLoaded] = useFonts(Ionicons.font);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current !== 'active' && nextAppState === 'active') {
        const { isAuthenticated, accessToken } = useAuthStore.getState();

        if (user?.id && !isDemoMode && user.id !== 'demo-user') {
          pushPendingToSupabase(db, user.id).catch((error) => {
            console.warn('[Sync] Foreground retry failed:', error);
          });

          // Foreground Subscription Check
          const currentPath = segments.join('/');
          const isLoggingOut = !isAuthenticated; // if auth state just cleared
          if (
            isAuthenticated &&
            accessToken &&
            currentPath !== '(auth)/complete-profile' &&
            currentPath !== '(auth)/activation' &&
            currentPath !== '(auth)/login'
          ) {
            loadStatus(accessToken).then((status) => {
              if (!status.is_active) {
                router.replace('/(auth)/activation');
              }
            }).catch((err) => {
              console.warn('[Subscription] Foreground check failed:', err);
              // Only redirect if confirmed inactive (HTTP 402/403) or specific server messages
              // Do NOT redirect on network timeout or 500
              if (err instanceof ApiError) {
                 if (err.status === 402 || err.status === 403) {
                    router.replace('/(auth)/activation');
                 }
                 // If the backend throws a 400 for 'Phone number is required', we can ignore it here
                 // because they shouldn't be on tabs anyway.
              }
            });
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [db, user?.id, isDemoMode]);

  useEffect(() => {
    // In edge-to-edge mode (default on Android SDK 54+), the navigation bar
    // background is configured via app.json (android.navigationBarColor).
    // Only setButtonStyleAsync remains supported at runtime.
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync('dark');
    }
  }, []);

  useEffect(() => {
    restoreSession(db);
  }, [db]);

  // Once fonts are loaded and the session has been restored, hide the native
  // splash. The navigator below is ALWAYS mounted, so there is no mount/unmount
  // flicker — the splash simply uncovers the already-rendered first screen.
  const isReady = !isLoading && fontsLoaded;
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="farmer/add"
          options={{ title: 'Add Farmer', presentation: 'modal' }}
        />
        <Stack.Screen name="farmer/[id]" options={{ title: 'Farmer Details' }} />
        <Stack.Screen
          name="farmer/edit/[id]"
          options={{ title: 'Edit Farmer', presentation: 'modal' }}
        />
        <Stack.Screen name="farm/add" options={{ title: 'Add Farm', presentation: 'modal' }} />
        <Stack.Screen
          name="farm/edit/[id]"
          options={{ title: 'Edit Farm', presentation: 'modal' }}
        />
        <Stack.Screen
          name="work/add"
          options={{ title: 'Add Work Entry', presentation: 'modal' }}
        />
        <Stack.Screen
          name="payment/add"
          options={{ title: 'Record Payment', presentation: 'modal' }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

// Module-level hard stop. Once init + one reset attempt have both failed in
// this app process, we never touch the database again — this prevents the
// infinite init → reset → fail → remount → init loop. Survives provider
// remounts because it lives outside the React tree.
let databaseInitFailed = false;

class DatabaseInitError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'DatabaseInitError';
  }
}

async function onDatabaseInit(db: any) {
  if (databaseInitFailed) {
    throw new DatabaseInitError(
      'Database initialization previously failed. Restart the app and inspect the database error.'
    );
  }

  try {
    await initializeDatabase(db);
  } catch (error) {
    console.error('[DB Init] Database initialization failed. No destructive recovery attempted:', error);
    databaseInitFailed = true;

    throw new DatabaseInitError(
      'Database could not be initialized. Existing local data was left untouched.',
      error
    );
  }
}

export default function RootLayout() {
  const [dbError, setDbError] = useState<Error | null>(null);

  // If the database failed terminally, show a recovery screen instead of
  // mounting the provider's children against a dead/closed database handle.
  // Hide the splash so the error screen is actually visible.
  useEffect(() => {
    if (dbError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [dbError]);

  if (dbError) {
    return <DatabaseErrorScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider
        databaseName="tractor_ledger.db"
        onInit={onDatabaseInit}
        onError={(error) => {
          console.error('[DB Init] Surfacing database error to UI:', error);
          setDbError(error);
        }}
      >
        <AppContent />
      </SQLiteProvider>
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: Colors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.danger,
    marginBottom: 12,
  },
  errorBody: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    textAlign: 'center',
  },
});
