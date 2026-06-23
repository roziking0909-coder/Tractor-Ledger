/**
 * Tractor Ledger — Tab Layout
 *
 * Bottom tab navigator with 6 tabs:
 * Dashboard | Farmers | + Add Work (center FAB) | Dues | Expenses | Profile
 *
 * Large icons, high-contrast colors, village-friendly labels.
 */

import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useLanguageStore } from '@/store/useLanguageStore';

// Custom center "Add Work" button
function AddWorkButton({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.addButton, focused && styles.addButtonFocused]}>
      <Ionicons name="add" size={32} color={Colors.white} />
    </View>
  );
}

export default function TabLayout() {
  const { t } = useLanguageStore();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: [
          styles.tabBar,
          { height: 64 + insets.bottom, paddingBottom: insets.bottom + 8 },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { fontWeight: '700', fontSize: 20, color: Colors.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.dashboard,
          headerTitle: '🚜 ટ્રેક્ટર સારથી',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="farmers"
        options={{
          title: t.farmers,
          headerTitle: t.farmers,
          tabBarIcon: ({ color }) => (
            <Ionicons name="people" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: t.addWork,
          headerTitle: t.addWork,
          tabBarIcon: ({ focused }) => <AddWorkButton focused={focused} />,
          tabBarLabel: () => null, // Hide label for center button
        }}
      />
      <Tabs.Screen
        name="dues"
        options={{
          title: t.dues,
          headerTitle: t.dues,
          tabBarIcon: ({ color }) => (
            <Ionicons name="wallet-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t.expenses,
          headerTitle: t.expenses_title,
          tabBarIcon: ({ color }) => (
            <Ionicons name="receipt-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'રિપોર્ટ્સ',
          headerTitle: 'રિપોર્ટ્સ',
          tabBarIcon: ({ color }) => (
            <Ionicons name="bar-chart-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'પ્રોફાઇલ',
          headerTitle: 'પ્રોફાઇલ',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabIcon: {
    marginBottom: -2,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonFocused: {
    backgroundColor: Colors.primaryDark,
    transform: [{ scale: 1.05 }],
  },
});
