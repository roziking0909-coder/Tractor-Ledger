/**
 * Auth group layout — no header, full screen
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="activation" />
    </Stack>
  );
}
