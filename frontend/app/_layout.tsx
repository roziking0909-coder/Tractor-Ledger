/**
 * Tractor Ledger — Root Layout
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, StatusBar, Platform, AppState } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Suspense } from 'react';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { initializeDatabase } from '@/lib/database';
import { seedDatabase } from '@/lib/seed';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/useAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushPendingToSupabase } from '@/lib/sync';

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
        The app's local database could not be opened and automatic recovery failed.
        {'\n\n'}
        Please clear the app's data and restart:
        {'\n'}
        Settings → Apps → Expo Go → Storage → Clear Data.
      </Text>
    </View>
  );
}

function AppContent() {
  const db = useSQLiteContext();
  const { user, restoreSession, isLoading } = useAuthStore();
  // Ensure the Ionicons font is loaded before rendering tab/icon UI.
  const [fontsLoaded] = useFonts(Ionicons.font);

  useEffect(() => {
    // In edge-to-edge mode (default on Android SDK 54+), the navigation bar
    // background is configured via app.json (android.navigationBarColor).
    // Only setButtonStyleAsync remains supported at runtime.
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync('dark');
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && user?.id) {
        pushPendingToSupabase(db, user.id).catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user?.id, db]);

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
  // If a previous attempt already failed terminally, do NOT retry. Surface the
  // error immediately so the provider renders the error UI instead of looping.
  if (databaseInitFailed) {
    throw new DatabaseInitError('Database initialization previously failed. Clear app data and restart.');
  }

  try {
    await initializeDatabase(db);
    
    // Only seed if we are actively in demo mode.
    // Read directly from AsyncStorage since Zustand store might not be hydrated yet.
    const rawAuth = await AsyncStorage.getItem('@tractor_ledger/auth');
    let isDemoMode = false;
    if (rawAuth) {
      try {
        isDemoMode = JSON.parse(rawAuth).isDemoMode;
      } catch (e) {}
    }
    
    if (isDemoMode) {
      await seedDatabase(db, 'demo-user');
    }
  } catch (error) {
    console.warn('[DB Init] Error during init/seed, resetting database (one attempt):', error);
    try {
      await db.execAsync(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS expenses;
        DROP TABLE IF EXISTS payments;
        DROP TABLE IF EXISTS work_entries;
        DROP TABLE IF EXISTS work_types;
        DROP TABLE IF EXISTS farms;
        DROP TABLE IF EXISTS farmers;
        DROP TABLE IF EXISTS users;
        PRAGMA foreign_keys = ON;
      `);
      await initializeDatabase(db);
      
      const rawAuth = await AsyncStorage.getItem('@tractor_ledger/auth');
      let isDemoMode = false;
      if (rawAuth) {
        try {
          isDemoMode = JSON.parse(rawAuth).isDemoMode;
        } catch (e) {}
      }

      if (isDemoMode) {
        await seedDatabase(db, 'demo-user');
      }
    } catch (resetError) {
      // Hard stop: one reset attempt failed. Flag it, do NOT retry, and rethrow
      // so SQLiteProvider's onError surfaces a clear error screen. The on-disk
      // database file is likely corrupt and cannot be recovered in-process.
      console.error('[DB Init] Reset also failed — giving up (no further retries):', resetError);
      databaseInitFailed = true;
      throw new DatabaseInitError(
        'Database could not be initialized or reset. The local database file is likely corrupt.',
        resetError
      );
    }
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
