import { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { getSupabase } from '@/lib/supabase';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@/constants/colors';
import { normalizeIndianPhoneNumber } from '@/lib/phone';

export default function CompleteProfileScreen() {
  const db = useSQLiteContext();
  const { user, setPhoneNumber } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSave() {
    if (!user) return;
    
    // 3. Local validation using helper
    const normalizedPhone = normalizeIndianPhoneNumber(phone);
    if (!normalizedPhone) {
      Alert.alert('', 'કૃપા કરીને માન્ય 10-અંકનો મોબાઇલ નંબર દાખલ કરો');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getSupabase();
      
      // 5. Duplicate check
      const { data: existing, error: queryError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', normalizedPhone)
        .maybeSingle();
        
      if (queryError) {
        console.error('Error querying duplicate phone:', queryError);
        throw new Error('નેટવર્ક ભૂલ. કૃપા કરીને ફરી પ્રયાસ કરો.');
      }
      
      if (existing && existing.id !== user.id) {
        Alert.alert('Error', 'આ ફોન નંબર પહેલેથી જ બીજા ખાતા સાથે જોડાયેલ છે.');
        return;
      }

      // 4. Save safely to public.users ONLY
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({ 
          id: user.id, 
          phone: normalizedPhone,
          name: user.name || 'Tractor Owner'
        }, { onConflict: 'id' });
        
      if (upsertError) {
        console.error('Error saving phone to Supabase:', upsertError);
        throw new Error('માહિતી સાચવી શકાઈ નથી.');
      }

      await setPhoneNumber(normalizedPhone, db);
      
      // 7. Subscription flow
      const token = useAuthStore.getState().accessToken;
      if (token) {
        const { loadStatus } = useSubscriptionStore.getState();
        const status = await loadStatus(token);
        if (status.is_active) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/activation');
        }
      } else {
        router.replace('/');
      }

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save phone number');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complete Profile</Text>
      <Text style={styles.subtitle}>Please link your phone number to continue.</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Mobile Number (e.g. 9876543210)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={15}
      />
      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save & Continue</Text>}
      </TouchableOpacity>
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
