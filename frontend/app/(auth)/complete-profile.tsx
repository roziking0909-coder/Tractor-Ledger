import { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { getSupabase } from '@/lib/supabase';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@/constants/colors';

export default function CompleteProfileScreen() {
  const db = useSQLiteContext();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const token = useAuthStore.getState().accessToken;

  async function handleSendOTP() {
    if (phone.length < 10) return;
    setIsLoading(true);
    try {
      const normalizedPhone = `+91${phone.replace(/\D/g, '')}`;
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/send-binding-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not send OTP');
      setStep('otp');
    } catch (error) {
      Alert.alert('Error', 'Could not send OTP. Please check your number and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (otp.length < 4) return;
    setIsLoading(true);
    try {
      const normalizedPhone = `+91${phone.replace(/\D/g, '')}`;
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/bind-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ phone: normalizedPhone, token: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Verification failed');
      
      // Get fresh tokens and phone from backend response
      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token;
      if (!newAccessToken || !newRefreshToken) {
        throw new Error('Verification succeeded but fresh session tokens are missing.');
      }
      
      const newPhone = data.phone;
      const userId = data.user_id;
      
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        const updatedUser = { ...currentUser, phone: newPhone };
        useAuthStore.getState().setUser(updatedUser);
        // We will rely on updateSessionTokens to persist it right after
      }
      
      // Update tokens in Supabase Native and local auth persistence
      await getSupabase().auth.setSession({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      });
      await useAuthStore.getState().updateSessionTokens(newAccessToken, newRefreshToken);
      
      // Update SQLite local user data to avoid sync crash
      if (userId) {
         try {
           await db.runAsync(
             `INSERT INTO users (id, phone, name, sync_status) VALUES (?, ?, ?, 'synced') 
              ON CONFLICT(id) DO UPDATE SET phone=excluded.phone`,
             [userId, newPhone, currentUser?.name || '']
           );
         } catch (e) {
           console.error('Failed to update SQLite phone', e);
         }
      }
      
      // Force subscription check again
      const { loadStatus } = useSubscriptionStore.getState();
      const status = await loadStatus(newAccessToken);
      
      // Navigate based on strict subscription status
      if (status.is_active) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/activation');
      }
    } catch (error) {
      Alert.alert('Verification Failed', 'Invalid OTP or network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complete Profile</Text>
      <Text style={styles.subtitle}>Please link your phone number to continue.</Text>
      
      {step === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={10}
          />
          <TouchableOpacity style={styles.button} onPress={handleSendOTP} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOTP} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 30, textAlign: 'center', color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 20, backgroundColor: '#fff' },
  button: { backgroundColor: Colors.primary, padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
