/**
 * Tractor Ledger — Device ID Helper
 *
 * Uses expo-application to get a unique Android device ID.
 * This is used for activation code device-lock:
 * - Each code is tied to ONE device only
 * - If reinstalled or new phone → code is used up, need a new one
 */

import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * Get a unique device identifier.
 * - Android: Application.getAndroidId() — stable per device + app signature
 * - iOS: falls back to a generated UUID stored in AsyncStorage (not implemented yet)
 * - Other: returns 'unknown'
 */
export async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'android') {
    const androidId = Application.getAndroidId();
    return androidId || 'unknown-android';
  }
  // iOS would use a different approach (e.g. identifierForVendor)
  // For now, this app is Android-only for rural India
  return 'unknown-device';
}
